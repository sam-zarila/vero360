'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  kycTone,
  type KycCheck,
  type KycCounts,
  type KycVerification,
} from '@/lib/kyc-admin'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'

const SECTION = DASHBOARD_SECTION_MAP.kyc

type Filter = 'all' | 'review'

const EMPTY_COUNTS: KycCounts = {
  all: 0,
  approved: 0,
  inReview: 0,
  notStarted: 0,
  inProgress: 0,
  declined: 0,
  expired: 0,
  other: 0,
}

function matchesFilter(row: KycVerification, active: Filter, q: string) {
  if (active === 'review' && row.bucket !== 'in_review' && row.bucket !== 'resubmitted') return false
  if (!q) return true
  const hay = `${row.name} ${row.email} ${row.phone} ${row.sessionId} ${row.documentLabel} ${row.issuingState}`.toLowerCase()
  return hay.includes(q)
}

export default function KycAdminPage() {
  const [rows, setRows] = useState<KycVerification[]>([])
  const [counts, setCounts] = useState<KycCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/kyc')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load KYC verifications')
      const next = (data.verifications || []) as KycVerification[]
      setRows(next)
      setCounts(data.counts || EMPTY_COUNTS)
      setSelectedId(current => current && next.some(row => row.id === current) ? current : next[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load KYC verifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => rows.filter(row => matchesFilter(row, filter, q)),
    [rows, filter, q],
  )
  const selected = filtered.find(row => row.id === selectedId) || filtered[0] || null

  useEffect(() => {
    setTab('overview')
  }, [selected?.id])

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />
      <DashboardPageHeader
        sectionId="kyc"
        description="Open a verification to see the Didit result: warnings, ID, liveness, and face match."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-3)' }}>Loading verifications…</p>
      ) : rows.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title="No KYC verifications yet"
          hint="They show up here after someone starts Didit verification in the app."
        />
      ) : (
        <div
          className="kyc-console"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <section
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 16px 12px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Verifications</h2>
              <p style={{ margin: '4px 0 12px', color: 'var(--text-3)', fontSize: 13, fontWeight: 600 }}>
                {counts.all} verification{counts.all === 1 ? '' : 's'}
              </p>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name or email"
                aria-label="Search verifications"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 14,
                  marginBottom: 10,
                }}
              />
              <button
                type="button"
                onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
                style={{
                  border: 'none',
                  borderRadius: 100,
                  padding: '7px 12px',
                  background: filter === 'review' ? '#F97316' : '#FFF7ED',
                  color: filter === 'review' ? '#fff' : '#C2410C',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {counts.inReview} session{counts.inReview === 1 ? '' : 's'} to be reviewed
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 720, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
              {filtered.length === 0 ? (
                <p style={{ margin: 0, padding: 16, color: 'var(--text-3)', fontSize: 14 }}>No matches.</p>
              ) : (
                filtered.map(row => (
                  <SessionCard
                    key={row.id}
                    row={row}
                    selected={selected?.id === row.id}
                    onSelect={() => setSelectedId(row.id)}
                  />
                ))
              )}
            </div>
          </section>

          <SessionDetail row={selected} tab={tab} onTab={setTab} />
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .kyc-console { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function SessionCard({
  row,
  selected,
  onSelect,
}: {
  row: KycVerification
  selected: boolean
  onSelect: () => void
}) {
  const name = row.name || 'N/A'
  const subtitle = [row.issuingState || 'KYC', row.documentType].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        background: selected ? '#FFF7ED' : '#fff',
        cursor: 'pointer',
      }}
    >
      <Avatar name={name} url={row.portraitUrl} />
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{name}</strong>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>
          {subtitle || 'KYC'}
        </span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
          {formatWhen(row.updatedAt)}
        </span>
      </span>
      <StatusMark bucket={row.bucket} label={row.label} />
    </button>
  )
}

