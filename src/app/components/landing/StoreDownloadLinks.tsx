import type { CSSProperties } from 'react'
import Image from 'next/image'
import { appStoreLinks, storeBadgeImages } from './veroServices'

type Props = {
  className?: string
  maxWidth?: number
  style?: CSSProperties
}

export default function StoreDownloadLinks({ className, maxWidth = 320, style }: Props) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth, margin: '0 auto', width: '100%',
        ...style,
      }}
    >
      <a
        href={appStoreLinks.ios}
        target="_blank"
        rel="noopener noreferrer"
        className="store-download-link"
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', borderRadius: 12,
          border: '1.5px solid var(--border)',
          background: '#fff',
        }}
      >
        <Image
          src={storeBadgeImages.appStore}
          alt="App Store"
          width={44}
          height={44}
          unoptimized
          style={{ width: 44, height: 44, flexShrink: 0 }}
        />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Download on the</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>App Store</div>
        </div>
      </a>

      <a
        href={appStoreLinks.android}
        target="_blank"
        rel="noopener noreferrer"
        className="store-download-link"
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', borderRadius: 12,
          border: '1.5px solid var(--border)',
          background: '#fff',
        }}
      >
        <Image
          src={storeBadgeImages.googlePlay}
          alt="Google Play"
          width={44}
          height={44}
          unoptimized
          style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Get it on</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Google Play</div>
        </div>
      </a>

      <style>{`
        .store-download-link:hover {
          border-color: var(--primary);
          box-shadow: var(--shadow-primary);
        }
      `}</style>
    </div>
  )
}
