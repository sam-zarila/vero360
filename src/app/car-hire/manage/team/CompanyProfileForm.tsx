'use client'

import { useState, type FormEvent } from 'react'
import type { OperatorSummary } from '@/lib/car-hire'
import { ProviderApiError, updateOperatorProfile } from '@/lib/car-hire-owner-api'
import { inputStyle, labelStyle, primaryButton } from '../components/ProviderUI'

type Draft = {
  displayName: string
  contactPhone: string
  serviceAreas: string
  logoUrl: string
  defaultDepositAmount: string
  defaultMinRentalDays: string
  defaultMaxRentalDays: string
  turnaroundMinutes: string
  instantBook: boolean
}

function draftFrom(operator: OperatorSummary): Draft {
  return {
    displayName: operator.displayName,
    contactPhone: operator.contactPhone ?? '',
    serviceAreas: operator.serviceAreas.join(', '),
    logoUrl: operator.logoUrl ?? '',
    defaultDepositAmount:
      operator.defaultDepositAmount != null ? String(operator.defaultDepositAmount) : '',
    defaultMinRentalDays:
      operator.defaultMinRentalDays != null ? String(operator.defaultMinRentalDays) : '',
    defaultMaxRentalDays:
      operator.defaultMaxRentalDays != null ? String(operator.defaultMaxRentalDays) : '',
    turnaroundMinutes: String(operator.turnaroundMinutes || 0),
    instantBook: operator.instantBook,
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Company name, branding and rental defaults. The name and logo are what
 * renters see as "Provided by" on every listing.
 */
export default function CompanyProfileForm({
  operator,
  onSaved,
}: {
  operator: OperatorSummary
  onSaved: (message: string) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(operator))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: Exclude<keyof Draft, 'instantBook'>) => (value: string) =>
    setDraft(previous => ({ ...previous, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.displayName.trim()) {
      setError('Company name is required.')
      return
    }
    const min = optionalNumber(draft.defaultMinRentalDays)
    const max = optionalNumber(draft.defaultMaxRentalDays)
    if (min != null && max != null && max < min) {
      setError('Maximum rental days cannot be less than the minimum.')
      return
    }
    const turnaround = optionalNumber(draft.turnaroundMinutes) ?? 0
    if (!Number.isInteger(turnaround) || turnaround < 0 || turnaround > 1440) {
      setError('Turnaround must be between 0 and 1440 minutes.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateOperatorProfile(operator.id, {
        displayName: draft.displayName.trim(),
        contactPhone: draft.contactPhone.trim(),
        serviceAreas: draft.serviceAreas
          .split(',')
          .map(area => area.trim())
          .filter(Boolean),
        logoUrl: draft.logoUrl.trim() || null,
        defaultDepositAmount: optionalNumber(draft.defaultDepositAmount),
        defaultMinRentalDays: min,
        defaultMaxRentalDays: max,
        turnaroundMinutes: turnaround,
        instantBook: draft.instantBook,
      })
      onSaved(`${draft.displayName.trim()} profile saved.`)
    } catch (err) {
      setError(
        err instanceof ProviderApiError && err.status === 403
          ? 'Only the company owner or members with team.manage can edit the profile.'
          : err instanceof Error
            ? err.message
            : 'The profile could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  const field = (
    key: Exclude<keyof Draft, 'instantBook'>,
    label: string,
    props: { placeholder?: string; inputMode?: 'numeric' | 'decimal' | 'tel' } = {},
  ) => (
    <div>
      <label htmlFor={`${operator.id}-${key}`} style={labelStyle}>
        {label}
      </label>
      <input
        id={`${operator.id}-${key}`}
        value={draft[key]}
        onChange={event => set(key)(event.target.value)}
        disabled={busy}
        style={inputStyle}
        {...props}
      />
    </div>
  )

  return (
    <form onSubmit={submit} style={formBlock}>
      <div>
        <h3 style={subTitle}>Company profile</h3>
        <p style={smallMeta}>
          Renters see the company name and logo on every listing. Defaults apply to new
          vehicles; each vehicle can still override them.
        </p>
      </div>
      <div style={grid}>
        {field('displayName', 'Company name')}
        {field('contactPhone', 'Contact phone', { inputMode: 'tel' })}
        {field('logoUrl', 'Logo URL', { placeholder: 'https://…' })}
        {field('serviceAreas', 'Service areas', { placeholder: 'Lilongwe, Blantyre' })}
        {field('defaultDepositAmount', 'Default deposit', { inputMode: 'decimal' })}
        {field('defaultMinRentalDays', 'Default minimum days', { inputMode: 'numeric' })}
        {field('defaultMaxRentalDays', 'Default maximum days', { inputMode: 'numeric' })}
        {field('turnaroundMinutes', 'Turnaround between rentals (minutes)', {
          inputMode: 'numeric',
          placeholder: '120',
        })}
      </div>
      <div>
        <span style={labelStyle}>How renters book</span>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={choice}>
            <input
              type="radio"
              name={`${operator.id}-booking-mode`}
              checked={draft.instantBook}
              onChange={() => setDraft(previous => ({ ...previous, instantBook: true }))}
              disabled={busy}
            />
            <span>
              <strong>Instant book</strong> — the booking is confirmed as soon as the renter pays.
            </span>
          </label>
          <label style={choice}>
            <input
              type="radio"
              name={`${operator.id}-booking-mode`}
              checked={!draft.instantBook}
              onChange={() => setDraft(previous => ({ ...previous, instantBook: false }))}
              disabled={busy}
            />
            <span>
              <strong>Request to book</strong> — you accept or decline within 24 hours, then the
              renter pays. Requests you do not answer expire.
            </span>
          </label>
        </div>
      </div>
      {error ? (
        <p role="alert" style={{ ...smallMeta, color: '#B91C1C', fontWeight: 700 }}>
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={busy} style={primaryButton}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}

const smallMeta = {
  margin: '4px 0 0',
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--text-3)',
} as const

const subTitle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: '-0.2px',
} as const

const formBlock = {
  display: 'grid',
  gap: 10,
  marginTop: 14,
  paddingTop: 14,
  borderTop: '1px solid var(--border)',
} as const

const choice = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-2)',
} as const

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 10,
} as const
