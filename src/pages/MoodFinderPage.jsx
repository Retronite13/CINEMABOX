import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import MovieGrid from '../components/MovieGrid'

export default function MoodFinderPage() {
  const [moods, setMoods] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load the mood list once on page load, same pattern as AddMovieForm.
  useEffect(() => {
    supabase
      .from('moods')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          setError(error.message)
        } else {
          setMoods(data ?? [])
        }
      })
  }, [])

  async function handleMoodClick(mood) {
    setSelectedMood(mood)
    setLoading(true)
    setError('')
    setMovies([])

    try {
      // Step 1: which movie ids are tagged with this mood?
      // (movie_moods is the join table linking movies <-> moods)
      const { data: links, error: linkError } = await supabase
        .from('movie_moods')
        .select('movie_id')
        .eq('mood_id', mood.id)

      if (linkError) throw linkError

      const movieIds = links.map((row) => row.movie_id)

      if (movieIds.length === 0) {
        setMovies([])
        return
      }

      // Step 2: fetch full movie data (with tier/percentage already calculated)
      // for just those ids, from the same movie_scores view MovieList uses.
      // Postgrest can't join straight from movie_moods into a VIEW via foreign
      // keys, so this two-step "get ids, then get rows" approach is the
      // simplest reliable way to do it here.
      const { data: movieData, error: movieError } = await supabase
        .from('movie_scores')
        .select('*')
        .in('id', movieIds)
        .order('percentage', { ascending: false })

      if (movieError) throw movieError

      setMovies(movieData)
    } catch (err) {
      setError(err.message || 'Something went wrong loading movies for this mood.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mood-page">
      <Link to="/" className="back-link">← Back to all movies</Link>
      <h1>What's your mood?</h1>
      <p className="mood-subtitle">Pick a mood and we'll find something to watch.</p>

      <div className="mood-grid">
        {moods.map((mood) => (
          <button
            key={mood.id}
            className={`mood-tile ${selectedMood?.id === mood.id ? 'mood-tile-active' : ''}`}
            onClick={() => handleMoodClick(mood)}
          >
            <span className="mood-emoji">{mood.emoji}</span>
            <span>{mood.name}</span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="mood-results">
          <h2>
            {selectedMood.emoji} {selectedMood.name}
          </h2>

          {loading && <p>Finding movies...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && (
            <MovieGrid movies={movies} emptyMessage="No movies tagged with this mood yet." />
          )}
        </div>
      )}
    </div>
  )
}
