import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import MovieGrid from './MovieGrid'
import Pagination from './Pagination'

const PAGE_SIZE = 15 // 3 columns x 5 rows

// Fetches from "movie_scores" (the VIEW from Phase 1) - paginated at the
// DATABASE level via .range(), not fetched-all-then-sliced in JS. With
// thousands of movies now in the table, pulling everything on every
// visit would be slow and wasteful; this only ever requests 15 rows.
export default function MovieList() {
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMovies(page)
    // Scroll to top of the list on page change, so navigating pages
    // doesn't leave you scrolled halfway down a now-different list.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  async function fetchMovies(pageNum) {
    setLoading(true)
    setError('')

    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      const { data, error, count } = await supabase
        .from('movie_scores')
        .select('*', { count: 'exact' })
        .order('percentage', { ascending: false })
        .range(from, to)

      if (error) {
        setError(error.message)
      } else {
        setMovies(data)
        setTotalCount(count ?? 0)
      }
    } catch (err) {
      setError(err.message || 'Could not reach Supabase. Check your .env values.')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (loading) return <p>Loading movies...</p>
  if (error) return <p className="error">Error loading movies: {error}</p>

  return (
    <>
      <p className="results-count">{totalCount.toLocaleString()} movies</p>
      <MovieGrid movies={movies} emptyMessage="No movies added yet." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  )
}
