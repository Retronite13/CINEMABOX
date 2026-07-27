import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import MovieGrid from '../components/MovieGrid'

export default function TagPage() {
  const { slug } = useParams()
  const [tag, setTag] = useState(null)
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: tagData, error: tagError } = await supabase
        .from('tags')
        .select('*')
        .eq('slug', slug)
        .single()

      if (tagError || !tagData) {
        setError('Tag not found.')
        setLoading(false)
        return
      }

      setTag(tagData)

      const { data: links } = await supabase
        .from('movie_tags')
        .select('movie_id')
        .eq('tag_id', tagData.id)

      if (!links || links.length === 0) {
        setMovies([])
        setLoading(false)
        return
      }

      const ids = links.map((r) => r.movie_id)

      const { data: movieData } = await supabase
        .from('movie_scores')
        .select('*')
        .in('id', ids)
        .order('percentage', { ascending: false })

      setMovies(movieData ?? [])
      setLoading(false)
    }

    load()
  }, [slug])

  if (loading) {
    return (
      <div className="movie-page-shell">
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="movie-page-shell">
        <p>{error}</p>
        <Link to="/movies" className="back-link">← Back to all movies</Link>
      </div>
    )
  }

  return (
    <div className="movie-page-shell">
      <Link to="/movies" className="back-link">← Back to all movies</Link>

      <div className="tag-page-header">
        <h1 className="tag-page-title">#{tag?.name}</h1>
        <p className="tag-page-count">
          {movies.length} {movies.length === 1 ? 'movie' : 'movies'}
        </p>
      </div>

      <MovieGrid
        movies={movies}
        emptyMessage={`No movies tagged with #${tag?.name} yet.`}
      />
    </div>
  )
}