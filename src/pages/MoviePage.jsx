import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import TierBadge from '../components/TierBadge'
import TierRatingPicker from '../components/TierRatingPicker'
import DonutChart from '../components/DonutChart'
import ReviewSection from '../components/ReviewSection'
import EditPosterPanel from '../components/EditPosterPanel'
import EditMoviePanel from '../components/EditMoviePanel'
import { scoreToTier } from '../lib/tiers'

export default function MoviePage() {
  const { slug } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const [breakdown, setBreakdown] = useState([])
  const [totalRatings, setTotalRatings] = useState(0)
  const [averageScore, setAverageScore] = useState(0)
  const [loadingChart, setLoadingChart] = useState(true)

  // Fetch the movie by slug from movie_scores (same view the modal used)
  useEffect(() => {
    async function fetchMovie() {
      setLoading(true)
      const { data, error } = await supabase
        .from('movie_scores')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error || !data) {
        setError('Movie not found.')
      } else {
        setMovie(data)
      }
      setLoading(false)
    }
    fetchMovie()
  }, [slug])

  const loadBreakdown = useCallback(async () => {
    if (!movie) return
    setLoadingChart(true)

    const { data } = await supabase
      .from('ratings')
      .select('score')
      .eq('movie_id', movie.id)

    if (data) {
      const counts = {}
      let sum = 0
      data.forEach((row) => {
        const tier = scoreToTier(row.score)
        counts[tier] = (counts[tier] ?? 0) + 1
        sum += row.score
      })
      setBreakdown(Object.entries(counts).map(([tier, count]) => ({ tier, count })))
      setTotalRatings(data.length)
      setAverageScore(data.length ? sum / data.length : 0)
    }

    setLoadingChart(false)
  }, [movie])

  useEffect(() => {
    loadBreakdown()
  }, [loadBreakdown])

  async function handleRated() {
    await loadBreakdown()
    const { data } = await supabase
      .from('movie_scores')
      .select('*')
      .eq('id', movie.id)
      .single()
    if (data) setMovie(data)
  }

  if (loading) return <div className="movie-page-shell"><p>Loading...</p></div>
  if (error || !movie) return (
    <div className="movie-page-shell">
      <p>{error || 'Movie not found.'}</p>
      <Link to="/" className="back-link">← Back to all movies</Link>
    </div>
  )

  return (
    <div className="movie-page-shell">
      <Link to="/" className="back-link">← Back to all movies</Link>

      <div className="movie-page-body">
        {/* Left column: poster + admin poster editor */}
        <div className="movie-page-left">
          {movie.poster_url ? (
            <img src={movie.poster_url} alt={movie.title} className="movie-page-poster" />
          ) : (
            <div className="modal-poster-empty">No poster</div>
          )}
          <EditPosterPanel
            movie={movie}
            onUpdated={(updated) => setMovie((prev) => ({ ...prev, ...updated }))}
          />
        </div>

        {/* Right column: details or edit form */}
        <div className="movie-page-details">
          {profile?.is_admin && (
            <button
              className="edit-movie-toggle-btn"
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing ? '← Back to movie' : '✏️ Edit movie'}
            </button>
          )}

          {editing ? (
            <EditMoviePanel
              movie={movie}
              onUpdated={(updated) => {
                setMovie(updated)
                // If the slug changed, navigate to the new URL
                if (updated.slug && updated.slug !== slug) {
                  navigate(`/movie/${updated.slug}`, { replace: true })
                }
              }}
              onClose={() => setEditing(false)}
            />
          ) : (
            <>
              <h1 className="movie-page-title">
                {movie.title}
                {movie.release_year && (
                  <span className="movie-year"> ({movie.release_year})</span>
                )}
              </h1>

              <TierBadge tier={movie.tier} percentage={movie.percentage} />

              <p className="movie-meta">
                {movie.director && <>Dir. {movie.director} · </>}
                {movie.runtime_minutes && <>{movie.runtime_minutes} min · </>}
                {movie.genre}
              </p>

              {movie.description && (
                <p className="movie-description">{movie.description}</p>
              )}

              {/* Audience rating donut chart - animates in when page loads */}
              <div className="modal-chart-row">
                {!loadingChart && (
                  <DonutChart
                    breakdown={breakdown}
                    averageScore={averageScore}
                    totalRatings={totalRatings}
                  />
                )}
                <p className="donut-caption">
                  {totalRatings === 0
                    ? 'No audience ratings yet — be the first.'
                    : `Based on ${totalRatings} audience ${totalRatings === 1 ? 'rating' : 'ratings'}.`}
                </p>
              </div>

              <TierRatingPicker movieId={movie.id} onRated={handleRated} />

              <ReviewSection movieId={movie.id} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
