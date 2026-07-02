// Supabase Edge Function: refreshes every movie's description, director,
// runtime, genre, and poster from OMDb (an IMDb-data API) on a schedule.
//
// Deploy with:   supabase functions deploy sync-imdb
// Set secret with: supabase secrets set OMDB_API_KEY=your_key_here
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
// by Supabase for every Edge Function - we don't set those ourselves.
// The service role key is what lets this job update EVERY movie,
// bypassing the "admin only" RLS policy - intentional, since this is
// a trusted backend job, not a user-triggered action.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OMDB_API_KEY = Deno.env.get('OMDB_API_KEY')!

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Only movies we've successfully linked to an IMDb id can be refreshed -
  // movies added before this feature existed just won't update until
  // someone re-saves them with a lookup (or you backfill imdb_id by hand).
  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, imdb_id')
    .not('imdb_id', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let updated = 0
  let failed = 0

  for (const movie of movies) {
    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${movie.imdb_id}`
      )
      const data = await res.json()

      if (data.Response === 'False') {
        failed++
        continue
      }

      const runtimeMinutes = parseInt(data.Runtime, 10) || null

      await supabase
        .from('movies')
        .update({
          description: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
          director: data.Director && data.Director !== 'N/A' ? data.Director : null,
          runtime_minutes: runtimeMinutes,
          genre: data.Genre && data.Genre !== 'N/A' ? data.Genre : null,
          poster_url: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
        })
        .eq('id', movie.id)

      updated++
    } catch {
      failed++
    }

    // Be polite to OMDb's free tier - small delay between calls
    // instead of firing them all at once.
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return new Response(
    JSON.stringify({ total: movies.length, updated, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
