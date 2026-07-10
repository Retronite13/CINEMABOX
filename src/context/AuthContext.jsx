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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) setProfile(data)
    } catch (err) {
      console.error('fetchProfile error:', err.message)
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

  async function signUp(username, email, password) {
    // Step 1: check if username is already taken before even trying
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      return { error: { message: 'That username is already taken — try another.' } }
    }

    // Step 2: create the auth account
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      console.error('signUp raw error:', JSON.stringify(error))
      const msg = error.message || ''
      if (msg.toLowerCase().includes('already registered') ||
          msg.toLowerCase().includes('user_already_exists')) {
        return { error: { message: 'A profile with this email already exists. Try logging in.' } }
      }
      if (!msg || msg === '{}') {
        return { error: { message: 'A profile with this email already exists. Try logging in.' } }
      }
      return { error: { message: msg } }
    }

    // Step 3: the trigger may or may not have created the profile row.
    // Upsert it explicitly here with the correct username so we're sure
    // it exists and has exactly what the user typed, regardless of
    // what the trigger did or didn't do.
    if (data?.user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, cinemabox_id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        // Trigger didn't fire or failed — create profile manually
        const { data: seqData } = await supabase.rpc('nextval_cinemabox')
        const cinemaboxId = seqData
          ? `CB-${String(seqData).padStart(6, '0')}`
          : `CB-${Date.now()}`

        await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          cinemabox_id: cinemaboxId,
        })
      } else if (existingProfile) {
        // Trigger fired but used email prefix — update to the real username
        await supabase
          .from('profiles')
          .update({ username })
          .eq('id', data.user.id)
      }
    }

    return { error: null }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message || ''
      if (msg.toLowerCase().includes('invalid login') ||
          msg.toLowerCase().includes('invalid credentials')) {
        return { error: { message: 'Incorrect email or password.' } }
      }
      return { error: { message: msg || 'Login failed. Please try again.' } }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = { user, profile, loading, signUp, signIn, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
