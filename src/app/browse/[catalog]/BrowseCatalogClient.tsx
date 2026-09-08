'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/app/components/landing/navbar'
import Footer from '@/app/components/landing/Footer '
import DownloadAppModal from '@/app/components/landing/DownloadAppModal'
import { CatalogCardGrid } from '@/app/components/landing/CatalogCardGrid'
import {
  BROWSE_CATALOGS,
  mapTenderItems,
  type BrowseCatalogId,
  type CatalogCard,
} from '@/lib/catalog-cards'

type Props = { catalog: BrowseCatalogId }

export default function BrowseCatalogClient({ catalog }: Props) {
  const meta = BROWSE_CATALOGS[catalog]
  const [items, setItems] = useState<CatalogCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [downloadOpen, setDownloadOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(meta.endpoint, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        const raw = Array.isArray(data.items) ? data.items : []
        const mapped =
          catalog === 'tenders' ? mapTenderItems(raw) : (raw as CatalogCard[])
        if (!cancelled) setItems(mapped)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [catalog, meta.endpoint])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item =>
      `${item.title} ${item.meta || ''} ${item.location || ''}`.toLowerCase().includes(q),
    )
  }, [items, query])

  function onActivate(card: CatalogCard) {
    if (card.externalUrl) {
      window.open(card.externalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    setDownloadOpen(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '110px 24px 80px' }}>
        <Link
          href="/#services"
          style={{
            display: 'inline-block',
            marginBottom: 18,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-3)',
            textDecoration: 'none',
          }}
        >
          ← Back to home
        </Link>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                fontFamily: 'var(--font-display)',
              }}
            >
              {meta.title}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--text-3)' }}>
              {meta.subtitle}
              {!loading ? ` · ${filtered.length} ${meta.itemLabel}` : ''}
            </p>
          </div>
          <label style={{ display: 'block', minWidth: 220, flex: '1 1 240px', maxWidth: 360 }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
              Search
            </span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${meta.itemLabel}…`}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </label>
        </div>

        {error ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: '#FEF2F2',
              color: '#991B1B',
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Loading {meta.itemLabel}…</p>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              border: '1px dashed var(--border)',
              background: '#fff',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, color: 'var(--text-2)' }}>No {meta.itemLabel} found.</p>
            <button
              type="button"
              onClick={() => setDownloadOpen(true)}
              style={{
                marginTop: 14,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 18px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Open in app
            </button>
          </div>
        ) : (
          <CatalogCardGrid items={filtered} layout="grid" onActivate={onActivate} />
        )}
      </main>
      <Footer />
      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </div>
  )
}
