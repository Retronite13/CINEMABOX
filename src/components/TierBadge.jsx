import { getTierInfo } from '../lib/tiers'

// Reusable badge - used on movie cards now, and later on the movie detail
// page / mood results page too, so the look stays consistent everywhere.
export default function TierBadge({ tier, percentage }) {
  const info = getTierInfo(tier)

  return (
    <span className="tier-badge" style={{ backgroundColor: info.color }}>
      {info.emoji} {info.label} {percentage != null && `· ${percentage}%`}
    </span>
  )
}
