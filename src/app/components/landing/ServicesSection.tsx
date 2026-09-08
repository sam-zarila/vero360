'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import DownloadAppModal from './DownloadAppModal'
import { CatalogCardGrid } from './CatalogCardGrid'
import { IconBadge, type VeroIconName } from './icons'
import {
  mapTenderItems,
  type CatalogCard,
} from '@/lib/catalog-cards'

type StripConfig = {
  id: string
  browsePath: string
  icon: VeroIconName
  title: string
  subtitle: string
  viewMoreLabel: string
  endpoint: string
}

const PREVIEW_COUNT = 12

const STRIPS: StripConfig[] = [
  {
    id: 'marketplace',
    browsePath: '/browse/marketplace',
    icon: 'cart',
    title: 'Marketplace',
    subtitle: 'Shop products from verified merchants',
    viewMoreLabel: 'View more products',
    endpoint: '/api/public/marketplace?limit=500',
  },
  {
    id: 'food',
    browsePath: '/browse/food',
    icon: 'food',
    title: 'Food',
    subtitle: 'Order from restaurants near you',
    viewMoreLabel: 'View more meals',
    endpoint: '/api/public/food?limit=500',
  },
  {
    id: 'stay',
    browsePath: '/browse/stays',
    icon: 'bed',
    title: 'Stay',
    subtitle: 'Hotels, lodges, and short stays',
    viewMoreLabel: 'View more stays',
    endpoint: '/api/public/stays?limit=500',
  },
  {
    id: 'jobs',
    browsePath: '/browse/jobs',
    icon: 'briefcase',
    title: 'Jobs',
    subtitle: 'Find work across Malawi and beyond',
    viewMoreLabel: 'View more jobs',
    endpoint: '/api/public/jobs?limit=500',
  },
  {
    id: 'tenders',
    browsePath: '/browse/tenders',
    icon: 'layers',
    title: 'Tenders',
    subtitle: 'Open opportunities and RFPs',
    viewMoreLabel: 'View more tenders',
    endpoint: '/api/tenders?limit=500',
  },
]

export default function ServicesSection() {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [itemsByStrip, setItemsByStrip] = useState<Record<string, CatalogCard[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const next: Record<string, CatalogCard[]> = {}
      await Promise.all(
        STRIPS.map(async strip => {
          try {
            const res = await fetch(strip.endpoint, { cache: 'no-store' })
            const data = await res.json().catch(() => ({}))
            const raw = Array.isArray(data.items) ? data.items : []
            next[strip.id] =
              strip.id === 'tenders' ? mapTenderItems(raw) : (raw as CatalogCard[])
          } catch {
            next[strip.id] = []
          }
        }),
      )
      if (!cancelled) {
        setItemsByStrip(next)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function openApp() {
    setDownloadOpen(true)
  }

  function onCardActivate(card: CatalogCard) {
    if (card.externalUrl) {
      window.open(card.externalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    openApp()
  }

  return (
    <section id="services" style={{ padding: '100px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'var(--primary-light)',
              color: 'var(--primary-dark)',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Everything in one app
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,44px)',
              letterSpacing: '-0.5px',
              marginBottom: 16,
            }}
          >
            Browse live on Vero360
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'var(--text-3)',
              maxWidth: 560,
              margin: '0 auto',
            }}
          >
            Marketplace, food, stays, jobs, and tenders from the same catalogs as the app. Tap a
            product for details, or view more to see the full list.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <QuickChip icon="car" label="Vero Ride" onClick={openApp} />
          <QuickChip icon="truck" label="Courier · Lilongwe" onClick={openApp} accent />
          <QuickChip icon="bike" label="Vero Bike" onClick={openApp} />
        </div>

        <div
          style={{
            marginBottom: 40,
            padding: '18px 20px',
            borderRadius: 16,
            border: '1px solid #FED7AA',
            background: 'linear-gradient(135deg, #FFF7ED 0%, #fff 70%)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', maxWidth: 720 }}>
            <IconBadge name="truck" size={22} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Vero Courier</h3>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Same-day parcel delivery in <strong>Lilongwe only</strong>. Blantyre, Zomba, and
                other cities are expanding soon — order courier from the app when you&apos;re in
                Lilongwe.
              </p>
            </div>
          </div>
          <button type="button" onClick={openApp} style={primaryBtn}>
            Order in app
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {STRIPS.map(strip => {
            const items = itemsByStrip[strip.id] || []
            const visible = items.slice(0, PREVIEW_COUNT)
            const hasMore = items.length > PREVIEW_COUNT

            return (
              <div key={strip.id}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <IconBadge name={strip.icon} size={20} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                        {strip.title}
                        {!loading && items.length > 0 ? (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-3)',
                            }}
                          >
                            ({items.length})
                          </span>
                        ) : null}
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                        {strip.subtitle}
                      </p>
                    </div>
                  </div>
                  <Link href={strip.browsePath} style={ghostBtnLink}>
                    {strip.viewMoreLabel}
                  </Link>
                </div>

                {loading ? (
                  <p style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 14 }}>
                    Loading {strip.title.toLowerCase()}…
                  </p>
                ) : items.length === 0 ? (
                  <div style={emptyBox}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>
                      No listings to preview yet. Open the app to browse {strip.title.toLowerCase()}.
                    </p>
                    <button type="button" onClick={openApp} style={{ ...primaryBtn, marginTop: 12 }}>
                      Open app
                    </button>
                  </div>
                ) : (
                  <>
                    <CatalogCardGrid
                      items={visible}
                      layout="scroll"
                      onActivate={onCardActivate}
                    />
                    <div style={{ marginTop: 14, textAlign: 'center' }}>
                      <Link href={strip.browsePath} style={primaryBtnLink}>
                        {hasMore
                          ? `${strip.viewMoreLabel} (${items.length - PREVIEW_COUNT} more)`
                          : `See all ${strip.title.toLowerCase()}`}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </section>
  )
}

function QuickChip({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: VeroIconName
  label: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 999,
        border: accent ? '1px solid #FDBA74' : '1px solid var(--border)',
        background: accent ? '#FFF7ED' : '#fff',
        color: accent ? '#C2410C' : 'var(--text-2)',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <IconBadge name={icon} size={16} />
      {label}
    </button>
  )
}

const primaryBtn: CSSProperties = {
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 12,
  padding: '12px 18px',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const primaryBtnLink: CSSProperties = {
  ...primaryBtn,
  display: 'inline-block',
  textDecoration: 'none',
}

const ghostBtnLink: CSSProperties = {
  border: '1.5px solid var(--border-2)',
  background: '#fff',
  color: 'var(--text-2)',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  display: 'inline-block',
}

const emptyBox: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: '1px dashed var(--border)',
  background: '#fff',
}
