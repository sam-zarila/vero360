'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import {
  isMarketplaceBoostLive,
  planLabel,
  verticalLabel,
  type MarketplacePromotion,
  type MarketplacePromotionCounts,
} from '@/lib/marketplace-promotions'

type Tab = 'marketplace' | 'facebook' | 'all'

const SECTION = DASHBOARD_SECTION_MAP['marketplace-promotions']

const emptyCounts: MarketplacePromotionCounts = {
  all: 0,
  marketplaceActive: 0,
  marketplaceExpired: 0,
  facebookQueued: 0,
  facebookRunning: 0,
  facebookDone: 0,
  pendingPayment: 0,
}

export default function MarketplacePromotionsAdminPage() {
  const [items, setItems] = useState<MarketplacePromotion[]>([])
  const [counts, setCounts] = useState<MarketplacePromotionCounts>(emptyCounts)
  const [tab, setTab] = useState<Tab>('facebook')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketplace-promotions', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load promotions')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (tab === 'marketplace') {
      return items.filter(
        p => String(p.channel || '').endsWith('_top') && p.status !== 'pending_payment',
      )
    }
    if (tab === 'facebook') {
      return items.filter(p => p.channel === 'facebook_ads' && p.status !== 'pending_payment')
    }
    return items
  }, [items, tab])

  const setFulfillment = async (
    id: string,
    fulfillmentStatus: 'queued' | 'running' | 'done',
  ) => {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/marketplace-promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(
        fulfillmentStatus === 'done'
          ? 'Marked Facebook campaign as done'
          : `Fulfillment set to ${fulfillmentStatus}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="marketplace-promotions"
        description="Marketplace top boosts and Facebook ad orders merchants bought in the app."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      {(error || notice) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error || notice}
        </div>
      )}

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          minHeight: 420,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {(
            [
              ['facebook', `Facebook ads (${counts.facebookQueued + counts.facebookRunning})`],
              ['marketplace', `Feed boosts (${counts.marketplaceActive})`],
              ['all', `All (${counts.all})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                border: '1px solid var(--border)',
                background: tab === id ? SECTION.bg : '#fff',
                color: tab === id ? SECTION.color : '#334155',
                borderRadius: 999,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon="megaphone"
            color={SECTION.color}
            title="No promotions yet"
            hint="Paid marketplace boosts and Facebook ad packages will show up here."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(promo => {
              const live = isMarketplaceBoostLive(promo)
              const fb = promo.channel === 'facebook_ads'
              const tone = fb
                ? promo.fulfillmentStatus === 'done'
                  ? { label: 'Done', bg: '#ECFDF5', color: '#166534' }
                  : promo.fulfillmentStatus === 'running'
                    ? { label: 'Running', bg: '#EFF6FF', color: '#1D4ED8' }
                    : { label: 'Queued', bg: '#FFF7ED', color: '#C2410C' }
                : live
                  ? { label: 'Active boost', bg: '#ECFDF5', color: '#166534' }
                  : promo.status === 'pending_payment'
                    ? { label: 'Pending payment', bg: '#FFF7ED', color: '#C2410C' }
                    : { label: 'Expired', bg: '#F1F5F9', color: '#475569' }

              const isFeedBoost = String(promo.channel || '').endsWith('_top')

              return (
                <article
                  key={promo.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr auto',
                    gap: 14,
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#F8FAFC',
                      position: 'relative',
                    }}
                  >
                    {promo.itemImage ? (
                      <Image src={promo.itemImage} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                    ) : (
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                      />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 15 }}>{promo.itemName}</strong>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: '#F1F5F9',
                          color: '#334155',
                        }}
                      >
                        {verticalLabel(promo.vertical)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: tone.bg,
                          color: tone.color,
                        }}
                      >
                        {tone.label}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                      {planLabel(promo.planId)}
                      {promo.reachLabel ? ` · ${promo.reachLabel}` : ''}
                      {' · '}
                      {formatMwk(promo.amountMwk)}
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 12 }}>
                      {promo.merchantName || promo.merchantId || 'Merchant'}
                      {promo.paidAt ? ` · paid ${formatDateTime(promo.paidAt)}` : ''}
                      {promo.expiresAt ? ` · ends ${formatDateTime(promo.expiresAt)}` : ''}
                      {promo.txRef ? ` · ${promo.txRef}` : ''}
                    </p>
                  </div>

                  {fb && promo.status !== 'pending_payment' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        type="button"
                        disabled={busyId === promo.id || promo.fulfillmentStatus === 'running'}
                        onClick={() => void setFulfillment(promo.id, 'running')}
                        style={btnStyle}
                      >
                        Mark running
                      </button>
                      <button
                        type="button"
                        disabled={busyId === promo.id || promo.fulfillmentStatus === 'done'}
                        onClick={() => void setFulfillment(promo.id, 'done')}
                        style={{ ...btnStyle, background: '#166534', borderColor: '#166534', color: '#fff' }}
                      >
                        Mark done
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>
                      {isFeedBoost ? 'Auto boost' : promo.status}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

const btnStyle: CSSProperties = {
  border: '1px solid var(--border)',
  background: '#fff',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
