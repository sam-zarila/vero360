'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { carHireStatusTone, prettyStatus } from '@/lib/car-hire'
import {
  companyActionLabel,
  companyActionRequiresNote,
  opsCompanyActions,
  parseOpsCompanyPage,
  type CarHireCompanyReviewAction,
  type OpsCompany,
} from '@/lib/car-hire-ops'
import { formatDateTime } from '@/lib/vero-api'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import { useConfirm } from '../ConfirmDialog'
import { opsApiError } from './ListingActions'

const SECTION = DASHBOARD_SECTION_MAP['car-hire']

function busyLabel(action: CarHireCompanyReviewAction): string {
  switch (action) {
    case 'approve':
      return 'Approving…'
    case 'reject':
      return 'Rejecting…'
    case 'request-info':
      return 'Sending…'
    case 'suspend':
      return 'Suspending…'
    case 'restore':
      return 'Restoring…'
  }
}

function doneMessage(company: OpsCompany, action: CarHireCompanyReviewAction): string {
  switch (action) {
    case 'approve':
      return `${company.displayName} is active.`
    case 'reject':
      return `${company.displayName} was rejected.`
    case 'request-info':
      return `More information was requested from ${company.displayName}.`
    case 'suspend':
      return `${company.displayName} was suspended.`
    case 'restore':
      return `${company.displayName} was restored.`
  }
}

/** Adds the gap count to the approve confirmation so it is never a blind click. */
function missingGapsSentence(company: OpsCompany): string {
  const count = company.verificationGaps.length
  if (count === 0) return ''
  return ` ${count} verification item${count === 1 ? ' is' : 's are'} still missing.`
}

function notePrompt(action: CarHireCompanyReviewAction): string {
  switch (action) {
    case 'request-info':
      return 'The company sees this note and can update its details before resubmitting.'
    case 'reject':
      return 'The company sees this note. It cannot publish vehicles while rejected.'
    default:
      return 'The company sees this note. Its vehicles are hidden while suspended.'
  }
}

