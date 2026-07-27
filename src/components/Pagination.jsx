export default function Pagination({ page, totalPages, onPageChange }) {
  function getPages() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  return (
    <div className="pagination">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}>← Prev</button>
      {getPages().map((p, i) =>
        p === '...'
          ? <span key={`e${i}`} className="pagination-ellipsis">…</span>
          : <button key={p} onClick={() => onPageChange(p)} className={p === page ? 'pagination-active' : ''}>{p}</button>
      )}
      <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next →</button>
    </div>
  )
}
