import { TIERS, TIER_ORDER } from '../lib/tiers'

// The five tiers ARE a real ranked sequence (highest to lowest verdict),
// so showing them in order here is informative, not decorative.
export default function TierLegend() {
  return (
    <div className="tier-legend">
      {TIER_ORDER.map((name) => {
        const info = TIERS[name]
        return (
          <span
            key={name}
            className="tier-badge tier-legend-item"
            style={{ backgroundColor: info.color }}
          >
            {info.emoji} {info.label}
          </span>
        )
      })}
    </div>
  )
}
