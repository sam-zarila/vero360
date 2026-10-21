'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { formatDateTime } from '@/lib/vero-api'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'

const SECTION = DASHBOARD_SECTION_MAP['car-hire']

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISMISSED'
type TabKey = LeadStatus | 'ALL'

type LeadCounts = Record<LeadStatus, number>

type Lead = {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  type: string
  city: string | null
  fleetSize: number | null
  message: string | null
  status: LeadStatus
  note: string | null
  handledBy: string | null
  handledAt: string | null
  createdAt: string | null
}

const EMPTY_COUNTS: LeadCounts = { NEW: 0, CONTACTED: 0, QUALIFIED: 0, DISMISSED: 0 }

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'QUALIFIED', label: 'Qualified' },
  { key: 'DISMISSED', label: 'Dismissed' },
  { key: 'ALL', label: 'All' },
]

const ACTIONS: LeadStatus[] = ['CONTACTED', 'QUALIFIED', 'DISMISSED']

function isStatus(value: unknown): value is LeadStatus {
  return value === 'NEW' || value === 'CONTACTED' || value === 'QUALIFIED' || value === 'DISMISSED'
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function parseLead(raw: unknown): Lead | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = str(row.id).trim()
  if (!id) return null
  const fleet = Number(row.fleetSize)
  return {
    id,
    companyName: str(row.companyName) || 'Unnamed company',
    contactName: str(row.contactName) || '—',
    email: str(row.email),
    phone: str(row.phone),
    type: str(row.type).toUpperCase() || 'BUSINESS',
    city: optionalStr(row.city),
    fleetSize: Number.isFinite(fleet) && fleet >= 0 ? Math.round(fleet) : null,
    message: optionalStr(row.message),
    status: isStatus(row.status) ? row.status : 'NEW',
    note: optionalStr(row.note),
    handledBy: optionalStr(row.handledBy),
    handledAt: optionalStr(row.handledAt),
    createdAt: optionalStr(row.createdAt),
  }
}

function parseCounts(raw: unknown): LeadCounts {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const value = (key: LeadStatus) => {
    const parsed = Number(source[key])
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
  }
  return {
    NEW: value('NEW'),
    CONTACTED: value('CONTACTED'),
    QUALIFIED: value('QUALIFIED'),
    DISMISSED: value('DISMISSED'),
  }
}

/** Prefer the server's own text, including the CAR_HIRE_OPS_KEY setup message. */
function apiError(data: unknown, status: number, fallback: string): string {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const serverError =
    typeof body.error === 'string' && body.error.trim()
      ? body.error.trim()
      : typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : ''
  if (serverError) return serverError
  if (status === 401 || status === 403) {
    return 'Your panel session cannot view leads. Sign in again and retry.'
  }
  if (status === 503) {
    return 'Car hire operations are not configured on this server. Set CAR_HIRE_OPS_KEY and restart the panel.'
  }
  return fallback
}

function statusTone(status: LeadStatus): { bg: string; color: string; border: string } {
  switch (status) {
    case 'CONTACTED':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'QUALIFIED':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'DISMISSED':
      return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' }
    default:
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
  }
}

