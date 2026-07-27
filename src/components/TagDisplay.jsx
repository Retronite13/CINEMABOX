import { useNavigate } from 'react-router-dom'

export default function TagDisplay({ tags = [], maxVisible = null }) {
  const navigate = useNavigate()

  if (!tags || tags.length === 0) return null

  const visible = maxVisible ? tags.slice(0, maxVisible) : tags
  const overflow = maxVisible ? tags.length - maxVisible : 0

  return (
    <div className="tag-display">
      {visible.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className="tag-hashtag"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/tag/${tag.slug}`)
          }}
        >
          #{tag.name}
        </button>
      ))}
      {overflow > 0 && (
        <span className="tag-overflow">+{overflow} more</span>
      )}
    </div>
  )
}