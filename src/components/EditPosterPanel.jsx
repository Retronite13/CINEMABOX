import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Admin-only panel for adding/replacing a poster on a movie that has
// none (or whose TMDB poster is wrong/missing).
//
// Supports two inputs:
//   1. Paste a URL  - stored directly as poster_url, works for any
//      publicly reachable image link (TMDB, Wikipedia, IMDb, etc)
//   2. Upload a local file - converted to a base64 data URL and stored
//      in the same poster_url column. No separate file storage needed
//      for the occasional one-off missing poster; the tradeoff is that
//      large images bloat your Supabase row size, so this is best kept
//      to reasonably-sized JPGs (a typical movie poster JPG under 1MB
//      is fine; a raw 10MB TIFF is not). We enforce a 2MB limit client-
//      side to keep things sensible.
export default function EditPosterPanel({ movie, onUpdated }) {
  const { profile } = useAuth()
  const [url, setUrl] = useState(movie.poster_url ?? '')
  const [preview, setPreview] = useState(movie.poster_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  if (!profile?.is_admin) return null

  function handleUrlChange(e) {
    setUrl(e.target.value)
    setPreview(e.target.value)
    setError('')
    setSuccess('')
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError('File is over 2MB. Use a smaller JPG, or paste a URL instead.')
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      const dataUrl = evt.target.result
      setUrl(dataUrl)
      setPreview(dataUrl)
      setError('')
      setSuccess('')
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!url.trim()) {
      setError('Paste a URL or upload a file first.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const { data, error: updateError } = await supabase
      .from('movies')
      .update({ poster_url: url.trim() })
      .eq('id', movie.id)
      .select()
      .single()

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Poster saved.')
      onUpdated?.({ ...movie, poster_url: url.trim() })
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError('')
    setSuccess('')

    await supabase
      .from('movies')
      .update({ poster_url: null })
      .eq('id', movie.id)

    setSaving(false)
    setUrl('')
    setPreview('')
    setSuccess('Poster removed.')
    onUpdated?.({ ...movie, poster_url: null })
  }

  return (
    <div className="edit-poster-panel">
      <p className="edit-poster-label">Admin: Edit poster</p>

      {preview && (
        <img src={preview} alt="Preview" className="edit-poster-preview" />
      )}

      <div className="edit-poster-inputs">
        <input
          type="url"
          placeholder="Paste poster URL..."
          value={url.startsWith('data:') ? '' : url}
          onChange={handleUrlChange}
        />
        <span className="edit-poster-or">or</span>
        <button
          type="button"
          className="edit-poster-upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload from computer
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="edit-poster-success">{success}</p>}

      <div className="edit-poster-actions">
        <button
          type="button"
          className="edit-poster-save-btn"
          onClick={handleSave}
          disabled={saving || !url.trim()}
        >
          {saving ? 'Saving...' : 'Save poster'}
        </button>
        {movie.poster_url && (
          <button
            type="button"
            className="edit-poster-remove-btn"
            onClick={handleRemove}
            disabled={saving}
          >
            Remove poster
          </button>
        )}
      </div>
    </div>
  )
}
