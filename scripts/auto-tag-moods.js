// One-time bulk tagging: assigns moods to every movie automatically,
// based on a genre -> mood mapping. Run AFTER the TMDB CSV import.
//
// Run with the same env vars as the CSV import:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/auto-tag-moods.js
//
// Safe to re-run: duplicate (movie_id, mood_id) pairs are silently
// skipped via the table's existing primary key, not re-inserted.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Maps each TMDB genre string to one or more of YOUR moods (must match
// the "name" values already in your "moods" table from Phase 1). A
// genre can map to multiple moods - e.g. a movie can be both
// "Adrenaline Rush" and "Mind-Bending".
const GENRE_TO_MOODS = {
  Action: ['Adrenaline Rush'],
  Adventure: ['Adrenaline Rush'],
  Animation: ['Cozy Night In'],
  Comedy: ['Need a Laugh'],
  Crime: ['Mind-Bending'],
  Documentary: ['Need Inspiration'],
  Drama: ['Want to Cry'],
  Family: ['Cozy Night In'],
  Fantasy: ['Mind-Bending'],
  History: ['Feeling Nostalgic'],
  Horror: ["Can't Sleep"],
  Music: ['Date Night'],
  Mystery: ['Mind-Bending'],
  Romance: ['Date Night'],
  'Science Fiction': ['Mind-Bending'],
  'TV Movie': ['Cozy Night In'],
  Thriller: ['Adrenaline Rush', "Can't Sleep"],
  War: ['Need Inspiration'],
  Western: ['Feeling Nostalgic'],
}

async function main() {
  console.log('Loading moods...')
  const { data: moods, error: moodsError } = await supabase.from('moods').select('id, name')
  if (moodsError) throw moodsError

  const moodIdByName = new Map(moods.map((m) => [m.name, m.id]))

  console.log('Loading movies...')
  const { data: movies, error: moviesError } = await supabase
    .from('movies')
    .select('id, genre')
    .not('genre', 'is', null)

  if (moviesError) throw moviesError

  console.log(`Tagging ${movies.length} movies...`)

  const links = []

  for (const movie of movies) {
    // genre is stored as a comma-separated string, e.g. "Action, Drama"
    const genreNames = movie.genre.split(',').map((g) => g.trim())

    const moodNamesForMovie = new Set()
    for (const genreName of genreNames) {
      const mappedMoods = GENRE_TO_MOODS[genreName]
      if (mappedMoods) {
        mappedMoods.forEach((m) => moodNamesForMovie.add(m))
      }
    }

    for (const moodName of moodNamesForMovie) {
      const moodId = moodIdByName.get(moodName)
      if (moodId) {
        links.push({ movie_id: movie.id, mood_id: moodId })
      }
    }
  }

  console.log(`Prepared ${links.length} movie-mood links. Inserting in batches...`)

  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE)

    // ignoreDuplicates: true -> re-running this script is safe, it
    // just skips (movie_id, mood_id) pairs that already exist.
    const { error } = await supabase
      .from('movie_moods')
      .upsert(batch, { onConflict: 'movie_id,mood_id', ignoreDuplicates: true })

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`\rLinked ${inserted} / ${links.length}...`)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Auto-tagging failed:', err)
  process.exit(1)
})
