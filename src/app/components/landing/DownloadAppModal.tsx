'use client'

import { appStoreLinks } from './veroServices'
import Image from 'next/image'

type Props = {
  open: boolean
  onClose: () => void
}

export default function DownloadAppModal({ open, onClose }: Props) {
  if (!open) return null

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
          maxWidth: 400, width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/logo.png" alt="Vero360" width={40} height={40} style={{ height: 40, width: 'auto' }} />
            <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Download Vero360</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ fontSize: 22, color: 'var(--text-3)', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.6 }}>
          Choose your platform to download the Vero360 super app.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a
            href={appStoreLinks.ios}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 14,
              border: '1.5px solid var(--border)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = 'var(--shadow-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span style={{ fontSize: 28 }}>🍎</span>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Download on the</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>App Store</div>
            </div>
          </a>

          <a
            href={appStoreLinks.android}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 14,
              border: '1.5px solid var(--border)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = 'var(--shadow-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span style={{ fontSize: 28 }}>🤖</span>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Get it on</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Google Play</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
