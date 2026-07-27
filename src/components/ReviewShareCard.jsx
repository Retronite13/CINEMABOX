import { useEffect, useRef, useState } from 'react'
import { TIERS, scoreToTier } from '../lib/tiers'

// Generates a 9:16 Instagram story card (1080x1920) using Canvas API.
// Shows: movie poster, gradient overlay, tier stamp, rating, review text,
// reviewer name + CinemaBox ID, and CinemaBox branding at the bottom.
export default function ReviewShareCard({ movie, review, reviewer, onClose }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(true)
  const [error, setError] = useState('')

  const W = 1080
  const H = 1920

  useEffect(() => {
    drawCard()
  }, [])

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let currentY = y

    for (const word of words) {
      const testLine = line + word + ' '
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), x, currentY)
        line = word + ' '
        currentY += lineHeight
        // Stop if we've run out of vertical space
        if (currentY > H - 220) {
          ctx.fillText('...', x, currentY)
          return currentY
        }
      } else {
        line = testLine
      }
    }
    ctx.fillText(line.trim(), x, currentY)
    return currentY + lineHeight
  }

  async function drawCard() {
    setGenerating(true)
    setError('')
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = W
    canvas.height = H

    // ── Background ──────────────────────────────────────────────────
    ctx.fillStyle = '#14110f'
    ctx.fillRect(0, 0, W, H)

    // ── Film grain texture (noise dots) ─────────────────────────────
    for (let i = 0; i < 8000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
    }

    // ── Poster image ─────────────────────────────────────────────────
    const POSTER_H = 1150
    if (movie.poster_url) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = rej
          img.src = movie.poster_url
        })
        ctx.drawImage(img, 0, 0, W, POSTER_H)
      } catch {
        // No poster - gradient bg is enough
      }
    }

    // ── Gradient overlay (poster → dark) ─────────────────────────────
    const grad = ctx.createLinearGradient(0, POSTER_H * 0.45, 0, POSTER_H)
    grad.addColorStop(0, 'rgba(20,17,15,0)')
    grad.addColorStop(1, 'rgba(20,17,15,1)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, POSTER_H)

    // Bottom solid dark section
    ctx.fillStyle = '#14110f'
    ctx.fillRect(0, POSTER_H, W, H - POSTER_H)

    // ── Separator line ────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(232,163,61,0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(60, POSTER_H + 10)
    ctx.lineTo(W - 60, POSTER_H + 10)
    ctx.stroke()

    // ── Movie title ──────────────────────────────────────────────────
    ctx.font = 'bold 68px Georgia, serif'
    ctx.fillStyle = '#f3ece0'
    ctx.textAlign = 'left'
    wrapText(ctx, movie.title, 60, POSTER_H + 80, W - 120, 80)

    // ── Tier badge (rotated stamp) ────────────────────────────────────
    const tierName = scoreToTier(review.score ?? 7)
    const tierInfo = TIERS[tierName] ?? { emoji: '❔', label: 'Unrated', color: '#3a3530' }

    ctx.save()
    ctx.translate(W - 160, POSTER_H + 75)
    ctx.rotate(-0.05)
    ctx.fillStyle = tierInfo.color
    ctx.beginPath()
    ctx.roundRect(-120, -38, 240, 76, 8)
    ctx.fill()
    ctx.font = 'bold 34px monospace'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(`${tierInfo.emoji} ${tierInfo.label.toUpperCase()}`, 0, 12)
    ctx.restore()

    // ── Horizontal rule ───────────────────────────────────────────────
    const reviewStartY = POSTER_H + 230

    // ── Review text ──────────────────────────────────────────────────
    ctx.font = '400 46px Georgia, serif'
    ctx.fillStyle = '#b8aea0'
    ctx.textAlign = 'left'
    // Opening quote
    ctx.font = 'bold 100px Georgia, serif'
    ctx.fillStyle = '#e8a33d'
    ctx.fillText('"', 48, reviewStartY - 10)

    ctx.font = 'italic 42px Georgia, serif'
    ctx.fillStyle = '#c8bfb5'
    const endY = wrapText(ctx, review.body, 60, reviewStartY + 30, W - 120, 58)

    // ── Reviewer info ─────────────────────────────────────────────────
    const reviewerY = Math.max(endY + 60, H - 320)

    ctx.font = 'bold 44px monospace'
    ctx.fillStyle = '#f3ece0'
    ctx.fillText(reviewer?.username ?? 'Member', 60, reviewerY)

    if (reviewer?.cinemabox_id) {
      ctx.font = '36px monospace'
      ctx.fillStyle = '#e8a33d'
      ctx.fillText(reviewer.cinemabox_id, 60, reviewerY + 52)
    }

    // ── CinemaBox branding ────────────────────────────────────────────
    ctx.font = 'bold 52px Georgia, serif'
    ctx.fillStyle = '#e8a33d'
    ctx.textAlign = 'center'
    ctx.fillText('🎬 CinemaBox', W / 2, H - 90)

    ctx.font = '32px monospace'
    ctx.fillStyle = '#7d7468'
    ctx.fillText('cinemabox-eight.vercel.app', W / 2, H - 44)

    setGenerating(false)
  }

  function handleDownload() {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `${movie.slug ?? 'movie'}-review.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleNativeShare() {
    const canvas = canvasRef.current
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `${movie.slug ?? 'movie'}-review.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `My review of ${movie.title}` })
      } else {
        handleDownload()
      }
    }, 'image/png')
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-card-modal" onClick={(e) => e.stopPropagation()}>
        <button className="share-close-btn" onClick={onClose}>✕</button>
        <h3 className="share-modal-title">Share your review</h3>

        <div className="share-canvas-wrap">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: '280px', borderRadius: '8px' }}
          />
          {generating && <p className="share-generating">Generating card...</p>}
          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="share-actions">
          <button className="share-download-btn" onClick={handleDownload} disabled={generating}>
            ⬇ Download PNG
          </button>
          <button className="share-native-btn" onClick={handleNativeShare} disabled={generating}>
            ↗ Share
          </button>
        </div>

        <p className="share-hint">9:16 ratio — perfect for Instagram stories</p>
      </div>
    </div>
  )
}
