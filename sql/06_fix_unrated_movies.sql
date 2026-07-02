-- ============================================
-- MIGRATION: fix tier scoring for unrated movies
-- Run this in Supabase SQL Editor.
--
-- Why: bulk-imported movies (via the new "Fetch New Movies" sync)
-- won't have your own rating yet. The old formula multiplied
-- your_rating directly, so a NULL there made the WHOLE score NULL -
-- every imported movie would wrongly show "Skip It". This version
-- falls back to a community-only score when you haven't rated it.
-- ============================================

create or replace view movie_scores as
select
  m.*,
  scored.community_avg,
  scored.rating_count,
  round(scored.percentage) as percentage,
  case
    when scored.percentage >= 90 then 'Legendary'
    when scored.percentage >= 75 then 'Exceptional'
    when scored.percentage >= 60 then 'Recommended'
    when scored.percentage >= 40 then 'Passable'
    else 'Skip It'
  end as tier
from movies m
cross join lateral (
  select
    coalesce(r.avg_score, m.your_rating, 0) as community_avg,
    coalesce(r.rating_count, 0) as rating_count,
    case
      -- No rating from you yet: score is community opinion alone.
      when m.your_rating is null then coalesce(r.avg_score, 0) * 10
      -- Your usual blend: 60% your verdict, 40% the audience.
      else (m.your_rating * 0.6 + coalesce(r.avg_score, m.your_rating) * 0.4) * 10
    end as percentage
  from (
    select avg(score) as avg_score, count(*) as rating_count
    from ratings
    where ratings.movie_id = m.id
  ) r
) scored;
