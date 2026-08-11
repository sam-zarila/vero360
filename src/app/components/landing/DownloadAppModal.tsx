'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Props = {
  open: boolean
  onClose: () => void
}

/** App launch: 1 September 2026, 00:00 local time */
const LAUNCH_AT = new Date(2026, 8, 1, 0, 0, 0, 0)

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  launched: boolean
}

function getTimeLeft(now: Date): TimeLeft {
  const diff = LAUNCH_AT.getTime() - now.getTime()
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true }
  }
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    launched: false,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function DownloadAppModal({ open, onClose }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)

  useEffect(() => {
    if (!open) return
    setTimeLeft(getTimeLeft(new Date()))
    const id = window.setInterval(() => {
      setTimeLeft(getTimeLeft(new Date()))
    }, 1000)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const launched = timeLeft?.launched ?? false
  const units = [
    { label: 'Days', value: timeLeft?.days ?? 0 },
    { label: 'Hours', value: timeLeft?.hours ?? 0 },
    { label: 'Mins', value: timeLeft?.minutes ?? 0 },
    { label: 'Secs', value: timeLeft?.seconds ?? 0 },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px',
          maxWidth: 420, width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/logo.png" alt="Vero360" width={40} height={40} style={{ height: 40, width: 'auto' }} />
            <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              {launched ? 'Download Vero360' : 'Coming Soon'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ fontSize: 22, color: 'var(--text-3)', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {launched ? (
          <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.6 }}>
            Vero360 is live. Get the app on the App Store and Google Play.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              The Vero360 app is coming soon. We launch on{' '}
              <strong style={{ color: 'var(--text)' }}>1 September 2026</strong>.
            </p>

            <div
              role="timer"
              aria-live="polite"
              aria-label={
                timeLeft
                  ? `Countdown to launch: ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`
                  : 'Loading countdown'
              }
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {units.map(u => (
                <div
                  key={u.label}
                  style={{
                    textAlign: 'center',
                    padding: '14px 8px',
                    borderRadius: 14,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    fontSize: 26,
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--primary)',
                    letterSpacing: '-0.5px',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {timeLeft ? pad(u.value) : '--'}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginTop: 4,
                  }}>
                    {u.label}
                  </div>
                </div>
              ))}
            </div>

            <p style={{
              fontSize: 13,
              color: 'var(--text-3)',
              lineHeight: 1.6,
              textAlign: 'center',
              margin: 0,
            }}>
              Stay tuned — App Store &amp; Google Play links will appear here at launch.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
