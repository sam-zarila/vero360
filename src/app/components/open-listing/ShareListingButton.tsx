'use client'

import { useCallback, useState } from 'react'

type Props = {
  title: string
  text?: string
  /** Absolute or path URL; defaults to current page. */
  url?: string
  /** Light icon for dark/orange headers. */
  light?: boolean
}

export default function ShareListingButton({ title, text, url, light }: Props) {
  const [copied, setCopied] = useState(false)

  const share = useCallback(async () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://vero360.app'
    const shareUrl = !url
      ? typeof window !== 'undefined'
        ? window.location.href
        : 'https://vero360.app'
      : url.startsWith('http')
        ? url
        : `${origin}${url.startsWith('/') ? url : `/${url}`}`
    const shareText = text || `Check this out on Vero360: ${title}`

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text: shareText, url: shareUrl })
        return
      }
    } catch (err) {
      // User cancelled share sheet — don't fall through to copy.
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // last resort
      window.prompt('Copy this link', shareUrl)
    }
  }, [title, text, url])

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label={copied ? 'Link copied' : `Share ${title}`}
      title={copied ? 'Link copied' : 'Share'}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: light ? '1px solid rgba(255,255,255,0.35)' : '1px solid var(--border)',
        background: light ? 'rgba(255,255,255,0.12)' : '#fff',
        color: light ? '#fff' : 'var(--text)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12l5 5L20 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M8.6 10.5l6.8-3.5M8.6 13.5l6.8 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
