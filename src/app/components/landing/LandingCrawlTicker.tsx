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

type DisplayItem = {
  id: string
  text: string
  linkType: string
  actionLabel: string | null
}

function shortTitle(text: string) {
  let t = text.trim()
  const lower = t.toLowerCase()
  for (const prefix of ['promos:', 'promo:', 'marketplace:', 'announcement:']) {
    if (lower.startsWith(prefix)) {
      t = t.slice(prefix.length).trim()
      break
    }
  }
  const dash = t.indexOf(' — ')
  if (dash > 0) t = t.slice(0, dash).trim()
  return t
}

function actionLabelFor(linkType: string): string | null {
  switch (linkType.toLowerCase().trim()) {
    case 'app_update':
      return 'Update'
    case 'promotion':
    case 'promotions':
      return 'See promos'
    case 'marketplace':
      return 'Shop'
    case 'announcements':
      return 'See more'
    case 'none':
    case '':
      return null
    default:
      return 'See more'
  }
}

/** Mirror app ticker: app update first, then other crawls, then one Promos line. */
export function buildLandingCrawlDisplay(
  crawls: LandingCrawlItem[],
  promoTitles: string[],
): DisplayItem[] {
  const updates: DisplayItem[] = []
  const others: DisplayItem[] = []
  const adminPromoTitles: string[] = []

  for (const item of crawls) {
    const type = (item.linkType || 'none').toLowerCase().trim()
    const title = item.title.trim()
    if (!title) continue

    if (type === 'app_update') {
      const v = (item.latestVersion || item.linkId || '').trim()
      updates.push({
        id: item.id,
        text: v ? `Update to latest version v${v}` : title || 'Update available',
        linkType: 'app_update',
        actionLabel: 'Update',
      })
      continue
    }

    if (type === 'promotion' || type === 'promotions') {
      const t = shortTitle(title)
      if (t) adminPromoTitles.push(t)
      continue
    }

    const subtitle = (item.subtitle || '').trim()
    others.push({
      id: item.id,
      text: subtitle ? `${title} — ${subtitle}` : title,
      linkType: type || 'none',
      actionLabel: actionLabelFor(type),
    })
  }

  const promoNames: string[] = []
  const seen = new Set<string>()
  for (const name of [...adminPromoTitles, ...promoTitles]) {
    const key = name.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      promoNames.push(name)
    }
  }

  const promoLine =
    promoNames.length === 0
      ? null
      : ({
          id: 'promos_grouped',
          text: `Promos: ${promoNames.slice(0, 10).join(', ')}`,
          linkType: 'promotions',
          actionLabel: 'See promos',
        } satisfies DisplayItem)

  return [...updates, ...others, ...(promoLine ? [promoLine] : [])]
}

type Props = {
  variant?: 'hero' | 'phone'
  items?: LandingCrawlItem[]
  promoTitles?: string[]
  onAction?: (item: DisplayItem) => void
}

export default function LandingCrawlTicker({
  variant = 'hero',
  items: crawls = [],
  promoTitles = [],
  onAction,
}: Props) {
  const items = buildLandingCrawlDisplay(crawls, promoTitles)
  const trackRef = useRef<HTMLDivElement>(null)
  const [loopWidth, setLoopWidth] = useState(0)

  const textsKey = items.map(i => `${i.id}:${i.text}:${i.actionLabel}`).join('|')
  const hasActions = items.some(i => i.actionLabel)

  useEffect(() => {
    const el = trackRef.current
    if (!el || items.length === 0) {
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
  }, [textsKey, items.length])

  if (items.length === 0) return null

  const isPhone = variant === 'phone'
  const duration = Math.max(14, Math.min(100, loopWidth / 36))

  return (
    <div
      className={isPhone ? 'landing-crawl-phone' : 'landing-crawl-hero'}
      style={{
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        ...(isPhone
          ? {
              height: hasActions ? 22 : 18,
              marginTop: 8,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.16)',
            }
          : {
              height: hasActions ? 48 : 40,
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
            {items.map((item, i) => (
              <span
                key={`${copy}-${item.id}-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: isPhone ? 6 : 10,
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
                      marginRight: isPhone ? 8 : 18,
                      fontWeight: 800,
                    }}
                  >
                    •
                  </span>
                ) : null}
                <span>{item.text}</span>
                {item.actionLabel ? (
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      onAction?.(item)
                    }}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background: '#fff',
                      color: '#EA580C',
                      fontWeight: 900,
                      fontSize: isPhone ? 8 : 12,
                      padding: isPhone ? '2px 8px' : '5px 12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      lineHeight: 1.2,
                      flexShrink: 0,
                    }}
                  >
                    {item.actionLabel}
                  </button>
                ) : null}
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
