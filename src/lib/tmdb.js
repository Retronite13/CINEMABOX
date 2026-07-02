// TMDB (themoviedb.org) is a DIFFERENT free movie database from OMDb.
// We only use it for one thing OMDb can't do at all: listing movies.
// (OMDb can only answer "tell me about THIS exact title" - it has no
// "show me a list of movies" endpoint whatsoever.)
//
// The plan: pull candidate titles+years from TMDB's discovery feeds,
// then hand each one to the existing OMDb lookup (lib/omdb.js) to get
// the real description/director/runtime/genre/imdb_id - keeping a
// single source of truth for movie *details*, and using TMDB purely
// as a feed of "what's currently out there."

const CATEGORIES = ['popular', 'top_rated', 'now_playing', 'upcoming']

// Returns a deduplicated list of { tmdbId, title, releaseYear } across
// all four categories, `pagesPerCategory` pages deep (20 results/page).
export async function fetchDiscoveryCandidates(pagesPerCategory = 2) {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY

  if (!apiKey) {
    throw new Error('Missing VITE_TMDB_API_KEY in your .env file.')
  }

  const seenTmdbIds = new Set()
  const candidates = []

  for (const category of CATEGORIES) {
    for (let page = 1; page <= pagesPerCategory; page++) {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${category}?api_key=${apiKey}&page=${page}`
      )
      const data = await res.json()

      if (!data.results) continue

      for (const movie of data.results) {
        if (seenTmdbIds.has(movie.id)) continue
        seenTmdbIds.add(movie.id)

        const releaseYear = movie.release_date
          ? parseInt(movie.release_date.slice(0, 4), 10)
          : null

        candidates.push({ tmdbId: movie.id, title: movie.title, releaseYear })
      }
    }
  }

  return candidates
}
