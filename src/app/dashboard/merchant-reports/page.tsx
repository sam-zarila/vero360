'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  formatDateTime,
  merchantContactPrimary,
  merchantContactSecondary,
  merchantReportStatusLabel,
  merchantReportStatusTone,
  merchantStorePath,
  reporterContactLabel,
  type MerchantReport,
  type MerchantReportStatus,
} from '@/lib/merchant-reports'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

type Tab = 'all' | 'open' | 'in_review' | 'resolved' | 'dismissed'

type Counts = {
  all: number
  open: number
  in_review: number
  resolved: number
  dismissed: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  open: 0,
  in_review: 0,
  resolved: 0,
  dismissed: 0,
}

export default function MerchantReportsAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<MerchantReport[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('open')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)

  const openPreview = (urls: string[], index: number) => {
    const list = urls.filter(Boolean)
    if (list.length === 0) return
    const i = Math.max(0, Math.min(index, list.length - 1))
    setPreviewUrls(list)
    setPreviewIndex(i)
    setPreviewUrl(list[i]!)
  }

  const closePreview = () => {
    setPreviewUrl(null)
    setPreviewUrls([])
    setPreviewIndex(0)
  }

  const shiftPreview = (delta: number) => {
    if (previewUrls.length < 2) return
    const next = (previewIndex + delta + previewUrls.length) % previewUrls.length
    setPreviewIndex(next)
    setPreviewUrl(previewUrls[next]!)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/merchant-reports', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load merchant reports')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load merchant reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (tab !== 'all' && item.status !== tab) return false
      if (!q) return true
      return (
        merchantContactPrimary(item).toLowerCase().includes(q) ||
        (item.merchantEmail || '').toLowerCase().includes(q) ||
        (item.merchantPhone || '').toLowerCase().includes(q) ||
        reporterContactLabel(item).toLowerCase().includes(q) ||
        (item.reporterPhone || '').toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q)
      )
    })
  }, [items, tab, query])

  const setStatus = async (item: MerchantReport, status: MerchantReportStatus) => {
    const label = merchantReportStatusLabel(status)
    if (
      !(await confirm({
        title: 'Confirm change?',
        message: `Mark report against “${merchantContactPrimary(item)}” as “${label}”?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No',
        danger: status === 'dismissed',
      }))
    ) {
      return
    }

    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/merchant-reports/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`Report for ${merchantContactPrimary(item)} marked ${label}`)
      if (data.item) {
        setItems(prev => prev.map(x => (x.id === item.id ? data.item : x)))
      }
      await load()
      if (status === 'resolved') setTab('resolved')
      else if (status === 'in_review') setTab('in_review')
      else if (status === 'dismissed') setTab('dismissed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item: MerchantReport) => {
    if (
      !(await confirmDelete(
        merchantContactPrimary(item),
        'This permanently deletes the report from Firestore.',
      ))
    ) {
      return
    }

    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/merchant-reports/${encodeURIComponent(item.id)}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted report for ${merchantContactPrimary(item)}`)
      setItems(prev => prev.filter(x => x.id !== item.id))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'in_review', label: 'In review', count: counts.in_review },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
    { id: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ]

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-3)',
          marginBottom: 18,
        }}
      >
        ← Dashboard
      </Link>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
            }}
          >
            Merchant reports
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
            Reports submitted from the app about marketplace merchants (Firestore{' '}
            <code>merchant_reports</code>). Review messages and screenshots, then
            resolve or dismiss.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#fff',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-2)',
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ position: 'relative', flex: '1 1 260px' }}>
          <span className="sr-only">Search reports</span>
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (e.target.value.trim()) setTab('all')
            }}
            placeholder="Search merchant, reporter, message…"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '11px 14px 11px 40px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-4)',
              fontSize: 15,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
        </label>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-2)',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 100,
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-50)' : '#fff',
                color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
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
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading merchant reports…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            {query.trim() || tab !== 'all'
              ? 'No reports match your filters.'
              : 'No merchant reports yet. When users report a merchant in the app, they appear here.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const tone = merchantReportStatusTone(item.status)
              const busy = busyId === item.id
              const merchantLabel = merchantContactPrimary(item)
              const merchantSub = merchantContactSecondary(item)
              const reporterLabel = reporterContactLabel(item)
              return (
                <article
                  key={item.id}
                  className="merchant-report-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                        {item.merchantId ? (
                          <Link
                            href={merchantStorePath(item.merchantId)}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {merchantLabel}
                          </Link>
                        ) : (
                          merchantLabel
                        )}
                      </h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {merchantReportStatusLabel(item.status)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: 'var(--text-2)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.message}
                    </p>

                    {item.proofUrls.length > 0 || item.proofUrl ? (
                      <div style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          {(item.proofUrls.length > 0
                            ? item.proofUrls
                            : item.proofUrl
                              ? [item.proofUrl]
                              : []
                          ).map((url, index, urls) => (
                            <button
                              key={`${item.id}-proof-${index}`}
                              type="button"
                              onClick={() => openPreview(urls, index)}
                              title={`Screenshot ${index + 1}`}
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                borderRadius: 12,
                                overflow: 'hidden',
                                display: 'block',
                                width: 120,
                                height: 120,
                                flexShrink: 0,
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Report screenshot ${index + 1}`}
                                referrerPolicy="no-referrer"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: 12,
                                  border: '1px solid var(--border)',
                                  background: '#F6F7FB',
                                }}
                                onError={e => {
                                  e.currentTarget.style.opacity = '0.35'
                                }}
                              />
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                          {(item.proofUrls.length || (item.proofUrl ? 1 : 0))} screenshot
                          {(item.proofUrls.length || (item.proofUrl ? 1 : 0)) === 1 ? '' : 's'} —
                          click to enlarge
                        </div>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta
                        label="Merchant"
                        value={merchantLabel}
                        sub={merchantSub || undefined}
                      />
                      <Meta label="Reporter" value={reporterLabel} />
                      <Meta label="Reported" value={formatDateTime(item.createdAt)} />
                      {item.resolvedAt ? (
                        <Meta label="Closed" value={formatDateTime(item.resolvedAt)} />
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minWidth: 140,
                    }}
                  >
                    {item.merchantId ? (
                      <Link
                        href={merchantStorePath(item.merchantId)}
                        style={{
                          ...actionBtn('#FFF7ED', '#C2410C', '#FED7AA', false),
                          textDecoration: 'none',
                          textAlign: 'center',
                        }}
                      >
                        Open store
                      </Link>
                    ) : null}
                    {item.status !== 'in_review' && item.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(item, 'in_review')}
                        style={actionBtn('#EFF6FF', '#1D4ED8', '#BFDBFE', busy)}
                      >
                        Mark in review
                      </button>
                    )}
                    {item.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(item, 'resolved')}
                        style={actionBtn('#ECFDF5', '#047857', '#A7F3D0', busy)}
                      >
                        Mark resolved
                      </button>
                    )}
                    {item.status !== 'dismissed' && item.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(item, 'dismissed')}
                        style={actionBtn('#F3F4F6', '#374151', '#E5E7EB', busy)}
                      >
                        Dismiss
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(item)}
                      style={actionBtn('#FEF2F2', '#B91C1C', '#FECACA', busy)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={closePreview}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={closePreview}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          {previewUrls.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={e => {
                  e.stopPropagation()
                  shiftPreview(-1)
                }}
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={e => {
                  e.stopPropagation()
                  shiftPreview(1)
                }}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                ›
              </button>
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {previewIndex + 1} / {previewUrls.length}
              </div>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Report screenshot ${previewIndex + 1}`}
            referrerPolicy="no-referrer"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              borderRadius: 12,
              objectFit: 'contain',
            }}
          />
        </div>
      ) : null}

      <style jsx global>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 760px) {
          .merchant-report-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function actionBtn(bg: string, color: string, border: string, busy: boolean) {
  return {
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 800,
    cursor: busy ? ('wait' as const) : ('pointer' as const),
    opacity: busy ? 0.7 : 1,
  }
}

function Meta({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}
