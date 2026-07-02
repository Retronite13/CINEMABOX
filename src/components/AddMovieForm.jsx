import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { slugify } from '../lib/slugify'
import { useAuth } from '../context/AuthContext'
import { lookupMovieOnImdb } from '../lib/omdb'

// Only ever rendered when profile.is_admin is true (checked by the parent),
// but the database RLS policy from Phase 1 is the *real* security boundary --
// this component just keeps non-admins from seeing the form at all.
export default function AddMovieForm({ onMovieAdded }) {
  const { user } = useAuth()
  const [moods, setMoods] = useState([])
  const [selectedMoods, setSelectedMoods] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    poster_url: '',
    description: '',
    release_year: '',
    runtime_minutes: '',
    director: '',
    genre: '',
    imdb_id: '',
    your_rating: '',
  })

  // Calls OMDb (IMDb data) using whatever's currently in the title field,
  // and fills in everything else automatically - including imdb_id, which
  // is what lets the scheduled sync job keep this movie updated later.
  async function handleImdbLookup() {
    if (!form.title.trim()) {
      setError('Type a title first, then fetch.')
      return
    }

    setError('')
    setLookingUp(true)

    try {
      const result = await lookupMovieOnImdb(form.title, form.release_year || undefined)
      setForm((prev) => ({
        ...prev,
        title: result.title,
        release_year: result.release_year ?? prev.release_year,
        description: result.description,
        director: result.director,
        runtime_minutes: result.runtime_minutes ?? prev.runtime_minutes,
        genre: result.genre,
        poster_url: result.poster_url,
        imdb_id: result.imdb_id,
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLookingUp(false)
    }
  }

  // Load the list of available moods once, to render as checkboxes.
  useEffect(() => {
    supabase
      .from('moods')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load moods:', error.message)
          setError(`Could not load moods: ${error.message}`)
        } else {
          setMoods(data ?? [])
        }
      })
      .catch((err) => {
        console.error('Network error loading moods:', err)
        setError(`Network error loading moods: ${err.message}`)
      })
  }, [])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleMood(moodId) {
    setSelectedMoods((prev) =>
      prev.includes(moodId) ? prev.filter((id) => id !== moodId) : [...prev, moodId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Step 1: insert the movie itself, and ask Postgres to return the new row
    // (specifically its id) so we can link moods to it next.
    const { data: newMovie, error: insertError } = await supabase
      .from('movies')
      .insert({
        title: form.title,
        slug: slugify(form.title),
        poster_url: form.poster_url || null,
        description: form.description || null,
        release_year: form.release_year ? Number(form.release_year) : null,
        runtime_minutes: form.runtime_minutes ? Number(form.runtime_minutes) : null,
        director: form.director || null,
        genre: form.genre || null,
        imdb_id: form.imdb_id || null,
        your_rating: form.your_rating ? Number(form.your_rating) : null,
        added_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    // Step 2: link the selected moods via the movie_moods join table.
    if (selectedMoods.length > 0) {
      const moodRows = selectedMoods.map((moodId) => ({
        movie_id: newMovie.id,
        mood_id: moodId,
      }))

      const { error: moodError } = await supabase.from('movie_moods').insert(moodRows)

      if (moodError) {
        setError(`Movie added, but mood tagging failed: ${moodError.message}`)
        setSubmitting(false)
        return
      }
    }

    // Reset the form for the next entry and tell the parent to refresh the list.
    setForm({
      title: '',
      poster_url: '',
      description: '',
      release_year: '',
      runtime_minutes: '',
      director: '',
      genre: '',
      imdb_id: '',
      your_rating: '',
    })
    setSelectedMoods([])
    setSubmitting(false)
    onMovieAdded?.()
  }

  return (
    <form className="add-movie-form" onSubmit={handleSubmit}>
      <h3>Add a movie</h3>

      <div className="form-row">
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          required
        />
        <button
          type="button"
          className="imdb-fetch-btn"
          onClick={handleImdbLookup}
          disabled={lookingUp}
        >
          {lookingUp ? 'Fetching...' : '🎬 Fetch from IMDb'}
        </button>
      </div>
      {form.imdb_id && <p className="imdb-linked">✓ Linked to IMDb ({form.imdb_id}) - will auto-update</p>}

      <input
        placeholder="Poster URL"
        value={form.poster_url}
        onChange={(e) => updateField('poster_url', e.target.value)}
      />
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => updateField('description', e.target.value)}
      />

      <div className="form-row">
        <input
          type="number"
          placeholder="Release year"
          value={form.release_year}
          onChange={(e) => updateField('release_year', e.target.value)}
        />
        <input
          type="number"
          placeholder="Runtime (min)"
          value={form.runtime_minutes}
          onChange={(e) => updateField('runtime_minutes', e.target.value)}
        />
      </div>

      <input
        placeholder="Director"
        value={form.director}
        onChange={(e) => updateField('director', e.target.value)}
      />

      <input
        placeholder="Genre"
        value={form.genre}
        onChange={(e) => updateField('genre', e.target.value)}
      />

      <input
        type="number"
        step="0.1"
        min="0"
        max="10"
        placeholder="Your rating (0-10)"
        value={form.your_rating}
        onChange={(e) => updateField('your_rating', e.target.value)}
        required
      />

      <div className="mood-picker">
        <p>Tag moods:</p>
        {moods.length === 0 && <p className="rating-prompt">No moods loaded yet.</p>}
        {moods.map((mood) => (
          <label key={mood.id} className="mood-checkbox">
            <input
              type="checkbox"
              checked={selectedMoods.includes(mood.id)}
              onChange={() => toggleMood(mood.id)}
            />
            {mood.emoji} {mood.name}
          </label>
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding...' : 'Add Movie'}
      </button>
    </form>
  )
}
