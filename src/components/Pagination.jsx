// Simple, reusable pager. Shows Prev/Next plus the current page out of
// total, with a few neighboring page numbers - used by both the main
// movie list (server-paginated) and the mood finder (client-paginated).
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  // Build a small window of page numbers around the current page,
  // so this stays usable even with hundreds of pages (no need to
  // render 320 page buttons for 4800 movies / 15 per page).
  const windowSize = 2
  const pages = []
  for (
    let p = Math.max(1, page - windowSize);
    p <= Math.min(totalPages, page + windowSize);
    p++
  ) {
    pages.push(p)
  }

  return (
    <div className="pagination">
      <button disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        ‹ Prev
      </button>

      {pages[0] > 1 && (
        <>
          <button onClick={() => onPageChange(1)}>1</button>
          {pages[0] > 2 && <span className="pagination-ellipsis">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={p === page ? 'pagination-active' : ''}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="pagination-ellipsis">…</span>
          )}
          <button onClick={() => onPageChange(totalPages)}>{totalPages}</button>
        </>
      )}

      <button disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
        Next ›
      </button>
    </div>
  )
}
