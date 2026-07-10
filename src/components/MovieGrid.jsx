import { useEffect, useState } from 'react'
import MovieCard from './MovieCard'

// Renders a grid of movie cards. No modal state needed here anymore -
// clicking a card navigates to /movie/:slug (its own dedicated page),
// so MovieGrid's only job is to display the grid.
export default function MovieGrid({ movies: initialMovies, emptyMessage = 'No movies found.' }) {
  const [movies, setMovies] = useState(initialMovies)

  useEffect(() => {
    setMovies(initialMovies)
  }, [initialMovies])

  if (movies.length === 0) {
    return <p className="rating-prompt">{emptyMessage}</p>
  }

  return (
    <div className="movie-list">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  )
}
