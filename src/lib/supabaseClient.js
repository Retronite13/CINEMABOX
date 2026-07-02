import { createClient } from '@supabase/supabase-js'

// These come from your .env file (see .env.example).
// Vite only exposes env vars to the frontend if they're prefixed with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// This single client instance is imported everywhere we need to talk to Supabase
// (auth, database queries, etc). One shared instance = one shared auth session.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
