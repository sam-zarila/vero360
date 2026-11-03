'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Route-level error boundary.
 *
 * Without this, any uncaught client error bubbles to Next's built-in global
 * error screen ("This page couldn't load"), which loses the header, the footer
 * and every way back into the site. This keeps a usable, branded fallback.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error)
  }, [error])

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '32px 24px',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 24px' }}>
          This page could not finish loading. Try again, or head back to the homepage.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '12px 22px',
              background: 'var(--primary, #f97316)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              borderRadius: 12,
              padding: '12px 22px',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </main>
  )
}
