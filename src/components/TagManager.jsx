import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function TagManager({ onClose }) {
  const { profile } = useAuth()
  const [tags, setTags] = useState([])
  const [counts, setCounts] = useState({})
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    const [{ data: tagData }, { data: countData }] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('movie_tags').select('tag_id'),
    ])

    setTags(tagData ?? [])

    const c = {}
    for (const row of (countData ?? [])) {
      c[row.tag_id] = (c[row.tag_id] ?? 0) + 1
    }
    setCounts(c)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    setError('')

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const { error } = await supabase.from('tags').insert({ name, slug })
    setCreating(false)

    if (error) {
      setError(
        error.message.includes('unique')
          ? 'That tag already exists.'
          : error.message
      )
    } else {
      setNewName('')
      loadTags()
    }
  }

  async function handleDelete(tag) {
    const count = counts[tag.id] ?? 0
    if (
      count > 0 &&
      !window.confirm(
        `#${tag.name} is used on ${count} movie${count > 1 ? 's' : ''}. Delete it anyway?`
      )
    ) return

    const { error } = await supabase.from('tags').delete().eq('id', tag.id)
    if (!error) loadTags()
  }

  if (!profile?.is_admin) return null

  return (
    <div className="tag-manager">
      <div className="tag-manager-header">
        <h3>Manage Tags</h3>
        <button className="tag-manager-close" onClick={onClose}>✕</button>
      </div>

      <form className="tag-manager-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New tag name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating...' : '+ Create tag'}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <ul className="tag-manager-list">
        {tags.length === 0 && (
          <li className="tag-manager-empty">
            No tags yet — create one above.
          </li>
        )}
        {tags.map((tag) => (
          <li key={tag.id} className="tag-manager-row">
            <span className="tag-manager-name">#{tag.name}</span>
            <span className="tag-manager-count">
              {counts[tag.id] ?? 0} movie{(counts[tag.id] ?? 0) !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="tag-manager-delete"
              onClick={() => handleDelete(tag)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}