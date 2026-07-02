import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchDiscoveryCandidates } from '../lib/tmdb'
import { lookupMovieOnImdb } from '../lib/omdb'
import { slugify } from '../lib/slugify'
import { useAuth } from '../context/AuthContext'

// Admin-only. Pulls a batch of currently popular/top-rated/now-playing/
// upcoming titles from TMDB, skips anything already in your library,
// and imports the rest with full OMDb details - same data pipeline as
// the single "Fetch from IMDb" button, just run across many titles.
//
// Clicking this repeatedly (e.g. once a day) steadily grows your
// catalog with whatever's currently relevant - it is NOT a one-time
// import of "every movie that exists", since no API actually offers
// that as a single fetchable list.
export default function BulkSyncPanel({ onImported }) {
  const { user } = useAuth()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  async function handleSync() {
    setError('')
    setSummary(null)
    setRunning(true)

    try {
      // 1. Know what we already have, so we don't waste OMDb calls
      //    (and quota) re-checking titles we've already imported.
      const { data: existing, error: existingError } = await supabase
        .from('movies')
        .select('title, release_year')

      if (existingError) throw existingError

      const existingKeys = new Set(
        existing.map((m) => `${m.title.toLowerCase()}|${m.release_year ?? ''}`)
      )

      // 2. Pull the current batch from TMDB - this is the "list of
      //    movies" capability OMDb doesn't have on its own.
      setProgress({ stage: 'Checking TMDB for new releases...' })
      const candidates = await fetchDiscoveryCandidates(2)

      const newCandidates = candidates.filter(
        (c) => !existingKeys.has(`${c.title.toLowerCase()}|${c.releaseYear ?? ''}`)
      )

      let imported = 0
      let alreadyHave = 0
      let failed = 0

      for (let i = 0; i < newCandidates.length; i++) {
        const candidate = newCandidates[i]
        setProgress({ checked: i + 1, total: newCandidates.length })

        try {
          // 3. OMDb supplies the real fields - same lookup the manual
          //    "Fetch from IMDb" button on the add-movie form uses.
          const details = await lookupMovieOnImdb(candidate.title, candidate.releaseYear)

          const { error: insertError } = await supabase.from('movies').insert({
            title: details.title,
            slug: `${slugify(details.title)}-${details.release_year ?? Date.now()}`,
            poster_url: details.poster_url || null,
            description: details.description || null,
            release_year: details.release_year,
            runtime_minutes: details.runtime_minutes,
            director: details.director || null,
            genre: details.genre || null,
            imdb_id: details.imdb_id || null,
            your_rating: null, // you haven't rated it yet - shows a community-only score until you do
            added_by: user.id,
          })

          if (insertError) {
            // A unique-constraint hit (same imdb_id or slug) just means
            // we already have this one under a slightly different title.
            if (insertError.message?.toLowerCase().includes('duplicate')) {
              alreadyHave++
            } else {
              failed++
            }
          } else {
            imported++
          }
        } catch {
          failed++ // OMDb had no match for this title/year combination
        }

        // Be polite to OMDb's free tier - small gap between calls.
        await new Promise((resolve) => setTimeout(resolve, 250))
      }

      setSummary({ checked: newCandidates.length, imported, alreadyHave, failed })
      onImported?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="bulk-sync-panel">
      <button onClick={handleSync} disabled={running} className="bulk-sync-btn">
        {running
          ? progress?.total
            ? `Syncing... (${progress.checked}/${progress.total})`
            : progress?.stage ?? 'Working...'
          : '🎬 Fetch New Movies'}
      </button>

      {summary && (
        <p className="bulk-sync-summary">
          Checked {summary.checked} candidate titles · imported{' '}
          <strong>{summary.imported}</strong> · already had {summary.alreadyHave} ·{' '}
          {summary.failed} had no IMDb match.
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
