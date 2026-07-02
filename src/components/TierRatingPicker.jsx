import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { TIERS, TIER_ORDER, tierToScore, scoreToTier } from '../lib/tiers'

// Lets a signed-in user pick one of the five tiers as their verdict.
// Picking a tier submits immediately (no separate "submit" step) -
// converts to a numeric score under the hood so the existing
// "ratings.score" column (1-10) doesn't need a schema change.
export default function TierRatingPicker({ movieId, onRated }) {
  const { user, profile } = useAuth()
  const [myTier, setMyTier] = useState(null)
  const [submittingTier, setSubmittingTier] = useState(null)

  // Load this user's existing rating for this movie, if any,
  // so their previous pick stays highlighted.
  useEffect(() => {
    if (!user) return

    supabase
      .from('ratings')
      .select('score')
      .eq('movie_id', movieId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyTier(scoreToTier(data.score))
      })
  }, [movieId, user])

  async function handlePick(tierName) {
    if (!user) return

    setSubmittingTier(tierName)
    const score = tierToScore(tierName)

    // upsert: insert this user's first rating, or overwrite their
    // previous one - the unique(movie_id, user_id) constraint on
    // "ratings" from Phase 1 is what makes this safe.
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { movie_id: movieId, user_id: user.id, score },
        { onConflict: 'movie_id,user_id' }
      )

    setSubmittingTier(null)

    if (error) {
      alert(error.message)
    } else {
      setMyTier(tierName)
      onRated?.() // tells the modal to refresh the chart + aggregate score
    }
  }

  if (!user) {
    return (
      <p className="rating-prompt">
        Sign in and verify your CinemaBox ID to rate this film.
      </p>
    )
  }

  return (
    <div className="tier-picker">
      <p className="tier-picker-label">
        {myTier ? `Your verdict, ${profile?.cinemabox_id ?? profile?.username}:` : 'Cast your verdict:'}
      </p>
      <div className="tier-picker-buttons">
        {TIER_ORDER.map((name) => {
          const info = TIERS[name]
          const isActive = myTier === name
          return (
            <button
              key={name}
              type="button"
              className={`tier-picker-btn ${isActive ? 'tier-picker-btn-active' : ''}`}
              style={isActive ? { borderColor: info.color, color: info.color } : undefined}
              disabled={submittingTier !== null}
              onClick={() => handlePick(name)}
            >
              <span className="tier-picker-emoji">{info.emoji}</span>
              {info.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
