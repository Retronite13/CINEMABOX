import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MovieList from '../components/MovieList'
import AddMovieForm from '../components/AddMovieForm'
import SearchBar from '../components/SearchBar'
import TagManager from '../components/TagManager'

export default function HomePage() {
  const { user, profile, signOut } = useAuth()
  const [listKey, setListKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('top')

  const handleSearch = useCallback((q) => setSearchQuery(q), [])

  return (
    <div className="home">

      {/* ── Top navbar ───────────────────────────────────── */}
      <div className="movies-navbar">

        {/* Left: title + nav links */}
        <div className="movies-navbar-left">
          <h1 className="movies-navbar-title">Movie Tier List</h1>
          <Link to="/" className="nav-pill">🏠 Home</Link>
          <Link to="/mood" className="nav-pill">🧭 Find by mood</Link>
        </div>

        {/* Right: admin actions + user */}
        <div className="movies-navbar-right">
          {profile?.is_admin && (
            <>
              <button
                className="nav-btn-gold"
                onClick={() => setShowForm(p => !p)}
              >
                + Add a movie
              </button>
              <button
                className="nav-btn-teal"
                onClick={() => setShowTagManager(p => !p)}
              >
                🏷️ Manage Tags
              </button>
            </>
          )}

          {user ? (
            <>
              <span className="navbar-user">
                {profile?.username ?? user.email}
                {profile?.cinemabox_id && (
                  <span className="cinemabox-id"> · {profile.cinemabox_id}</span>
                )}
              </span>
              <button className="nav-pill nav-pill-logout" onClick={signOut}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/auth" className="nav-btn-gold">Sign in</Link>
          )}
        </div>
      </div>

      {/* ── Admin panels ─────────────────────────────────── */}
      {showTagManager && (
        <TagManager onClose={() => setShowTagManager(false)} />
      )}
      {showForm && (
        <AddMovieForm
          onMovieAdded={() => { setShowForm(false); setListKey(p => p + 1) }}
        />
      )}

      {/* ── Search + sort controls ────────────────────────── */}
      <div className="list-controls">
        <SearchBar onSearch={handleSearch} />
        <div className="sort-tabs">
          <button
            className={sortBy === 'top' ? 'sort-tab sort-tab-active' : 'sort-tab'}
            onClick={() => setSortBy('top')}
          >
            🏆 Top Rated
          </button>
          <button
            className={sortBy === 'latest' ? 'sort-tab sort-tab-active' : 'sort-tab'}
            onClick={() => setSortBy('latest')}
          >
            🆕 Latest Added
          </button>
        </div>
      </div>

      {/* ── Movie grid ───────────────────────────────────── */}
      <MovieList
        key={`${listKey}-${sortBy}`}
        sortBy={sortBy}
        searchQuery={searchQuery}
      />
    </div>
  )
}