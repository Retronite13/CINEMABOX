// Bulk mood-tagging via an LLM: reads each movie's description and
// assigns 1-4 moods from your existing "moods" table, based on plot
// and themes - per your rules (never invent moods, JSON only).
//
// Run with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/tag-moods-with-llm.js
//
// Get an Anthropic API key at https://console.anthropic.com (separate
// from any Claude.ai subscription - this is metered, pay-as-you-go API
// usage). Cost note: this uses Haiku, the cheapest/fastest Claude model,
// with short prompts and short JSON outputs - check current per-token
// pricing at https://www.anthropic.com/pricing before running on all
// ~4,800 movies if you want a cost estimate up front.
//
// TEST FIRST on a small batch:
//   ... node scripts/tag-moods-with-llm.js --limit=20
// Check the results in your app, then re-run without --limit for the
// rest. Movies that already have at least one mood tag are skipped
// automatically, so the full run only processes what --limit=20 didn't.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MODEL = 'claude-haiku-4-5-20251001'
const CONCURRENCY = 5 // parallel LLM calls in flight at once

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

async function classifyMovie(movie, validMoodNames) {
  const systemPrompt = `You tag movies with mood categories for a movie discovery website.

Rules:
- Choose between 1 and 4 moods.
- Only choose from this exact list, never invent a mood: ${validMoodNames.join(', ')}
- Base your answer on the movie's plot and themes.
- Return JSON only, in exactly this shape, with no other text: {"moods": ["Mood Name", "Mood Name"]}`

  const userPrompt = `Title: ${movie.title}\nDescription: ${movie.description}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  const rawText = data.content?.[0]?.text ?? ''

  // Defensive parsing: strip markdown code fences if the model added
  // any despite instructions, then parse the JSON.
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed.moods)) {
    throw new Error('Response did not contain a "moods" array.')
  }

  // Enforce the "never invent moods" rule ourselves too, in case the
  // model drifts - silently drop anything that isn't an exact match
  // to a real mood name, rather than trusting the model's output blindly.
  return parsed.moods.filter((m) => validMoodNames.includes(m)).slice(0, 4)
}

async function main() {
  console.log('Loading your moods list...')
  const { data: moods, error: moodsError } = await supabase.from('moods').select('id, name')
  if (moodsError) throw moodsError

  const moodIdByName = new Map(moods.map((m) => [m.name, m.id]))
  const validMoodNames = moods.map((m) => m.name)

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

      const done = tagged + skipped + failed
      if (done % 10 === 0) {
        process.stdout.write(`\r${done} / ${movies.length} processed...`)
      }
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
