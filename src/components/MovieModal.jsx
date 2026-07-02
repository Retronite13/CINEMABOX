import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import TierBadge from './TierBadge'
import TierRatingPicker from './TierRatingPicker'
import DonutChart from './DonutChart'
import ReviewSection from './ReviewSection'
import { scoreToTier } from '../lib/tiers'

export default function MovieModal({ movie, onClose, onUpdated }) {
  const [breakdown, setBreakdown] = useState([])
  const [totalRatings, setTotalRatings] = useState(0)
  const [averageScore, setAverageScore] = useState(0)
  const [loadingChart, setLoadingChart] = useState(true)

  // Pulls every individual score for this movie and buckets each one
  // into its tier, so the donut chart can show a real distribution
  // (not just a single average number).
  const loadBreakdown = useCallback(async () => {
    setLoadingChart(true)

    const { data, error } = await supabase
      .from('ratings')
      .select('score')
      .eq('movie_id', movie.id)

    if (!error && data) {
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
  }, [movie.id])

  useEffect(() => {
    loadBreakdown()
  }, [loadBreakdown])

  // Close on Escape, for keyboard users and basic accessibility hygiene.
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // After a rating is submitted: refresh the chart, and re-fetch this
  // movie's aggregate row so the card behind the modal (tier badge,
  // percentage) stays in sync too.
  async function handleRated() {
    await loadBreakdown()

    const { data, error } = await supabase
      .from('movie_scores')
      .select('*')
      .eq('id', movie.id)
      .single()

    if (!error) onUpdated?.(data)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="modal-body">
          {movie.poster_url && (
            <img src={movie.poster_url} alt={movie.title} className="modal-poster" />
          )}

          <div className="modal-details">
            <h2>
              {movie.title}{' '}
              {movie.release_year && <span className="movie-year">({movie.release_year})</span>}
            </h2>

            <TierBadge tier={movie.tier} percentage={movie.percentage} />

            <p className="movie-meta">
              {movie.director && <>Dir. {movie.director} · </>}
              {movie.runtime_minutes && <>{movie.runtime_minutes} min · </>}
              {movie.genre}
            </p>

            {movie.description && <p className="movie-description">{movie.description}</p>}

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
                  ? 'No audience ratings yet - be the first.'
                  : `Based on ${totalRatings} audience ${totalRatings === 1 ? 'rating' : 'ratings'}.`}
              </p>
            </div>

            <TierRatingPicker movieId={movie.id} onRated={handleRated} />

            <ReviewSection movieId={movie.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
