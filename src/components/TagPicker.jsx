import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TagPicker({ selectedTagIds, onChange }) {
  const [allTags, setAllTags] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    supabase
      .from('tags')
      .select('*')
      .order('name')
      .then(({ data }) => setAllTags(data ?? []))
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id))
  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )
  const canCreate =
    query.trim().length > 1 &&
    !allTags.some(
      (t) => t.name.toLowerCase() === query.trim().toLowerCase()
    )

  function toggle(tagId) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function remove(tagId) {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name) return
    setCreating(true)

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, slug })
      .select()
      .single()

    setCreating(false)

    if (!error && data) {
      setAllTags((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      )
      onChange([...selectedTagIds, data.id])
      setQuery('')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (canCreate) handleCreate()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="tag-picker" ref={dropdownRef}>
      {selectedTags.length > 0 && (
        <div className="tag-picker-selected">
          {selectedTags.map((tag) => (
            <span key={tag.id} className="tag-pill tag-pill-selected">
              #{tag.name}
              <button
                type="button"
                onClick={() => remove(tag.id)}
                className="tag-pill-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        className="tag-picker-input"
        placeholder="Search or create a tag..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div className="tag-picker-dropdown">
          {filtered.length === 0 && !canCreate && (
            <p className="tag-picker-empty">No tags found.</p>
          )}

          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`tag-picker-option ${
                selectedTagIds.includes(tag.id)
                  ? 'tag-picker-option-active'
                  : ''
              }`}
              onClick={() => toggle(tag.id)}
            >
              <span className="tag-picker-check">
                {selectedTagIds.includes(tag.id) ? '✓' : ''}
              </span>
              #{tag.name}
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              className="tag-picker-create"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creating...' : `+ Create #${query.trim()}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}