import { useNavigate } from 'react-router-dom'
import TierBadge from './TierBadge'

// Clicking a card now navigates to /movie/:slug - its own dedicated page
// with a shareable URL. The old modal approach is replaced entirely.
export default function MovieCard({ movie }) {
  const navigate = useNavigate()

  return (
    <button
      className="movie-card"
      onClick={() => navigate(`/movie/${movie.slug}`)}
    >
      {movie.poster_url && (
        <img src={movie.poster_url} alt={movie.title} className="movie-poster" />
      )}

      <div className="movie-info">
        <h3>
          {movie.title}{' '}
          {movie.release_year && (
            <span className="movie-year">({movie.release_year})</span>
          )}
        </h3>

        <TierBadge tier={movie.tier} percentage={movie.percentage} />

        <p className="movie-meta">
          {movie.director && <>Dir. {movie.director} · </>}
          {movie.genre && <>{movie.genre} · </>}
          {movie.rating_count} {movie.rating_count === 1 ? 'rating' : 'ratings'}
        </p>
      </div>
    </button>
  )
}
