import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Reviews are visible ONLY to signed-in members (enforced both here in
// the UI, and for real by the "reviews readable by members only" RLS
// policy in the database - so even a guest poking at the API directly
// can't read them).
export default function ReviewSection({ movieId }) {
  const { user, profile } = useAuth()
  const [reviews, setReviews] = useState([])
  const [myDraft, setMyDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadReviews = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Join to profiles so we can show each reviewer's username + CinemaBox ID
      // without a separate query per review.
      const { data, error } = await supabase
        .from('reviews')
        .select('id, body, created_at, user_id, profiles(username, cinemabox_id)')
        .eq('movie_id', movieId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReviews(data)

      const mine = data.find((r) => r.user_id === user.id)
      if (mine) setMyDraft(mine.body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [movieId, user])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user || !myDraft.trim()) return

    setSubmitting(true)
    setError('')

    const { error } = await supabase
      .from('reviews')
      .upsert(
        { movie_id: movieId, user_id: user.id, body: myDraft.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'movie_id,user_id' }
      )

    setSubmitting(false)

    if (error) {
      setError(error.message)
    } else {
      loadReviews()
    }
  }

  // Public visitors never see this section's content at all -
  // just a nudge to join, matching the "members only" requirement.
  if (!user) {
    return (
      <div className="review-section">
        <p className="rating-prompt">Sign in as a member to read and write reviews.</p>
      </div>
    )
  }

  return (
    <div className="review-section">
      <h3>Member Reviews</h3>

      <form className="review-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="Share your take on this film..."
          value={myDraft}
          onChange={(e) => setMyDraft(e.target.value)}
          rows={3}
        />
        <button type="submit" disabled={submitting || !myDraft.trim()}>
          {submitting ? 'Posting...' : 'Post Review'}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="rating-prompt">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="rating-prompt">No reviews yet - be the first member to write one.</p>
      ) : (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review-item">
              <div className="review-meta">
                <span className="review-author">{r.profiles?.username}</span>
                {r.profiles?.cinemabox_id && (
                  <span className="cinemabox-id"> · {r.profiles.cinemabox_id}</span>
                )}
                <span className="review-date">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="review-body">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
