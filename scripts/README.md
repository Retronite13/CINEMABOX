# Bulk import: TMDB 5000 dataset -> Supabase

This imports ~4,800 real movies (title, description, release year,
runtime, genre, and director) into your `movies` table in one run.

## What's included

- `tmdb_5000_movies.csv` / `tmdb_5000_credits.csv` - the dataset itself
  (already placed here, no need to re-download)
- `import-tmdb-csv.js` - the import script

Verified against these exact files before delivery: 4,803 movies parsed,
4,773 directors successfully extracted, 4,775 genres extracted, 0 missing
titles, 0 duplicate IDs.

## What's NOT included (and why)

- **Poster images** - this dataset doesn't include poster URLs at all.
  Add one later per-movie via the "Fetch from IMDb" button on the
  Add Movie form, or paste a URL manually.
- **Your own rating** - left blank (null) for every imported movie, since
  that's your personal verdict, not something a dataset can supply. Until
  you rate a movie yourself, its tier reflects audience ratings only
  (the `movie_scores` view already handles this correctly).

## Setup

1. Run `sql/07_tmdb_id.sql` in Supabase SQL Editor first (adds the column
   this script uses to avoid creating duplicates on a re-run).

2. Get your **service role key** (different from the anon key in your
   `.env`!) from Supabase: Settings -> API -> "service_role" (click reveal).
   This key bypasses RLS, which is required to insert thousands of rows
   in one go - never put this key in your frontend `.env` or commit it
   anywhere.

3. In your terminal, in the project root:
   ```
   npm install
   ```
   (picks up the csv-parse package this script needs)

4. Run the import, providing the two env vars inline:

   **Mac/Linux:**
   ```
   SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/import-tmdb-csv.js
   ```

   **Windows (Command Prompt):**
   ```
   set SUPABASE_URL=https://your-project.supabase.co
   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   node scripts/import-tmdb-csv.js
   ```

5. Watch the progress counter. With ~4,800 rows in batches of 250, this
   finishes in well under a minute.

6. Safe to re-run any time - it upserts on `tmdb_id`, so running it again
   updates existing rows instead of duplicating them.

## Posters: `fetch-posters.js`

The TMDB 5000 dataset has no poster images at all. This script backfills
them using each movie's stored `tmdb_id` (looked up from TMDB's image
CDN). New movies you add yourself going forward already have a manual
"Poster URL" field on the Add Movie form - this script is only for the
bulk-imported batch.

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TMDB_API_KEY=your_tmdb_key node scripts/fetch-posters.js
```

Safe to interrupt and re-run - it only targets movies still missing a
poster, so it resumes automatically.

## Moods: `tag-moods-with-llm.js`

Uses Claude (Haiku) to read each movie's description and assign 1-4
moods from your real `moods` table, based on plot/themes - never
inventing a mood outside your existing list.

Needs a separate Anthropic API key from https://console.anthropic.com
(metered, pay-as-you-go - separate from any Claude.ai subscription).
Check current pricing at anthropic.com/pricing if cost-conscious;
Haiku with these short prompts/outputs is the cheapest tier.

**Test on a small batch first:**
```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/tag-moods-with-llm.js --limit=20
```
Check the results in your app (open a few movies, see if the moods make
sense), then run again without `--limit` for the rest - movies already
tagged are automatically skipped, so the full run only processes what's
left.

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/tag-moods-with-llm.js
```

There's also `auto-tag-moods.js`, a free alternative that maps TMDB
genres to moods directly (no API key, no cost, less nuanced) - useful
as a fallback or for comparison.

## Moods (Gemini version): `tag-moods-with-gemini.js`

Same approach as the Claude version above, using Google's Gemini API
instead. Get a free key at https://aistudio.google.com/apikey (no
credit card required for the free tier).

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node scripts/tag-moods-with-gemini.js --limit=20
```

Uses `gemini-2.5-flash-lite` (the current cheap/fast tier as of mid-
2026 - Gemini 2.0 Flash and Flash-Lite were both deprecated and shut
down June 1, 2026, so don't use those model names if you see them in
older guides). Forces real JSON output via Gemini's native JSON mode,
and automatically retries with backoff if it hits a rate-limit error -
free-tier limits are fairly tight and get adjusted by Google often, so
a large run may take a while if you're rate-limited repeatedly. Check
current limits at https://ai.google.dev/gemini-api/docs/pricing if a
run is going slower than expected.

Only use ONE of the two mood-tagging scripts (Claude or Gemini) per
movie - running both would just re-tag movies the first one already
covered, since both skip movies that already have any mood tag.
