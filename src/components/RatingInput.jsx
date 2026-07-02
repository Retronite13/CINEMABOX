import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Handles a single user's rating for a single movie:
// - loads their existing rating if they already rated it
// - lets them submit a new score 1-10
// - on success, tells the parent (MovieCard) to refresh that movie's aggregate score
export default function RatingInput({ movieId, onRated }) {
  const { user } = useAuth()
  const [myScore, setMyScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savedScore, setSavedScore] = useState(null)

  // Check if this user already rated this movie, so the input
  // shows their existing score instead of a blank field.
  useEffect(() => {
    if (!user) return

    supabase
      .from('ratings')
      .select('score')
      .eq('movie_id', movieId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMyScore(String(data.score))
          setSavedScore(data.score)
        }
      })
  }, [movieId, user])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    const score = Number(myScore)
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      alert('Please enter a whole number between 1 and 10.')
      return
    }

    setSubmitting(true)

    // "upsert" = insert if no rating exists yet for this user+movie,
    // or update it if one already does. The "ratings" table has a
    // unique(movie_id, user_id) constraint from Phase 1, which is what
    // makes upsert know which row to update.
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { movie_id: movieId, user_id: user.id, score },
        { onConflict: 'movie_id,user_id' }
      )

    setSubmitting(false)

    if (error) {
      alert(error.message)
    } else {
      setSavedScore(score)
      onRated?.() // tells MovieCard to re-fetch this movie's updated average/tier
    }
  }

  if (!user) {
    return <p className="rating-prompt">Log in to rate this movie.</p>
  }

  return (
    <form className="rating-input" onSubmit={handleSubmit}>
      <input
        type="number"
        min="1"
        max="10"
        value={myScore}
        onChange={(e) => setMyScore(e.target.value)}
        placeholder="1-10"
      />
      <button type="submit" disabled={submitting}>
        {savedScore ? `Update (${savedScore})` : 'Rate'}
      </button>
    </form>
  )
}
