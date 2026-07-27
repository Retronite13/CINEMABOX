import { useEffect, useState } from 'react'

// Debounced search bar - waits 300ms after the user stops typing
// before calling onSearch, so we don't fire a Supabase query on
// every single keystroke.
export default function SearchBar({ onSearch, placeholder = 'Search movies...' }) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), 300)
    return () => clearTimeout(timer)
  }, [value, onSearch])

  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => setValue('')}>✕</button>
      )}
    </div>
  )
}
