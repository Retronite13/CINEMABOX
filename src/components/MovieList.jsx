import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import MovieGrid from './MovieGrid'
import Pagination from './Pagination'

const PAGE_SIZE = 15

export default function MovieList({ sortBy = 'top', searchQuery = '' }) {
  const [movies, setMovies] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  // Reset to page 1 when sort or search changes
  useEffect(() => { setPage(1) }, [sortBy, searchQuery])

  useEffect(() => {
    fetchMovies()
  }, [sortBy, searchQuery, page])

  async function fetchMovies() {
    setLoading(true)
    setError('')

    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('movie_scores')
        .select('*', { count: 'exact' })

      // Search filter - case-insensitive title match
      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
      }

      // Sort order
      if (sortBy === 'latest') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('percentage', { ascending: false })
      }

      const { data, count, error } = await query.range(from, to)

      if (error) setError(error.message)
      else {
        setMovies(data)
        setTotalCount(count ?? 0)
      }
    } catch (err) {
      setError(err.message || 'Could not load movies.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p>Loading movies...</p>
  if (error) return <p className="error">Error: {error}</p>

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <>
      <p className="results-count">
        {searchQuery
          ? `${totalCount.toLocaleString()} result${totalCount !== 1 ? 's' : ''} for "${searchQuery}"`
          : `${totalCount.toLocaleString()} movies`}
      </p>
      <MovieGrid movies={movies} emptyMessage={searchQuery ? 'No movies found for that search.' : 'No movies added yet.'} />
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      )}
    </>
  )
}
