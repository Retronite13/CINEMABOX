# Movie Tier List — Phase 2 Scaffold

This is the React + Supabase auth foundation for the movie tier list site.
See the full architecture explanation in chat — this file just covers setup.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your real Supabase values
   (Project Settings -> API in your Supabase dashboard):
   ```
   cp .env.example .env
   ```

3. Run the dev server:
   ```
   npm run dev
   ```
   Open the URL it prints (usually http://localhost:5173).

4. Go to `/auth` in the browser to sign up / log in.

5. After signing up, in the Supabase SQL editor, run:
   ```sql
   update profiles set is_admin = true where username = 'your_username_here';
   ```
   Refresh the home page -- you should see "You are an admin."

## What's included in this phase

- src/lib/supabaseClient.js   -- single shared Supabase connection
- src/context/AuthContext.jsx -- app-wide login state (user, profile, admin flag)
- src/pages/AuthPage.jsx      -- login/signup form
- src/App.jsx                 -- routes + home page showing current auth state

Next phase: movie list display + admin-only "add movie" form.
