-- ============================================
-- MIGRATION: tmdb_id column for bulk-import dedup
-- Run this in Supabase SQL Editor.
--
-- The Kaggle dataset's "id" column is the movie's TMDB id - storing
-- it lets us safely re-run the import (upsert instead of duplicating)
-- and gives a clean link back to TMDB for any future enrichment.
-- ============================================

alter table movies add column if not exists tmdb_id integer unique;
