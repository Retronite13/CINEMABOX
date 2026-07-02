// One-time bulk fetch: poster images for every movie that has a
// tmdb_id but no poster_url yet (i.e. everything from the CSV import,
// since that dataset didn't include posters at all).
//
// Run locally with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TMDB_API_KEY=... node scripts/fetch-posters.js
//
// New movies you add manually going forward already have a poster URL
// field on the Add Movie form - this script is only for backfilling
// the bulk-imported batch.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_API_KEY = process.env.TMDB_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TMDB_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or TMDB_API_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// TMDB's image CDN - w500 is a good balance of quality vs. load time
// for a card/poster size. (Other options: w200, w342, w780, original.)
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'

async function main() {
  console.log('Finding movies that need a poster...')

  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, tmdb_id, title')
    .not('tmdb_id', 'is', null)
    .is('poster_url', null)

  if (error) {
    console.error('Failed to fetch movies:', error.message)
    process.exit(1)
  }

  console.log(`Found ${movies.length} movies needing a poster.`)

  let updated = 0
  let noPoster = 0
  let failed = 0

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i]

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${TMDB_API_KEY}`
      )
      const data = await res.json()

      if (data.poster_path) {
        const { error: updateError } = await supabase
          .from('movies')
          .update({ poster_url: `${POSTER_BASE}${data.poster_path}` })
          .eq('id', movie.id)

        if (updateError) {
          failed++
        } else {
          updated++
        }
      } else {
        noPoster++ // TMDB itself has no poster for this title
      }
    } catch {
      failed++
    }

    if ((i + 1) % 25 === 0 || i === movies.length - 1) {
      process.stdout.write(`\rProgress: ${i + 1} / ${movies.length}`)
    }

    // TMDB's free tier allows ~40 requests per 10 seconds - this keeps
    // us comfortably under that instead of getting rate-limited partway
    // through a run of thousands of movies.
    await new Promise((resolve) => setTimeout(resolve, 260))
  }

  console.log(
    `\nDone. ${updated} posters added, ${noPoster} had none on TMDB, ${failed} failed.`
  )
}

main().catch((err) => {
  console.error('Poster fetch failed:', err)
  process.exit(1)
})
