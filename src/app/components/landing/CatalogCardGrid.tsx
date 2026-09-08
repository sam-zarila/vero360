'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { formatMwk } from '@/lib/vero-api'
import { listingDetailHref, type CatalogCard } from '@/lib/catalog-cards'

type Props = {
  items: CatalogCard[]
  onActivate?: (card: CatalogCard) => void
  layout?: 'scroll' | 'grid'
}

export function CatalogCardGrid({ items, onActivate, layout = 'grid' }: Props) {
  return (
    <div
      className={layout === 'scroll' ? 'catalog-scroll' : 'catalog-grid'}
      style={layout === 'scroll' ? scrollRow : gridRow}
    >
      {items.map(card => (
        <CatalogCardItem
          key={card.id + (card.href || card.externalUrl || '')}
          card={card}
          onActivate={onActivate}
          scroll={layout === 'scroll'}
        />
      ))}
      <style>{`
        .catalog-scroll { scrollbar-width: thin; }
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
    </div>
  )
}

function CatalogCardItem({
  card,
  onActivate,
  scroll,
}: {
  card: CatalogCard
  onActivate?: (card: CatalogCard) => void
  scroll?: boolean
}) {
  const priceLabel =
    card.price != null && card.price > 0 ? formatMwk(card.price) : null
  const href = listingDetailHref(card)

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
          {[card.meta, card.location].filter(Boolean).join(' · ') || 'View details'}
        </div>
      </div>
    </>
  )

  const shell: CSSProperties = {
    flex: scroll ? '0 0 210px' : undefined,
    width: scroll ? 210 : '100%',
    maxWidth: scroll ? 210 : undefined,
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
    <button
      type="button"
      className="catalog-card"
      style={shell}
      onClick={() => onActivate?.(card)}
    >
      {content}
    </button>
  )
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
