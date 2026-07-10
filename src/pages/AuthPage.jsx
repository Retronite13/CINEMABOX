import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signUp, signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSignUp) {
      const { error } = await signUp(username, email, password)
      setLoading(false)
      if (error) {
        setError(error.message)
      } else {
        // With email confirmation OFF, the account is active immediately
        // so we sign them in straight away - no "check your email" step.
        const { error: signInError } = await signIn(email, password)
        if (signInError) {
          setError(signInError.message)
        } else {
          navigate('/')
        }
      }
    } else {
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) {
        setError(error.message)
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="auth-page">
      <h2>🎬 {isSignUp ? 'Join CinemaBox' : 'Member Log In'}</h2>

      <form onSubmit={handleSubmit}>
        {isSignUp && (
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={isSignUp ? 'Create a password' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <button
        className="auth-toggle"
        onClick={() => { setError(''); setIsSignUp(!isSignUp) }}
      >
        {isSignUp ? 'Already a member? Log in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
