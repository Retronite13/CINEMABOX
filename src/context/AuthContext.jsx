import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error) setProfile(data)
    } catch (err) {
      console.error('Failed to fetch profile:', err.message)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Creates the account with a username + password. Supabase emails a
  // confirmation link automatically (since "Confirm email" is on) -
  // the person clicks it, then logs in below. The "handle_new_user"
  // trigger already creates their profile + CinemaBox ID at this point,
  // it just stays unusable for login until the link is clicked.
  async function signUp(username, email, password) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }, // read by the handle_new_user() trigger
      },
    })

    if (!error) return { error: null }

    // Log the raw error so the real cause (e.g. an email-sending
    // failure) is visible in the browser console, since Supabase's
    // own error message for that case can come back nearly empty.
    console.error('signUp error:', error)

    if (error.message?.toLowerCase().includes('profiles_username_key')) {
      return { error: { message: 'That username is already taken.' } }
    }

    if (!error.message || error.message === '{}') {
      return {
        error: {
          message:
            'Could not send the verification email. This usually means Supabase\'s email sending limit was hit - see the chat for how to fix it.',
        },
      }
    }

    return { error }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = { user, profile, loading, signUp, signIn, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
