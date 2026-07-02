// Central place for tier display info, so the emoji/color/order
// is defined once and reused everywhere (card, badge, filters, etc).
// If you ever rename a tier or change its emoji, this is the only file to touch.

export const TIERS = {
  Legendary: { emoji: '👑', label: 'Legendary', color: '#e8a33d', score: 10 },
  Exceptional: { emoji: '🌟', label: 'Exceptional', color: '#b3404c', score: 8 },
  Recommended: { emoji: '🎟️', label: 'Recommended', color: '#3f6b6b', score: 6 },
  Passable: { emoji: '🍿', label: 'Passable', color: '#8a7a52', score: 4 },
  'Skip It': { emoji: '🚫', label: 'Skip It', color: '#5c574e', score: 2 },
}

// The ranked order, highest to lowest verdict - used anywhere we need
// to render all five tiers in sequence (legend, rating picker, chart).
export const TIER_ORDER = ['Legendary', 'Exceptional', 'Recommended', 'Passable', 'Skip It']

// Falls back to a neutral display if a movie somehow has no tier yet
// (e.g. you haven't rated it so the view returned null).
export function getTierInfo(tierName) {
  return TIERS[tierName] ?? { emoji: '❔', label: 'Unrated', color: '#3a3530' }
}

// When a user picks a tier (e.g. "Exceptional"), we store its numeric
// score in the existing "ratings.score" column (1-10, unchanged schema).
export function tierToScore(tierName) {
  return TIERS[tierName]?.score ?? null
}

// When reading scores back out of the database, bucket each one into
// the nearest tier band. Ranges cover the full 1-10 spread (not just
// the exact 2/4/6/8/10 values) so older or hand-entered scores still
// land somewhere sensible.
export function scoreToTier(score) {
  if (score >= 9) return 'Legendary'
  if (score >= 7) return 'Exceptional'
  if (score >= 5) return 'Recommended'
  if (score >= 3) return 'Passable'
  return 'Skip It'
}
