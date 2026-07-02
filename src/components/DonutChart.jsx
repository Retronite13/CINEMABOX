import { useEffect, useRef, useState } from 'react'
import { TIERS, TIER_ORDER } from '../lib/tiers'

const SIZE = 200
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// breakdown: [{ tier: 'Legendary', count: 3 }, ...] for all 5 tiers (count can be 0)
// averageScore: number 0-10, shown in the center
export default function DonutChart({ breakdown, averageScore, totalRatings }) {
  const [progress, setProgress] = useState(0) // 0 -> 1, animated on mount
  const frameRef = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const duration = 900 // ms

    function tick(now) {
      const elapsed = now - start
      const linear = Math.min(elapsed / duration, 1)
      // ease-out cubic - starts fast, settles gently, feels like a real "reveal"
      const eased = 1 - Math.pow(1 - linear, 3)
      setProgress(eased)
      if (linear < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    setProgress(0)
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
    // re-run the draw-in animation whenever the underlying data changes
    // (e.g. right after the user submits a new rating)
  }, [breakdown, averageScore])

  if (!totalRatings) {
    return (
      <div className="donut-empty" style={{ width: SIZE, height: SIZE }}>
        <div className="donut-empty-ring" />
        <div className="donut-center">
          <span className="donut-center-value">—</span>
          <span className="donut-center-label">no ratings yet</span>
        </div>
      </div>
    )
  }

  let cumulative = 0

  return (
    <div className="donut-wrap" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* faint full-circle track underneath, so empty tiers still read as "0 slice of the whole" */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(243,236,224,0.08)"
          strokeWidth={STROKE}
        />
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          {TIER_ORDER.map((tierName) => {
            const item = breakdown.find((b) => b.tier === tierName)
            const count = item?.count ?? 0
            if (count === 0) return null

            const fraction = count / totalRatings
            const arcLength = fraction * CIRCUMFERENCE * progress
            const offset = -(cumulative * CIRCUMFERENCE * progress)
            cumulative += fraction

            return (
              <circle
                key={tierName}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={TIERS[tierName].color}
                strokeWidth={STROKE}
                strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            )
          })}
        </g>
      </svg>

      <div className="donut-center">
        <span className="donut-center-value">{averageScore.toFixed(1)}</span>
        <span className="donut-center-label">/ 10 audience</span>
      </div>
    </div>
  )
}
