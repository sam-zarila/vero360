'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { formatMwk } from '@/lib/vero-api'
import DownloadAppModal from './DownloadAppModal'
import { IconBadge, type VeroIconName } from './icons'

type CatalogCard = {
  id: string
  title: string
  image: string | null
  price: number | null
  location: string | null
  meta: string | null
  href: string | null
  externalUrl: string | null
}

type StripConfig = {
  id: string
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
    icon: 'cart',
    title: 'Marketplace',
    subtitle: 'Shop products from verified merchants',
    viewMoreLabel: 'View more products',
    endpoint: '/api/public/marketplace?limit=500',
  },
  {
    id: 'food',
    icon: 'food',
    title: 'Food',
    subtitle: 'Order from restaurants near you',
    viewMoreLabel: 'View more meals',
    endpoint: '/api/public/food?limit=500',
  },
  {
    id: 'stay',
    icon: 'bed',
    title: 'Stay',
    subtitle: 'Hotels, lodges, and short stays',
    viewMoreLabel: 'View more stays',
    endpoint: '/api/public/stays?limit=500',
  },
  {
    id: 'jobs',
    icon: 'briefcase',
    title: 'Jobs',
    subtitle: 'Find work across Malawi and beyond',
    viewMoreLabel: 'View more jobs',
    endpoint: '/api/public/jobs?limit=500',
  },
  {
    id: 'tenders',
    icon: 'layers',
    title: 'Tenders',
    subtitle: 'Open opportunities and RFPs',
    viewMoreLabel: 'View more tenders',
    endpoint: '/api/tenders?limit=500',
  },
]

function mapTenderItems(raw: unknown[]): CatalogCard[] {
  return raw.map((row, i) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id ?? i),
      title: String(r.title || 'Tender'),
      image: null,
      price: null,
      location: r.location ? String(r.location) : null,
      meta: r.buyer ? String(r.buyer) : null,
      href: null,
      externalUrl: (r.tenderUrl || r.documentUrl
        ? String(r.tenderUrl || r.documentUrl)
        : null) as string | null,
    }
  })
}

function listingHref(card: CatalogCard): string | null {
  if (!card.href) return null
  const qs = new URLSearchParams()
  if (card.title) qs.set('name', card.title)
  if (card.location) qs.set('loc', card.location)
  if (card.price != null && card.price > 0) qs.set('price', String(Math.round(card.price)))
  if (card.image) qs.set('img', card.image)
  if (card.meta) qs.set('merchant', card.meta)
  const q = qs.toString()
  return q ? `${card.href}?${q}` : card.href
}

export default function ServicesSection() {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [itemsByStrip, setItemsByStrip] = useState<Record<string, CatalogCard[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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
            Marketplace, food, stays, jobs, and tenders from the same catalogs as the app. Tap
            any listing to open it — then continue in Vero360.
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
            const isExpanded = Boolean(expanded[strip.id])
            const visible = isExpanded ? items : items.slice(0, PREVIEW_COUNT)
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
                  <button type="button" onClick={openApp} style={ghostBtn}>
                    Open in app
                  </button>
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
                    <button type="button" onClick={openApp} style={{ ...ghostBtn, marginTop: 12 }}>
                      Open app
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className={isExpanded ? 'catalog-grid' : 'catalog-scroll'}
                      style={isExpanded ? gridRow : scrollRow}
                    >
                      {visible.map(card => (
                        <CatalogItem
                          key={`${strip.id}-${card.id}`}
                          card={card}
                          onActivate={() => onCardActivate(card)}
                        />
                      ))}
                    </div>
                    {hasMore ? (
                      <div style={{ marginTop: 14, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(prev => ({
                              ...prev,
                              [strip.id]: !prev[strip.id],
                            }))
                          }
                          style={primaryBtn}
                        >
                          {isExpanded
                            ? `Show less`
                            : `${strip.viewMoreLabel} (${items.length - PREVIEW_COUNT} more)`}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />

      <style>{`
        .catalog-scroll {
          scrollbar-width: thin;
        }
        .catalog-scroll::-webkit-scrollbar { height: 6px; }
        .catalog-scroll::-webkit-scrollbar-thumb {
          background: #FDBA74; border-radius: 999px;
        }
        .catalog-card { transition: transform 0.2s, box-shadow 0.2s; }
        .catalog-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
        @media (max-width: 700px) {
          .catalog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
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

function CatalogItem({
  card,
  onActivate,
}: {
  card: CatalogCard
  onActivate: () => void
}) {
  const priceLabel =
    card.price != null && card.price > 0 ? formatMwk(card.price) : null
  const href = useMemo(() => listingHref(card), [card])

  const content = (
    <>
      <div
        style={{
          height: 140,
          background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#C2410C',
              fontWeight: 800,
              fontSize: 13,
              padding: 12,
              textAlign: 'center',
            }}
          >
            {card.meta || 'Vero360'}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.35,
            marginBottom: 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.title}
        </div>
        {priceLabel ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2410C', marginBottom: 4 }}>
            {priceLabel}
          </div>
        ) : null}
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
          {[card.meta, card.location].filter(Boolean).join(' · ') || 'Open in Vero360'}
        </div>
      </div>
    </>
  )

  const shell: CSSProperties = {
    flex: '0 0 210px',
    width: '100%',
    maxWidth: 210,
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    display: 'block',
    padding: 0,
    fontFamily: 'inherit',
    textAlign: 'left',
  }

  if (href) {
    return (
      <Link href={href} prefetch className="catalog-card" style={shell}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className="catalog-card" style={shell} onClick={onActivate}>
      {content}
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

const ghostBtn: CSSProperties = {
  border: '1.5px solid var(--border-2)',
  background: '#fff',
  color: 'var(--text-2)',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const emptyBox: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: '1px dashed var(--border)',
  background: '#fff',
}

const scrollRow: CSSProperties = {
  display: 'flex',
  gap: 14,
  overflowX: 'auto',
  paddingBottom: 8,
  WebkitOverflowScrolling: 'touch',
}

const gridRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
}
