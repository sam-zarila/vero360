'use client'

import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  IOS_REVIEW_BODY,
  IOS_REVIEW_HEADLINE,
  IOS_REVIEW_TITLE,
} from '@/lib/app-launch'
import Logo from './Logo'

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 220,
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  padding: '32px 28px',
  maxWidth: 440,
  width: '100%',
  boxShadow: 'var(--shadow-lg)',
}

const resetButton: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  textDecoration: 'none',
}

export function IosReviewNotice({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-review-title"
        style={card}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo height={48} />
            <div>
              <div
                id="ios-review-title"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}
              >
                {IOS_REVIEW_TITLE}
              </div>
              <h3
                style={{
                  margin: '4px 0 0',
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  lineHeight: 1.25,
                }}
              >
                {IOS_REVIEW_HEADLINE}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: 22,
              color: 'var(--text-3)',
              lineHeight: 1,
              padding: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-2)',
            margin: '0 0 22px',
            lineHeight: 1.65,
          }}
        >
          {IOS_REVIEW_BODY}
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

export function IosStoreCta({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)

  function openNotice(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={openNotice}
        style={{ ...resetButton, ...style }}
      >
        {children}
      </button>
      <IosReviewNotice open={open} onClose={() => setOpen(false)} />
    </>
  )
}
