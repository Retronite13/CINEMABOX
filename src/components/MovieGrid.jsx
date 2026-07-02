import { useEffect, useState } from 'react'
import MovieCard from './MovieCard'
import MovieModal from './MovieModal'

// Takes a list of movies (already paginated by the parent - either
// server-side via .range() in MovieList, or client-side sliced in
// MoodFinderPage) and handles displaying them as cards plus opening/
// closing the detail modal. This component does NOT paginate itself -
// it just renders whatever page of movies it's handed, so pagination
// logic lives in exactly one place per caller instead of two competing
// implementations fighting each other.
export default function MovieGrid({ movies: initialMovies, emptyMessage = 'No movies found.' }) {
  const [movies, setMovies] = useState(initialMovies)
  const [selectedId, setSelectedId] = useState(null)

  // Keep in sync if the parent re-fetches (e.g. a new movie was added,
  // a different mood was clicked, or the page changed).
  useEffect(() => {
    setMovies(initialMovies)
  }, [initialMovies])

  function handleMovieUpdated(updated) {
    setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  const selectedMovie = movies.find((m) => m.id === selectedId) ?? null

  if (movies.length === 0) {
    return <p>{emptyMessage}</p>
  }

  return (
    <>
      <div className="movie-list">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} onOpen={(m) => setSelectedId(m.id)} />
        ))}
      </div>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedId(null)}
          onUpdated={handleMovieUpdated}
        />
      )}
    </>
  )
}
