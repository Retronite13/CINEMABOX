-- ============================================
-- MIGRATION: IMDb auto-sync support
-- Run this in Supabase SQL Editor.
-- ============================================

-- New columns: genre (you asked for it), and imdb_id, which is the
-- key to everything else here - it's how the background sync job
-- knows exactly which IMDb record to re-fetch for each movie.
alter table movies add column if not exists genre text;
alter table movies add column if not exists imdb_id text unique;

-- ============================================
-- Extensions needed to run a scheduled job from inside Postgres.
-- pg_cron = the scheduler itself.
-- pg_net  = lets a cron job make an HTTP call (to our Edge Function).
-- ============================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================
-- The actual schedule. Runs daily at 03:00 UTC.
--
-- BEFORE RUNNING: replace YOUR-PROJECT-REF and YOUR-ANON-KEY below.
--   - Project ref: Supabase dashboard URL, e.g. https://abcdefgh.supabase.co -> "abcdefgh"
--   - Anon key: Settings -> API -> the same "anon public" key already in your .env
--
-- This can be re-run safely - cron.schedule with the same job name
-- replaces the previous schedule rather than duplicating it.
-- ============================================
select cron.schedule(
  'daily-imdb-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-imdb',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR-ANON-KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it's scheduled:
--   select * from cron.job;
-- To check past run results:
--   select * from cron.job_run_details order by start_time desc limit 5;