function prettyStatus(status: LeadStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function CarHireLeadsPage() {
  const [tab, setTab] = useState<TabKey>('NEW')
  const [items, setItems] = useState<Lead[]>([])
  const [counts, setCounts] = useState<LeadCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<{ id: string; status: LeadStatus } | null>(null)
  const [target, setTarget] = useState<{ lead: Lead; status: LeadStatus } | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch(`/api/admin/car-hire/leads?status=${encodeURIComponent(tab)}`, {
        headers,
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(apiError(data, res.status, 'Failed to load leads'))
      const rows = Array.isArray(data?.items) ? data.items : []
      setItems(rows.map(parseLead).filter((lead: Lead | null): lead is Lead => lead !== null))
      setCounts(parseCounts(data?.counts))
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    // Loads on mount and whenever the tab changes, matching sibling queues.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function save(lead: Lead, status: LeadStatus, noteText: string) {
    setBusy({ id: lead.id, status })
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/car-hire/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(noteText.trim() ? { note: noteText.trim() } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(apiError(data, res.status, `Could not mark ${lead.companyName} ${prettyStatus(status).toLowerCase()}`))
      }
      setTarget(null)
      setNote('')
      setNotice(`${lead.companyName} marked ${prettyStatus(status).toLowerCase()}.`)
      await load()
    } catch (err) {
      setTarget(null)
      setNote('')
      setError(err instanceof Error ? err.message : 'Could not update this lead')
    } finally {
      setBusy(null)
    }
  }

  function closeDialog() {
    if (busy) return
    setTarget(null)
    setNote('')
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="car-hire"
        title="Callback requests"
        description="Companies and owners who asked to list cars on Vero360 without installing the app. Call them, then mark how it went."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link href="/dashboard/car-hire" style={linkButtonStyle}>
              Company queue
            </Link>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          </div>
        }
      />

      {notice ? (
        <div role="status" style={noticeStyle}>
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="tablist" aria-label="Lead status">
        {TABS.map(entry => {
          const active = entry.key === tab
          const badge =
            entry.key === 'ALL'
              ? counts.NEW + counts.CONTACTED + counts.QUALIFIED + counts.DISMISSED
              : counts[entry.key]
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.key)}
              style={active ? tabActiveStyle : tabStyle}
            >
              {entry.label}
              <span style={active ? tabBadgeActiveStyle : tabBadgeStyle}>{badge}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading callback requests…</p>
      ) : items.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title="No callback requests yet"
          hint="Submissions from /list-your-cars land here. Share that page with companies that phone or email sales."
        />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            {items.length} request{items.length === 1 ? '' : 's'} shown
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(lead => {
              const tone = statusTone(lead.status)
              const isBusy = busy?.id === lead.id
              return (
                <div key={lead.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{lead.companyName}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                        {lead.contactName} · {lead.type === 'INDIVIDUAL' ? 'Individual owner' : 'Company'}
                        {lead.city ? ` · ${lead.city}` : ''}
                        {lead.fleetSize != null ? ` · ${lead.fleetSize} car${lead.fleetSize === 1 ? '' : 's'}` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} style={inlineLinkStyle}>
                            {lead.email}
                          </a>
                        ) : (
                          '—'
                        )}
                        {' · '}
                        {lead.phone ? (
                          <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} style={inlineLinkStyle}>
                            {lead.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        Submitted {formatDateTime(lead.createdAt)}
                        {lead.handledBy ? ` · Handled by ${lead.handledBy}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: tone.bg,
                        color: tone.color,
                        border: `1px solid ${tone.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prettyStatus(lead.status)}
                    </span>
                  </div>

                  {lead.message ? (
                    <div style={messageStyle}>{lead.message}</div>
                  ) : null}

                  {lead.note ? (
                    <div style={noteStyle}>Note: {lead.note}</div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ACTIONS.map(status => (
                      <button
                        key={status}
                        type="button"
                        disabled={busy !== null || lead.status === status}
                        aria-busy={isBusy && busy?.status === status}
                        onClick={() => {
                          setNote('')
                          setTarget({ lead, status })
                        }}
                        style={actionStyle(status, lead.status === status)}
                      >
                        {isBusy && busy?.status === status
                          ? 'Saving…'
                          : `Mark ${prettyStatus(status).toLowerCase()}`}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {target ? (
        <div
          style={overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-note-title"
          onClick={closeDialog}
        >
          <div style={dialogCard} onClick={event => event.stopPropagation()}>
            <h2 id="lead-note-title" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
              Mark {target.lead.companyName} {prettyStatus(target.status).toLowerCase()}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-3)' }}>
              Add a note if the call needs context. Notes are internal and stay with the lead.
            </p>
            <textarea
              autoFocus
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Called, checking documents… (optional)"
              disabled={busy !== null}
              style={textareaStyle}
            />
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              <button
                type="button"
                disabled={busy !== null}
                onClick={closeDialog}
                style={neutralButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null}
                aria-busy={busy !== null}
                onClick={() => void save(target.lead, target.status, note)}
                style={confirmButtonStyle}
              >
                {busy !== null ? 'Saving…' : `Mark ${prettyStatus(target.status).toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function actionStyle(status: LeadStatus, current: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: current ? 'not-allowed' : 'pointer',
    opacity: current ? 0.45 : 1,
    background: 'var(--surface)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
  }
  if (status === 'QUALIFIED') {
    return { ...base, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
  }
  if (status === 'DISMISSED') {
    return { ...base, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
  }
  return base
}

const linkButtonStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}

const tabStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const tabActiveStyle: CSSProperties = {
  ...tabStyle,
  border: '1px solid var(--primary)',
  background: 'var(--primary-50)',
  color: 'var(--primary-dark)',
}

const tabBadgeStyle: CSSProperties = {
  minWidth: 18,
  padding: '1px 6px',
  borderRadius: 999,
  background: 'var(--surface-2)',
  color: 'var(--text-3)',
  fontSize: 11,
  fontWeight: 800,
  textAlign: 'center',
}

const tabBadgeActiveStyle: CSSProperties = {
  ...tabBadgeStyle,
  background: 'var(--primary-light)',
  color: 'var(--primary-dark)',
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '14px 16px',
  display: 'grid',
  gap: 12,
}

const inlineLinkStyle: CSSProperties = {
  color: 'var(--text-2)',
  textDecoration: 'underline',
}

const messageStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fff',
  border: '1px solid var(--border)',
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--text-2)',
  whiteSpace: 'pre-wrap',
}

const noteStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  color: '#B45309',
  fontSize: 12,
  lineHeight: 1.5,
}

const noticeStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: '#ECFDF5',
  color: '#047857',
  border: '1px solid #A7F3D0',
  fontSize: 13,
  fontWeight: 600,
}

const errorStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: '#FEF2F2',
  color: '#B91C1C',
  border: '1px solid #FECACA',
  fontSize: 13,
  fontWeight: 600,
}

const neutralButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  borderRadius: 10,
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const confirmButtonStyle: CSSProperties = {
  border: '1px solid var(--primary-dark)',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 10,
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
}

const dialogCard: CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: 'var(--surface)',
  borderRadius: 16,
  padding: '20px 20px',
  border: '1px solid var(--border)',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: 10,
  fontSize: 13,
  color: 'var(--text)',
  resize: 'vertical',
  boxSizing: 'border-box',
}
