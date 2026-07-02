-- ============================================
-- MIGRATION: use the username chosen at signup
-- Run this in Supabase SQL Editor (after 02_cinemabox_id.sql).
-- ============================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, cinemabox_id)
  values (
    new.id,
    -- Use the username passed in at signup (stored in user metadata).
    -- Falls back to the email prefix only if none was provided.
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'CB-' || lpad(nextval('cinemabox_id_seq')::text, 6, '0')
  );
  return new;
end;
$$ language plpgsql security definer;
