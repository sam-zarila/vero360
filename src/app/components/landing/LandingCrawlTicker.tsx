'use client'

import { useEffect, useRef, useState } from 'react'

export type LandingCrawlItem = {
  id: string
  title: string
  subtitle: string
  linkType: string
  linkId: string
  latestVersion: string
}

function crawlText(item: LandingCrawlItem): string {
  const title = item.title.trim()
  const subtitle = item.subtitle.trim()
  if (item.linkType === 'app_update') {
    const v = item.latestVersion || item.linkId
    return v
      ? `Update to latest version v${v}`
      : title || 'Update available'
  }
  if (!subtitle) return title
  return `${title} — ${subtitle}`
}

type Props = {
  /** Full-width bar on the orange hero */
  variant?: 'hero' | 'phone'
  /** Optional prefetched items (skips client fetch) */
  items?: LandingCrawlItem[]
}

export default function LandingCrawlTicker({
  variant = 'hero',
  items: initialItems = [],
}: Props) {
  const items = initialItems
  const trackRef = useRef<HTMLDivElement>(null)
  const [loopWidth, setLoopWidth] = useState(0)

  const texts = items.map(crawlText).filter(Boolean)
  const textsKey = texts.join('|')

  useEffect(() => {
    const el = trackRef.current
    if (!el || texts.length === 0) {
      setLoopWidth(0)
      return
    }
    const measure = () => {
      const w = el.scrollWidth / 2
      setLoopWidth(w > 0 ? w : 0)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [textsKey, texts.length])

  if (texts.length === 0) return null

  const isPhone = variant === 'phone'
  const duration = Math.max(12, Math.min(90, loopWidth / 40))

  return (
    <div
      className={isPhone ? 'landing-crawl-phone' : 'landing-crawl-hero'}
      style={{
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        ...(isPhone
          ? {
              height: 18,
              marginTop: 8,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.16)',
            }
          : {
              height: 40,
              background: 'rgba(0,0,0,0.18)',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
            }),
      }}
      aria-label="Latest updates"
    >
      <div
        ref={trackRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          height: '100%',
          animation:
            loopWidth > 0 ? `landing-crawl-scroll ${duration}s linear infinite` : undefined,
          willChange: 'transform',
        }}
      >
        {[0, 1].map(copy => (
          <span key={copy} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {texts.map((t, i) => (
              <span
                key={`${copy}-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: isPhone ? 9 : 14,
                  letterSpacing: isPhone ? 0 : '0.01em',
                  paddingLeft: isPhone ? 14 : 28,
                  paddingRight: isPhone ? 14 : 28,
                }}
              >
                {i > 0 || copy === 1 ? (
                  <span
                    style={{
                      opacity: 0.45,
                      marginRight: isPhone ? 14 : 28,
                      fontWeight: 800,
                    }}
                  >
                    •
                  </span>
                ) : null}
                {t}
              </span>
            ))}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes landing-crawl-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .landing-crawl-hero:hover > div {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
