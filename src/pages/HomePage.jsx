import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MovieList from '../components/MovieList'
import AddMovieForm from '../components/AddMovieForm'
import BulkSyncPanel from '../components/BulkSyncPanel'
import TierLegend from '../components/TierLegend'

export default function HomePage() {
  const { user, profile, signOut } = useAuth()

  // Bumping this number forces MovieList to re-mount and re-fetch,
  // which is the simplest way to refresh the list after a new movie is added.
  const [listKey, setListKey] = useState(0)
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="home">
      <div className="home-header">
        <h1>Movie Tier List</h1>
        <Link to="/mood" className="mood-nav-link">🧭 Find by mood</Link>
      </div>

      {user ? (
        <div className="user-bar">
          <p>
            {profile?.username ?? user.email}
            {profile?.cinemabox_id && (
              <span className="cinemabox-id"> · {profile.cinemabox_id}</span>
            )}
          </p>
          {profile?.is_admin && <p className="admin-badge">You are an admin</p>}
          <button onClick={signOut}>Log out</button>
        </div>
      ) : (
        <div className="user-bar">
          <p>You're browsing as a guest. </p>
          <Link to="/auth" className="auth-inline-link">Sign in to rate movies</Link>
        </div>
      )}

      {profile?.is_admin && (
        <div className="admin-panel">
          <div className="admin-panel-buttons">
            <button onClick={() => setShowForm((prev) => !prev)}>
              {showForm ? 'Hide form' : '+ Add a movie'}
            </button>

            <BulkSyncPanel onImported={() => setListKey((prev) => prev + 1)} />
          </div>

          {showForm && (
            <AddMovieForm
              onMovieAdded={() => {
                setShowForm(false)
                setListKey((prev) => prev + 1) // triggers MovieList refresh
              }}
            />
          )}
        </div>
      )}

      <TierLegend />

      <MovieList key={listKey} />
    </div>
  )
}
