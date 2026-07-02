// One-time bulk import: TMDB 5000 dataset (movies + credits CSVs) -> Supabase.
//
// Run locally with:
//   node scripts/import-tmdb-csv.js
//
// Needs two env vars (NOT your frontend .env - these go in your shell,
// or a separate scripts/.env.local that's gitignored, since the service
// role key bypasses RLS entirely and must never reach the browser bundle):
//   SUPABASE_URL=https://your-project.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   (Settings -> API -> service_role)
//
// Place tmdb_5000_movies.csv and tmdb_5000_credits.csv in this same
// scripts/ folder before running (or edit the paths below).

import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MOVIES_CSV_PATH = new URL('./tmdb_5000_movies.csv', import.meta.url)
const CREDITS_CSV_PATH = new URL('./tmdb_5000_credits.csv', import.meta.url)
const BATCH_SIZE = 250

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Safely parses the JSON-shaped string columns (genres, crew, etc).
// These come through as Python-style dict strings re-quoted for CSV -
// csv-parse already un-escapes the doubled quotes, so by the time we
// see them here they're valid JSON.
function safeJsonParse(str, fallback) {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

function extractDirector(crewJson) {
  const crew = safeJsonParse(crewJson, [])
  const director = crew.find((person) => person.job === 'Director')
  return director?.name ?? null
}

function extractGenres(genresJson) {
  const genres = safeJsonParse(genresJson, [])
  return genres.map((g) => g.name).join(', ') || null
}

async function main() {
  console.log('Reading CSVs...')

  const moviesRaw = parse(readFileSync(MOVIES_CSV_PATH), {
    columns: true,
    skip_empty_lines: true,
  })

  const creditsRaw = parse(readFileSync(CREDITS_CSV_PATH), {
    columns: true,
    skip_empty_lines: true,
  })

  // Index credits by movie_id for O(1) lookup while merging.
  const creditsById = new Map()
  for (const row of creditsRaw) {
    creditsById.set(row.movie_id, row)
  }

  console.log(`Loaded ${moviesRaw.length} movies, ${creditsRaw.length} credits.`)

  const rows = []

  for (const m of moviesRaw) {
    // Skip rows with no usable title - nothing to import.
    if (!m.title?.trim()) continue

    const credits = creditsById.get(m.id)
    const releaseYear = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null
    const runtime = m.runtime ? Math.round(parseFloat(m.runtime)) : null
    const tmdbId = parseInt(m.id, 10)

    // A meaningful chunk of this dataset is from the early 2010s and
    // earlier and won't have a poster_path in THIS particular CSV
    // (the classic dataset doesn't include one at all) - left null
    // here intentionally; can be filled in later via the per-movie
    // "Fetch from IMDb" button if you want a poster for a given title.
    rows.push({
      title: m.title.trim(),
      slug: `${slugify(m.title)}-${tmdbId}`,
      description: m.overview?.trim() || (m.tagline?.trim() || null),
      release_year: Number.isInteger(releaseYear) ? releaseYear : null,
      runtime_minutes: Number.isInteger(runtime) ? runtime : null,
      director: credits ? extractDirector(credits.crew) : null,
      genre: extractGenres(m.genres),
      tmdb_id: Number.isInteger(tmdbId) ? tmdbId : null,
      poster_url: null,
      your_rating: null,
      imdb_id: null,
    })
  }

  console.log(`Prepared ${rows.length} rows. Upserting in batches of ${BATCH_SIZE}...`)

  let imported = 0
  let failedBatches = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // onConflict: tmdb_id - re-running this script updates existing
    // rows instead of erroring out or duplicating them.
    const { error } = await supabase
      .from('movies')
      .upsert(batch, { onConflict: 'tmdb_id' })

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
      failedBatches++
    } else {
      imported += batch.length
      process.stdout.write(`\rImported ${imported} / ${rows.length}...`)
    }
  }

  console.log(`\nDone. ${imported} rows upserted. ${failedBatches} batches failed.`)
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