export default function CarHireCompaniesPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<OpsCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<{
    id: string
    action: CarHireCompanyReviewAction
  } | null>(null)
  const [noteTarget, setNoteTarget] = useState<{
    company: OpsCompany
    action: CarHireCompanyReviewAction
  } | null>(null)
  const [note, setNote] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('8')
  const [commissionSaved, setCommissionSaved] = useState('')
  const [commissionBusy, setCommissionBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/car-hire/companies?status=QUEUE', {
        headers,
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(opsApiError(data, res.status, 'Failed to load companies'))
      setItems(parseOpsCompanyPage(data))
      const commissionRes = await adminFetch('/api/admin/car-hire/commission', {
        headers,
        cache: 'no-store',
      })
      const commissionData = await commissionRes.json().catch(() => ({}))
      if (commissionRes.ok && commissionData?.config?.ratePercent != null) {
        setCommissionPercent(String(commissionData.config.ratePercent))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Data loads on mount, matching the other dashboard queues.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function run(
    company: OpsCompany,
    action: CarHireCompanyReviewAction,
    noteText?: string,
  ) {
    setBusy({ id: company.id, action })
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(
        `/api/admin/car-hire/companies/${encodeURIComponent(company.id)}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify(noteText ? { note: noteText } : {}),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(opsApiError(data, res.status, `${companyActionLabel(action)} failed`))
      }
      setNoteTarget(null)
      setNote('')
      setNotice(doneMessage(company, action))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${companyActionLabel(action)} failed`)
    } finally {
      setBusy(null)
    }
  }

  async function start(company: OpsCompany, action: CarHireCompanyReviewAction) {
    if (companyActionRequiresNote(action)) {
      setNote('')
      setNoteTarget({ company, action })
      return
    }

    const ok =
      action === 'approve'
        ? await confirm({
            title: 'Approve company?',
            message: `Activate ${company.displayName}? A company must be ACTIVE before any of its vehicles can publish.${missingGapsSentence(company)}`,
            confirmLabel: 'Approve company',
            danger: false,
          })
        : await confirm({
            title: 'Restore company?',
            message: `Restore ${company.displayName} so it can operate and publish its vehicles again.`,
            confirmLabel: 'Restore',
            danger: false,
          })
    if (!ok) return
    void run(company, action)
  }

  async function saveCommission() {
    setCommissionBusy(true)
    setError('')
    setCommissionSaved('')
    try {
      const res = await adminFetch('/api/admin/car-hire/commission', {
        method: 'PUT',
        body: JSON.stringify({ ratePercent: Number(commissionPercent) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save commission')
      if (data?.config?.ratePercent != null) {
        setCommissionPercent(String(data.config.ratePercent))
      }
      setCommissionSaved(data.message || 'Commission saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save commission')
    } finally {
      setCommissionBusy(false)
    }
  }

  function closeNote() {
    if (busy) return
    setNoteTarget(null)
    setNote('')
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="car-hire"
        title="Car hire verification"
        description="Approve car-hire companies before they can publish vehicles. A company must be ACTIVE before any of its cars can go live."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link href="/dashboard/car-hire/listings" style={linkButtonStyle}>
              Cars to verify
            </Link>
            <Link href="/dashboard/car-hire/leads" style={linkButtonStyle}>
              Callback requests
            </Link>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          </div>
        }
      />

      <section style={commissionCardStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Operator commission</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
            Taken from the rental when the trip is paid. The deposit is not commissioned. The
            operator wallet receives the rest after the return inspection.
          </p>
        </div>
        <form
          onSubmit={event => {
            event.preventDefault()
            void saveCommission()
          }}
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
            Rate
            <input
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={commissionPercent}
              onChange={event => setCommissionPercent(event.target.value)}
              style={commissionInputStyle}
            />
            %
          </label>
          <button type="submit" disabled={commissionBusy} style={neutralButtonStyle}>
            {commissionBusy ? 'Saving…' : 'Save rate'}
          </button>
        </form>
        {commissionSaved ? <p style={{ ...noticeStyle, margin: 0 }}>{commissionSaved}</p> : null}
      </section>

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

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading companies…</p>
      ) : items.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title="No companies waiting"
          hint="New applications appear here automatically as companies submit their details."
        />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            {items.length} compan{items.length === 1 ? 'y' : 'ies'} waiting for review
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(company => {
              const tone = carHireStatusTone(company.status)
              const actions = opsCompanyActions(company.status)
              const companyBusy = busy?.id === company.id ? busy.action : null
              return (
                <div
                  key={company.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'grid',
                    gap: 12,
                  }}
                >
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
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {company.displayName}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                        {prettyStatus(company.type)} · Owner {company.ownerName || '—'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                        {company.ownerEmail || '—'} ·{' '}
                        {company.ownerPhone || company.contactPhone || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        Service areas:{' '}
                        {company.serviceAreas.length > 0
                          ? company.serviceAreas.join(' · ')
                          : '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Submitted {formatDateTime(company.createdAt)} · Updated{' '}
                        {formatDateTime(company.updatedAt)}
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
                      {prettyStatus(company.status)}
                    </span>
                  </div>

                  {company.reviewerNote ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        color: '#B45309',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      Reviewer note: {company.reviewerNote}
                    </div>
                  ) : null}

                  <CompanyVerification company={company} />

                  {actions.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {actions.map(action => {
                        const isBusy = companyBusy === action
                        return (
                          <button
                            key={action}
                            type="button"
                            disabled={busy !== null}
                            aria-busy={isBusy}
                            onClick={() => void start(company, action)}
                            style={actionButtonStyle(action)}
                          >
                            {isBusy ? busyLabel(action) : companyActionLabel(action)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}

      {noteTarget ? (
        <div
          style={overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-note-title"
          onClick={closeNote}
        >
          <div style={dialogCard} onClick={event => event.stopPropagation()}>
            <h2
              id="company-note-title"
              style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}
            >
              {companyActionLabel(noteTarget.action)} {noteTarget.company.displayName}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-3)' }}>
              {notePrompt(noteTarget.action)}
            </p>
            <textarea
              autoFocus
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={4}
              placeholder="Note for the company…"
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
                onClick={closeNote}
                style={neutralButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null || !note.trim()}
                aria-busy={busy !== null}
                onClick={() =>
                  noteTarget && void run(noteTarget.company, noteTarget.action, note.trim())
                }
                style={actionButtonStyle(noteTarget.action)}
              >
                {busy !== null ? busyLabel(noteTarget.action) : companyActionLabel(noteTarget.action)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const DOCUMENT_LABELS: Record<string, string> = {
  BUSINESS_REGISTRATION: 'Business registration',
  NATIONAL_ID: 'National ID',
  TAX_CLEARANCE: 'Tax clearance',
  INSURANCE: 'Insurance',
}

/** Only http(s) links are rendered as clickable documents. */
function documentHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null
}

/**
 * What the applicant actually supplied. Ops must be able to see this before
 * approving, because an unverified company is just a phone number.
 */
function CompanyVerification({ company }: { company: OpsCompany }) {
  const isBusiness = company.type.toUpperCase() === 'BUSINESS'
  const rows = [
    isBusiness
      ? { label: 'Registration', value: company.registrationNumber || '—' }
      : { label: 'National ID', value: company.idNumber || '—' },
    { label: 'TPIN', value: company.taxId || '—' },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-2, var(--surface))',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        Verification
      </div>
      <div
        style={{
          display: 'grid',
          gap: '4px 16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        }}
      >
        {rows.map(row => (
          <div key={row.label} style={{ fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--muted)' }}>{row.label}: </span>
            <span style={{ color: 'var(--text)' }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        <span style={{ color: 'var(--muted)' }}>Documents: </span>
        {company.documents.length === 0 ? (
          <span style={{ color: 'var(--muted)' }}>None attached</span>
        ) : (
          company.documents.map((document, index) => {
            const href = documentHref(document.url)
            const label = DOCUMENT_LABELS[document.type.toUpperCase()] || prettyStatus(document.type)
            return (
              <span key={`${document.url}-${index}`}>
                {index > 0 ? ' · ' : ''}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={documentLinkStyle}>
                    {label}
                  </a>
                ) : (
                  <span>{label}</span>
                )}
              </span>
            )
          })
        )}
      </div>
      {company.verificationGaps.length > 0 ? (
        <div role="alert" style={gapWarningStyle}>
          <strong>Missing before approval:</strong>{' '}
          {company.verificationGaps.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}

function actionButtonStyle(action: CarHireCompanyReviewAction): CSSProperties {
  if (action === 'approve') {
    return {
      border: '1px solid #0F766E',
      background: '#0F766E',
      color: '#fff',
      borderRadius: 10,
      padding: '8px 12px',
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer',
    }
  }
  if (action === 'reject') {
    return {
      border: '1px solid #FECACA',
      background: '#FEF2F2',
      color: '#B91C1C',
      borderRadius: 10,
      padding: '8px 12px',
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer',
    }
  }
  if (action === 'suspend') {
    return {
      border: '1px solid #FDE68A',
      background: '#FFFBEB',
      color: '#B45309',
      borderRadius: 10,
      padding: '8px 12px',
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer',
    }
  }
  return {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  }
}

const documentLinkStyle: CSSProperties = {
  color: 'var(--accent, #0F766E)',
  fontWeight: 700,
  textDecoration: 'underline',
}

/** Amber because approving an incomplete company is the costly mistake. */
const gapWarningStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderLeft: '4px solid #F59E0B',
  color: '#92400E',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.5,
}

const commissionCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const commissionInputStyle: CSSProperties = {
  width: 88,
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '8px 10px',
  fontSize: 14,
  fontWeight: 700,
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
