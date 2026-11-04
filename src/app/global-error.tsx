'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Last-resort boundary: only renders when the root layout itself throws, so it
 * must supply its own <html>/<body>. Keeps a branded reload instead of Next's
 * bare "This page couldn't load" screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled root error:', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          background: '#f8fafc',
          padding: '48px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            textAlign: 'center',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            padding: '32px 24px',
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#64748b', margin: '0 0 24px' }}>
            Vero360 could not finish loading this page. Reload to try again.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '12px 22px',
                background: '#f97316',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <Link
              href="/"
              style={{
                borderRadius: 12,
                padding: '12px 22px',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Go to homepage
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