function SessionDetail({
  row,
  tab,
  onTab,
}: {
  row: KycVerification | null
  tab: string
  onTab: (tab: string) => void
}) {
  if (!row) {
    return (
      <section style={panelStyle}>
        <p style={{ margin: 0, color: 'var(--text-3)' }}>Select a verification.</p>
      </section>
    )
  }

  const tone = kycTone(row.bucket)
  const tabs = [{ id: 'overview', label: 'Overview' }, ...row.checks.map(check => ({ id: check.id, label: check.label }))]
  const active = tabs.some(item => item.id === tab) ? tab : 'overview'
  const activeCheck = row.checks.find(check => check.id === active) || null

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <Avatar name={row.name || 'N/A'} url={row.portraitUrl} size={52} />
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.3px' }}>{row.name || 'N/A'}</h2>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, padding: '6px 10px', borderRadius: 100, background: tone.bg, color: tone.color }}>
          {row.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, overflow: 'auto', paddingBottom: 12, marginBottom: 8 }}>
        {tabs.map(item => {
          const check = row.checks.find(entry => entry.id === item.id)
          const on = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              style={{
                flex: '0 0 auto',
                border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: on ? '#FFF7ED' : '#fff',
                color: on ? '#C2410C' : 'var(--text-2)',
                borderRadius: 100,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {check ? `${check.passed === false ? '!' : check.passed ? '✓ ' : ''}${item.label}` : item.label}
            </button>
          )
        })}
      </div>

      {active === 'overview' ? <Overview row={row} /> : activeCheck ? <CheckPanel check={activeCheck} /> : <Overview row={row} />}
    </section>
  )
}

function Overview({ row }: { row: KycVerification }) {
  const clear = row.warnings.length === 0 && row.bucket === 'approved'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          borderRadius: 16,
          padding: '16px 18px',
          background: clear ? '#ECFDF5' : row.bucket === 'declined' ? '#FEF2F2' : '#FFF7ED',
          border: `1px solid ${clear ? '#A7F3D0' : row.bucket === 'declined' ? '#FECACA' : '#FED7AA'}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
          Warnings
        </div>
        {clear ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#166534' }}>No risk label found</div>
            <div style={{ marginTop: 4, fontSize: 14, color: '#166534' }}>This session passed all automated fraud checks.</div>
          </>
        ) : row.warnings.length > 0 ? (
          row.warnings.map(warning => (
            <div key={`${warning.title}-${warning.detail}`} style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 800 }}>{warning.title}</div>
              {warning.detail && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{warning.detail}</div>}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-2)' }}>
            {row.rejectionReason || statusNote(row)}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Contact details</h3>
        <DetailRow label="Issuing state" value={row.issuingState || '—'} />
        <DetailRow label="Email" value={row.email || '—'} />
        <DetailRow label="Phone number" value={row.phone || '—'} />
        <DetailRow label="Document" value={row.documentType || '—'} />
        <DetailRow label="Session" value={row.sessionId || '—'} />
      </div>
    </div>
  )
}

function CheckPanel({ check }: { check: KycCheck }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{check.label}</h3>
        <span style={{ fontSize: 12, fontWeight: 800, color: check.passed === false ? '#991B1B' : check.passed ? '#166534' : '#475569' }}>
          {check.status}
          {check.score ? ` · ${check.score}` : ''}
        </span>
      </div>
      {check.fields.length === 0 && check.warnings.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>Didit did not send extra detail for this check.</p>
      ) : (
        <>
          {check.fields.map(item => (
            <DetailRow key={item.label} label={item.label} value={item.value} />
          ))}
          {check.warnings.map(warning => (
            <p key={`${warning.title}-${warning.detail}`} style={{ margin: '10px 0 0', color: '#991B1B', fontWeight: 700, fontSize: 14 }}>
              {warning.title}
              {warning.detail ? ` — ${warning.detail}` : ''}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 650 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function Avatar({ name, url, size = 44 }: { name: string; url: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#F1F5F9',
        border: '1px solid var(--border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        color: 'var(--text-2)',
        flex: '0 0 auto',
      }}
    >
      {url ? (
        // Didit portrait URLs are remote and often short-lived.
        <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
      ) : (
        name === 'N/A' ? 'N/A' : initials(name)
      )}
    </span>
  )
}

function StatusMark({ bucket, label }: { bucket: KycVerification['bucket']; label: string }) {
  const tone = kycTone(bucket)
  const mark = bucket === 'approved' ? '✓' : bucket === 'declined' ? '!' : '•'
  return (
    <span
      title={label}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: tone.bg,
        color: tone.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
      }}
    >
      {mark}
    </span>
  )
}

function statusNote(row: KycVerification) {
  if (row.bucket === 'in_review' || row.bucket === 'resubmitted') return 'This session is waiting for review.'
  if (row.bucket === 'not_started') return 'Didit session was created. The person has not finished yet.'
  if (row.bucket === 'expired') return 'This Didit session expired before it was approved.'
  if (row.bucket === 'in_progress') return 'Verification is still in progress.'
  if (!row.checks.length) return 'Didit has not sent the full decision for this session yet. Status is still tracked here.'
  return row.label
}

function formatWhen(iso: string | null) {
  if (!iso) return 'No update yet'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No update yet'
  return date.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'K'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

const panelStyle = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow-sm)',
  padding: 20,
  minHeight: 420,
}
