-- ============================================
-- MIGRATION: CinemaBox ID for verified members
-- Run this in Supabase SQL Editor.
-- ============================================

-- A running counter that hands out the next membership number.
create sequence if not exists cinemabox_id_seq start 1;

-- Add the column if it doesn't already exist.
alter table profiles add column if not exists cinemabox_id text unique;

-- Update the new-user trigger to generate a CinemaBox ID
-- (format: CB-000001, CB-000002, ...) alongside the username.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, cinemabox_id)
  values (
    new.id,
    split_part(new.email, '@', 1),
    'CB-' || lpad(nextval('cinemabox_id_seq')::text, 6, '0')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Backfill a CinemaBox ID for any accounts created before this migration.
update profiles
set cinemabox_id = 'CB-' || lpad(nextval('cinemabox_id_seq')::text, 6, '0')
where cinemabox_id is null;
