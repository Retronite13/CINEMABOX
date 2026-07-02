import TierBadge from './TierBadge'

// Pure preview tile - poster, title, tier stamp, meta. No interactive
// elements live on the card itself anymore; clicking anywhere on it
// opens the MovieModal (handled by the parent MovieGrid), which is
// where the chart and rating picker actually live.
export default function MovieCard({ movie, onOpen }) {
  return (
    <button className="movie-card" onClick={() => onOpen(movie)}>
      {movie.poster_url && (
        <img src={movie.poster_url} alt={movie.title} className="movie-poster" />
      )}

      <div className="movie-info">
        <h3>
          {movie.title}{' '}
          {movie.release_year && <span className="movie-year">({movie.release_year})</span>}
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
