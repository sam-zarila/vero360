'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import { formatDateTime, formatMwk } from '@/lib/vero-api'

function sourceHref(source: string) {
  switch ((source || '').toLowerCase()) {
    case 'marketplace':
    case 'checkout':
      return '/dashboard/orders'
    case 'food':
      return '/dashboard/food'
    case 'stay':
    case 'accommodation':
      return '/dashboard/stay?tab=bookings'
    case 'digital':
      return '/dashboard/digital-services'
    default:
      return ''
  }
}

function sourceLabel(source: string) {
  switch ((source || '').toLowerCase()) {
    case 'marketplace':
    case 'checkout':
      return 'Marketplace order'
    case 'food':
      return 'Food order'
    case 'stay':
    case 'accommodation':
      return 'Accommodation booking'
    case 'digital':
      return 'Digital service'
    default:
      return source || 'Checkout'
  }
}

type Proof = {
  id: string
  txRef: string
  amountMwk: number
  proofUrl: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  source: string
  title: string
  status: string
  createdAt: string | null
}

export function BankTransferProofsPanel() {
  const [items, setItems] = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/finance/bank-transfers', {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load proofs')
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load proofs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && items.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>Loading bank transfer proofs…</p>
  }
  if (error) {
    return <p style={{ color: '#B91C1C', fontWeight: 700 }}>{error}</p>
  }
  if (items.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>
        No bank transfer slips yet. When a customer uploads proof, it appears here.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map(item => (
        <article
          key={item.id}
          style={{
            background: '#fff',
            border: '1px solid #FDE68A',
            borderRadius: 14,
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 160px) 1fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {item.proofUrl ? (
            <a href={item.proofUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.proofUrl}
                alt="Transfer slip"
                style={{
                  width: '100%',
                  height: 140,
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: '1px solid #FCD34D',
                  background: '#FFFBEB',
                }}
              />
            </a>
          ) : (
            <div
              style={{
                height: 140,
                borderRadius: 10,
                background: '#FFFBEB',
                display: 'grid',
                placeItems: 'center',
                color: '#92400E',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              No photo
            </div>
          )}
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{item.title}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: '#B45309' }}>
              {formatMwk(item.amountMwk)}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
              {item.buyerName}
              {item.buyerPhone ? ` · ${item.buyerPhone}` : ''}
              {item.buyerEmail ? ` · ${item.buyerEmail}` : ''}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#6B7280' }}>
              {sourceLabel(item.source)} · Ref {item.txRef || '—'}
              {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
            </div>
            {sourceHref(item.source) ? (
              <Link
                href={sourceHref(item.source)}
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#9A3412',
                }}
              >
                Open {sourceLabel(item.source).toLowerCase()}
              </Link>
            ) : null}
            <div
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 11,
                fontWeight: 800,
                color: '#92400E',
                background: '#FEF3C7',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {item.status === 'pending_review' ? 'Waiting for confirmation' : item.status}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
