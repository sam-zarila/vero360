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
import { useConfirm } from '../ConfirmDialog'
import {
  isMarketplaceBoostLive,
  isPromotionPaid,
  planLabel,
  verticalLabel,
  type MarketplacePromotion,
  type MarketplacePromotionCounts,
} from '@/lib/marketplace-promotions'
import PromotePackagesPricingPanel from './PromotePackagesPricingPanel'

type Tab = 'marketplace' | 'facebook' | 'all'
type ViewMode = 'orders' | 'pricing'

const SECTION = DASHBOARD_SECTION_MAP['marketplace-promotions']

const emptyCounts: MarketplacePromotionCounts = {
  all: 0,
  marketplaceActive: 0,
  marketplaceExpired: 0,
  facebookQueued: 0,
  facebookRunning: 0,
  facebookDone: 0,
  pendingPayment: 0,
  feeCredited: 0,
  feePending: 0,
  revenuePaid: 0,
  revenueCredited: 0,
}

export default function MarketplacePromotionsAdminPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<ViewMode>('orders')
  const [items, setItems] = useState<MarketplacePromotion[]>([])
  const [counts, setCounts] = useState<MarketplacePromotionCounts>(emptyCounts)
  const [tab, setTab] = useState<Tab>('facebook')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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
    if (view === 'orders') void load()
  }, [load, view])

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

  const creditOneFee = async (id: string) => {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/marketplace-promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_platform_fee' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Credit failed')
      setNotice(data.message || 'Platform fee credited')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credit failed')
    } finally {
      setBusyId('')
    }
  }

  const creditAllPending = async () => {
    if (counts.feePending <= 0) {
      setNotice('No pending promote fees to credit')
      return
    }
    const ok = await confirm({
      title: 'Credit all pending promote payments?',
      message: `This credits the full package price for ${counts.feePending} promotion(s) into the Vero360 platform wallet (100% each).`,
      confirmLabel: 'Credit all full amounts',
      cancelLabel: 'Cancel',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/marketplace-promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_pending_fees' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk credit failed')
      setNotice(
        `Credited ${data.credited || 0} promote fee(s) · ${formatMwk(data.totalAmount || 0)} → platform wallet`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk credit failed')
    } finally {
      setBusy(false)
    }
  }

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
        description="Set 24h / 1 week / Facebook promote prices, and manage paid boost orders."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setView('pricing')}
              style={{
                border: view === 'pricing' ? 'none' : '1px solid var(--border)',
                background: view === 'pricing' ? SECTION.color : '#fff',
                color: view === 'pricing' ? '#fff' : '#334155',
                borderRadius: 999,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Set prices
            </button>
            <button
              type="button"
              onClick={() => setView('orders')}
              style={{
                border: view === 'orders' ? 'none' : '1px solid var(--border)',
                background: view === 'orders' ? SECTION.color : '#fff',
                color: view === 'orders' ? '#fff' : '#334155',
                borderRadius: 999,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Orders
            </button>
            {view === 'orders' && counts.feePending > 0 ? (
              <button type="button" onClick={() => void creditAllPending()} disabled={busy} style={primaryBtn}>
                {busy ? 'Crediting…' : `Credit ${counts.feePending} pending`}
              </button>
            ) : null}
            {view === 'orders' && (
              <DashboardRefreshButton onClick={() => void load()} disabled={loading || busy} />
            )}
          </div>
        }
      />

      {view === 'pricing' ? (
        <PromotePackagesPricingPanel />
      ) : (
        <>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Metric label="Paid promote revenue" value={formatMwk(counts.revenuePaid)} />
        <Metric label="In platform wallet" value={formatMwk(counts.revenueCredited)} />
        <Metric label="Fees still pending" value={String(counts.feePending)} />
        <Metric label="Active feed boosts" value={String(counts.marketplaceActive)} />
      </div>

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
              const paid = isPromotionPaid(promo)
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
              const feePending = paid && promo.amountMwk > 0 && !promo.platformFeeCredited

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
                      <span style={badgeStyle('#F1F5F9', '#334155')}>{verticalLabel(promo.vertical)}</span>
                      <span style={badgeStyle(tone.bg, tone.color)}>{tone.label}</span>
                      {promo.platformFeeCredited ? (
                        <span style={badgeStyle('#ECFDF5', '#166534')}>In platform wallet</span>
                      ) : feePending ? (
                        <span style={badgeStyle('#FFF7ED', '#C2410C')}>Fee pending</span>
                      ) : null}
                    </div>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                      {planLabel(promo.planId)}
                      {promo.reachLabel ? ` · ${promo.reachLabel}` : ''}
                      {' · '}
                      <strong>{formatMwk(promo.amountMwk)}</strong>
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 12 }}>
                      {promo.merchantName || promo.merchantId || 'Merchant'}
                      {promo.paidAt ? ` · paid ${formatDateTime(promo.paidAt)}` : ''}
                      {promo.expiresAt ? ` · ends ${formatDateTime(promo.expiresAt)}` : ''}
                      {promo.txRef ? ` · ${promo.txRef}` : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                    {feePending ? (
                      <button
                        type="button"
                        disabled={busyId === promo.id || busy}
                        onClick={() => void creditOneFee(promo.id)}
                        style={{ ...btnStyle, background: '#FFF7ED', borderColor: '#FDBA74', color: '#C2410C' }}
                      >
                        Credit {formatMwk(promo.amountMwk)}
                      </button>
                    ) : promo.platformFeeCredited ? (
                      <span style={{ fontSize: 11, color: '#166534', fontWeight: 700, textAlign: 'right' }}>
                        Wallet ✓
                      </span>
                    ) : null}
                    {fb && promo.status !== 'pending_payment' ? (
                      <>
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
                      </>
                    ) : isFeedBoost && !feePending && !promo.platformFeeCredited ? (
                      <span style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>Auto boost</span>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: 'var(--text-1)' }}>{value}</div>
    </div>
  )
}

function badgeStyle(bg: string, color: string): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 999,
    background: bg,
    color,
  }
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

const primaryBtn: CSSProperties = {
  border: 'none',
  background: '#F59E0B',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}
