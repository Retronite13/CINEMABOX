import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { slugify } from '../lib/slugify'
import TagPicker from './TagPicker'

export default function EditMoviePanel({ movie, onUpdated, onClose }) {
  const { profile } = useAuth()

  const [form, setForm] = useState({
    title: movie.title ?? '',
    description: movie.description ?? '',
    director: movie.director ?? '',
    runtime_minutes: movie.runtime_minutes ?? '',
    genre: movie.genre ?? '',
    release_year: movie.release_year ?? '',
    your_rating: movie.your_rating ?? '',
  })

  const [allMoods, setAllMoods] = useState([])
  const [selectedMoods, setSelectedMoods] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  

  useEffect(() => {
    async function load() {
      const [{ data: moods }, { data: linkedMoods }, { data: linkedTags }] = await Promise.all([
        supabase.from('moods').select('*').order('name'),
        supabase.from('movie_moods').select('mood_id').eq('movie_id', movie.id),
        supabase.from('movie_tags').select('tag_id').eq('movie_id', movie.id),
      ])
      setAllMoods(moods ?? [])
      // parseInt ensures mood IDs are always integers, never strings.
      // Without this, Supabase's client can pass them as strings which
      // Postgres then rejects with a type mismatch on the uuid column.
      setSelectedMoods((linkedMoods ?? []).map((r) => parseInt(r.mood_id, 10)))
      setSelectedTagIDs((linkedTags ?? []).map((r) => r.tag_id))
    }
    load()
  }, [movie.id])

  if (!profile?.is_admin) return null

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleMood(moodId) {
    const id = parseInt(moodId, 10)
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Step 1: update the movie row itself
    const { data: updated, error: updateError } = await supabase
      .from('movies')
      .update({
        title: form.title.trim(),
        slug: slugify(form.title.trim()),
        description: form.description.trim() || null,
        director: form.director.trim() || null,
        runtime_minutes: form.runtime_minutes ? Number(form.runtime_minutes) : null,
        genre: form.genre.trim() || null,
        release_year: form.release_year ? Number(form.release_year) : null,
        your_rating: form.your_rating !== '' ? Number(form.your_rating) : null,
      })
      .eq('id', movie.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Step 2: clear all existing mood links then re-insert fresh.
    // Delete now works because the admin delete RLS policy is in place.
    // We use plain insert (not upsert) since we just cleared the table,
    // and parseInt on mood IDs prevents the uuid type mismatch error.
    const { error: deleteError } = await supabase
      .from('movie_moods')
      .delete()
      .eq('movie_id', movie.id)

    if (deleteError) {
      setError(`Saved movie details but mood delete failed: ${deleteError.message}`)
      setSaving(false)
      return
    }

    if (selectedMoods.length > 0) {
      const moodRows = selectedMoods.map((moodId) => ({
        movie_id: movie.id,
        mood_id: parseInt(moodId, 10),
      }))

      const { error: insertError } = await supabase
        .from('movie_moods')
        .insert(moodRows)

      if (insertError) {
        setError(`Saved movie details but mood insert failed: ${insertError.message}`)
        setSaving(false)
        return
      }
    }

    // Step 3: replace custom tags
    await supabase.from('movie_tags').delete().eq('movie_id', movie.id)
    if (selectedTagIds.length > 0) {
      const { error: tagError } = await supabase.from('movie_tags').insert(
        selectedTagIds.map(tagId => ({ movie_id: movie.id, tag_id: tagId }))
      )
      if (tagError) {
        setError(`Saved but tag update failed: ${tagError.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onUpdated?.(updated)
    onClose?.()
  }

  return (
    <form className="edit-movie-form" onSubmit={handleSave}>
      <h3>Edit movie</h3>

      <label className="edit-field-label">Title</label>
      <input
        value={form.title}
        onChange={(e) => updateField('title', e.target.value)}
        required
      />

      <label className="edit-field-label">Description</label>
      <textarea
        value={form.description}
        onChange={(e) => updateField('description', e.target.value)}
        rows={4}
      />

      <label className="edit-field-label">Director</label>
      <input
        value={form.director}
        onChange={(e) => updateField('director', e.target.value)}
      />

      <div className="form-row">
        <div className="edit-field-col">
          <label className="edit-field-label">Release year</label>
          <input
            type="number"
            value={form.release_year}
            onChange={(e) => updateField('release_year', e.target.value)}
          />
        </div>
        <div className="edit-field-col">
          <label className="edit-field-label">Runtime (min)</label>
          <input
            type="number"
            value={form.runtime_minutes}
            onChange={(e) => updateField('runtime_minutes', e.target.value)}
          />
        </div>
      </div>

      <label className="edit-field-label">Genre</label>
      <input
        value={form.genre}
        onChange={(e) => updateField('genre', e.target.value)}
      />

      <label className="edit-field-label">Your rating (0–10)</label>
      <input
        type="number"
        step="0.1"
        min="0"
        max="10"
        value={form.your_rating}
        onChange={(e) => updateField('your_rating', e.target.value)}
      />

      <label className="edit-field-label">Mood tags</label>
      <div className="mood-picker">
        {allMoods.map((mood) => (
          <label key={mood.id} className="mood-checkbox">
            <input
              type="checkbox"
              checked={selectedMoods.includes(parseInt(mood.id, 10))}
              onChange={() => toggleMood(mood.id)}
            />
            {mood.emoji} {mood.name}
          </label>
        ))}
      </div>

      <label className="edit-field-label">Custom tags</label>
      <TagPicker selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />

      {error && <p className="auth-error">{error}</p>}

      <div className="edit-movie-actions">
        <button type="submit" className="edit-movie-save-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" className="edit-movie-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
