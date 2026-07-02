// Looks up a single movie by title on OMDb (a free API built on IMDb's data).
// Used when adding a movie, so you only type the title - everything else
// (description, director, runtime, genre, poster, and critically the
// imdb_id) gets filled in automatically. That imdb_id is what later lets
// the scheduled sync job (supabase/functions/sync-imdb) refresh this exact
// movie automatically, without re-guessing from the title.
export async function lookupMovieOnImdb(title, year) {
  const apiKey = import.meta.env.VITE_OMDB_API_KEY

  if (!apiKey) {
    throw new Error('Missing VITE_OMDB_API_KEY in your .env file.')
  }

  const params = new URLSearchParams({ apikey: apiKey, t: title })
  if (year) params.set('y', year)

  const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`)
  const data = await res.json()

  if (data.Response === 'False') {
    throw new Error(data.Error || 'Movie not found on IMDb.')
  }

  return {
    imdb_id: data.imdbID,
    title: data.Title,
    release_year: parseInt(data.Year, 10) || null,
    description: data.Plot !== 'N/A' ? data.Plot : '',
    director: data.Director !== 'N/A' ? data.Director : '',
    runtime_minutes: parseInt(data.Runtime, 10) || null,
    genre: data.Genre !== 'N/A' ? data.Genre : '',
    poster_url: data.Poster !== 'N/A' ? data.Poster : '',
  }
}
