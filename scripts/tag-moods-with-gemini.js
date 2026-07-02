// Bulk mood-tagging via Gemini: reads each movie's description and
// assigns 1-4 moods from your real "moods" table, based on plot and
// themes - per your rules (never invent moods, JSON only).
//
// Run with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node scripts/tag-moods-with-gemini.js
//
// Get a free key at https://aistudio.google.com/apikey (no credit card
// needed for the free tier). Free-tier rate limits get adjusted by
// Google fairly often - check current numbers at
// https://ai.google.dev/gemini-api/docs/pricing if you hit repeated
// rate-limit errors; this script retries automatically on those, but
// very tight limits will still make a 4,800-movie run slow.
//
// TEST FIRST on a small batch:
//   ... node scripts/tag-moods-with-gemini.js --limit=20
// Movies that already have at least one mood tag are skipped
// automatically, so re-running without --limit picks up the rest.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Cheapest/fastest current model, good fit for short classification
// tasks like this. gemini-2.0-flash and gemini-2.0-flash-lite were
// both deprecated and shut down June 1 2026 - if this model name ever
// stops working, check https://ai.google.dev/gemini-api/docs/models
// for the current Flash-Lite alias and swap it in here.
const MODEL = 'gemini-2.5-flash-lite'
// Free tier is ~10 requests/minute. One worker + a mandatory 7-second
// gap between every call keeps us safely under that ceiling.
// At that pace, 4,800 movies takes about 9.5 hours - you can run it
// overnight and let it finish. It resumes automatically from where it
// left off if you stop and restart.
const CONCURRENCY = 1
const REQUEST_GAP_MS = 7000 // 7 seconds between calls = ~8.5 RPM, safely under 10
const MAX_RETRIES = 6 // more retries since the free tier occasionally spikes

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function classifyMovie(movie, validMoodNames) {
  const systemInstruction = `You tag movies with mood categories for a movie discovery website.

Rules:
- Choose between 1 and 4 moods.
- Only choose from this exact list, never invent a mood: ${validMoodNames.join(', ')}
- Base your answer on the movie's plot and themes.
- Respond with JSON only, in exactly this shape: {"moods": ["Mood Name", "Mood Name"]}`

  const userPrompt = `Title: ${movie.title}\nDescription: ${movie.description}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          // Forces a real JSON response instead of relying on the model
          // to follow the "JSON only" instruction unprompted - Gemini
          // supports this natively, unlike some other providers.
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )

    if (res.status === 429) {
      // Rate-limited - back off and try again rather than failing
      // this movie outright, since free-tier limits are easy to hit
      // when running thousands of these in a row.
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500
      await sleep(backoffMs)
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gemini API error (${res.status}): ${text}`)
    }

    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Defensive parsing even with JSON mode on, in case of an edge
    // case response shape.
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed.moods)) {
      throw new Error('Response did not contain a "moods" array.')
    }

    // Enforce "never invent moods" ourselves too, independent of the
    // prompt - drop anything that isn't an exact match to a real mood.
    return parsed.moods.filter((m) => validMoodNames.includes(m)).slice(0, 4)
  }

  throw new Error('Rate-limited repeatedly - gave up after max retries.')
}

async function main() {
  console.log('Loading your moods list...')
  const { data: moods, error: moodsError } = await supabase.from('moods').select('id, name')
  if (moodsError) throw moodsError

  const moodIdByName = new Map(moods.map((m) => [m.name, m.id]))
  const validMoodNames = moods.map((m) => m.name)

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
  const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

  console.log('Finding movies that still need mood tags...')

  const { data: alreadyTaggedRows } = await supabase.from('movie_moods').select('movie_id')
  const alreadyTagged = new Set((alreadyTaggedRows ?? []).map((r) => r.movie_id))

  const { data: allMovies, error: moviesError } = await supabase
    .from('movies')
    .select('id, title, description')
    .not('description', 'is', null)

  if (moviesError) throw moviesError

  let movies = allMovies.filter((m) => !alreadyTagged.has(m.id))
  if (LIMIT) movies = movies.slice(0, LIMIT)

  console.log(`${movies.length} movies to tag${LIMIT ? ` (--limit=${LIMIT})` : ''}.`)

  let tagged = 0
  let skipped = 0
  let failed = 0
  let cursor = 0

  async function worker() {
    while (cursor < movies.length) {
      const movie = movies[cursor++]

      try {
        const chosenMoods = await classifyMovie(movie, validMoodNames)

        if (chosenMoods.length === 0) {
          skipped++
        } else {
          const links = chosenMoods.map((name) => ({
            movie_id: movie.id,
            mood_id: moodIdByName.get(name),
          }))

          const { error } = await supabase.from('movie_moods').insert(links)
          if (error) {
            failed++
          } else {
            tagged++
          }
        }
      } catch (err) {
        failed++
        console.error(`\nFailed on "${movie.title}": ${err.message}`)
      }

      // Mandatory gap AFTER every request - keeps us under free-tier RPM
      // regardless of how fast the call itself resolved. This is the key
      // fix for the 429 storm: don't rely only on backoff, enforce a
      // minimum gap proactively so we never hit the limit in the first place.
      await sleep(REQUEST_GAP_MS)

      const done = tagged + skipped + failed
      const remaining = movies.length - done
      const etaMin = Math.ceil((remaining * REQUEST_GAP_MS) / 60000)
      process.stdout.write(
        `\r${done} / ${movies.length} processed (tagged: ${tagged}, skipped: ${skipped}, failed: ${failed}) — ~${etaMin}m remaining`
      )
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(
    `\nDone. ${tagged} movies tagged, ${skipped} got zero valid moods, ${failed} failed.`
  )
}

main().catch((err) => {
  console.error('Mood tagging failed:', err)
  process.exit(1)
})
