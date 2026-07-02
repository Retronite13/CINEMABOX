-- ============================================
-- MIGRATION: member reviews (comments)
-- Run this in Supabase SQL Editor.
-- ============================================

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references movies(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (movie_id, user_id) -- one review per member per movie (they can edit it)
);

alter table reviews enable row level security;

-- Readable ONLY by signed-in members - not by anonymous/public visitors.
-- This is the key difference from movies/ratings, which are public.
create policy "reviews readable by members only" on reviews
  for select
  using (auth.uid() is not null);

-- A member can only write/edit/delete their own review.
create policy "reviews insertable by owner" on reviews
  for insert
  with check (auth.uid() = user_id);

create policy "reviews updatable by owner" on reviews
  for update
  using (auth.uid() = user_id);

create policy "reviews deletable by owner" on reviews
  for delete
  using (auth.uid() = user_id);
