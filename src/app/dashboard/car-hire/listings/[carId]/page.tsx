'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { carHireStatusTone, prettyStatus, resolveVeroMediaUrl } from '@/lib/car-hire'
import {
  opsListingLabel,
  opsListingSubtitle,
  opsListingTitle,
  opsListingTone,
  parseOpsListingDetail,
  type OpsListing,
  type OpsModerationEvent,
} from '@/lib/car-hire-ops'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import ListingActions, { opsApiError } from '../../ListingActions'

type ListingExtras = {
  depositAmount: number | null
  minRentalDays: number | null
  maxRentalDays: number | null
  description: string | null
  nextServiceDueAt: string | null
}

const EMPTY_EXTRAS: ListingExtras = {
  depositAmount: null,
  minRentalDays: null,
  maxRentalDays: null,
  description: null,
  nextServiceDueAt: null,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * The shared OpsListing type carries the moderation-safe fields. Pricing extras
 * are read tolerantly from the proxy payload when it includes them.
 */
function readExtras(data: unknown): ListingExtras {
  const body = asRecord(data)
  const row = asRecord(body.listing ?? body.data ?? data)
  return {
    depositAmount: asNumber(row.depositAmount ?? row.deposit),
    minRentalDays: asNumber(row.minRentalDays),
    maxRentalDays: asNumber(row.maxRentalDays),
    description: asText(row.description),
    nextServiceDueAt: asText(row.nextServiceDueAt),
  }
}

function dash(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const text = String(value).trim()
  return text.length > 0 ? text : '—'
}

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : '—'
}

export default function CarHireListingDetailPage() {
  const params = useParams()
  const carId = String(params?.carId || '')
  const [listing, setListing] = useState<OpsListing | null>(null)
  const [events, setEvents] = useState<OpsModerationEvent[]>([])
  const [extras, setExtras] = useState<ListingExtras>(EMPTY_EXTRAS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeImage, setActiveImage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!carId) return
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch(
        `/api/admin/car-hire/listings/${encodeURIComponent(carId)}`,
        { headers, cache: 'no-store' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(opsApiError(data, res.status, 'Failed to load listing'))
      const detail = parseOpsListingDetail(data)
      if (!detail) throw new Error('This listing could not be found.')
      setListing(detail.listing)
      setEvents(detail.events)
      setExtras(readExtras(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listing')
    } finally {
      setLoading(false)
    }
  }, [carId])

  useEffect(() => {
    // Data loads on mount and after each moderation action.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const handleDone = useCallback(
    async (message: string) => {
      setNotice(message)
      await load()
    },
    [load],
  )

  const gallery = useMemo(() => {
    if (!listing) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const raw of [listing.imageUrl, ...listing.images]) {
      if (!raw) continue
      const url = resolveVeroMediaUrl(raw)
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push(url)
    }
    return out
  }, [listing])

  const orderedEvents = useMemo(() => {
    const time = (event: OpsModerationEvent) => {
      const parsed = event.createdAt ? Date.parse(event.createdAt) : Number.NaN
      return Number.isFinite(parsed) ? parsed : 0
    }
    return [...events].sort((a, b) => time(b) - time(a))
  }, [events])

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Link href="/dashboard/car-hire/listings" style={backLinkStyle}>
          ← Cars to verify
        </Link>
        <p style={{ color: 'var(--muted)' }}>Loading listing…</p>
      </div>
    )
  }

  if (!listing) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <Link href="/dashboard/car-hire/listings" style={backLinkStyle}>
          ← Cars to verify
        </Link>
        <p role="alert" style={{ color: '#B91C1C', margin: 0 }}>
          {error || 'This listing could not be found.'}
        </p>
        <Link href="/dashboard/car-hire/listings" style={buttonLinkStyle}>
          Back to cars to verify
        </Link>
      </div>
    )
  }

  const tone = opsListingTone(listing.listingStatus)
  const availabilityTone = carHireStatusTone(
    listing.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
  )
  const cover = activeImage && gallery.includes(activeImage) ? activeImage : gallery[0]
  const title = opsListingTitle(listing)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <Link href="/dashboard/car-hire/listings" style={backLinkStyle}>
          ← Cars to verify
        </Link>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginTop: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                fontFamily: 'var(--font-display), sans-serif',
              }}
            >
              {title}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              {opsListingSubtitle(listing) || 'Vehicle details not provided'} · Plate{' '}
              {dash(listing.licensePlate)} (private) · Company {dash(listing.operatorName)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pillStyle(tone.bg, tone.color, tone.border)}>
              {opsListingLabel(listing.listingStatus)}
            </span>
            <span
              style={pillStyle(
                availabilityTone.bg,
                availabilityTone.color,
                availabilityTone.border,
              )}
            >
              {listing.isAvailable ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>

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

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '12px 14px',
          borderRadius: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <ListingActions
          listing={listing}
          onDone={handleDone}
          onError={setError}
          groupPublish
        />
        {listing.listingGroupId ? (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Approval applies to every unit in listing group {listing.listingGroupId}.
          </span>
        ) : null}
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 14,
          display: 'grid',
          gap: 10,
        }}
      >
        <div
          style={{
            height: 'min(420px, 52vh)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                color: '#C2410C',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              No photo
            </div>
          )}
        </div>
        {gallery.length > 1 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {gallery.map((url, index) => {
              const selected = cover === url
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(url)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={selected}
                  style={{
                    padding: 0,
                    width: 88,
                    height: 64,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: `2px solid ${selected ? '#EA580C' : 'var(--border)'}`,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${title} photo ${index + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        <DetailSection title="Vehicle">
          <DetailRow label="Make" value={dash(listing.make)} />
          <DetailRow label="Model" value={dash(listing.model)} />
          <DetailRow
            label="Year"
            value={listing.year != null ? String(Math.round(listing.year)) : '—'}
          />
          <DetailRow label="Colour" value={dash(listing.color)} />
          <DetailRow label="Body" value={prettyStatus(listing.bodyType)} />
          <DetailRow
            label="Seats"
            value={listing.seats != null ? String(Math.round(listing.seats)) : '—'}
          />
          <DetailRow label="Transmission" value={prettyStatus(listing.transmission)} />
          <DetailRow label="Fuel" value={prettyStatus(listing.fuelType)} />
        </DetailSection>

        <DetailSection title="Pricing">
          <DetailRow
            label="Daily rate"
            value={listing.dailyRate > 0 ? formatMwk(listing.dailyRate) : '—'}
          />
          <DetailRow
            label="Deposit"
            value={extras.depositAmount != null ? formatMwk(extras.depositAmount) : '—'}
          />
          <DetailRow
            label="Minimum days"
            value={extras.minRentalDays != null ? String(extras.minRentalDays) : '—'}
          />
          <DetailRow
            label="Maximum days"
            value={extras.maxRentalDays != null ? String(extras.maxRentalDays) : '—'}
          />
          <DetailRow label="Currency" value={dash(listing.currency)} />
        </DetailSection>

        <DetailSection title="Listing">
          <DetailRow label="Status" value={opsListingLabel(listing.listingStatus)} />
          <DetailRow label="Available" value={listing.isAvailable ? 'Yes' : 'No'} />
          <DetailRow label="Listing group" value={dash(listing.listingGroupId)} />
          <DetailRow label="Unit label" value={dash(listing.unitLabel)} />
          <DetailRow label="Next service due" value={dateOnly(extras.nextServiceDueAt)} />
          <DetailRow label="Pickup area" value={dash(listing.pickupArea)} />
          {extras.description ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
                Description
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--text-2)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {extras.description}
              </p>
            </div>
          ) : (
            <DetailRow label="Description" value="—" />
          )}
        </DetailSection>

        <DetailSection title="Company & owner">
          <DetailRow label="Company" value={dash(listing.operatorName)} />
          <DetailRow label="Operator ID" value={dash(listing.operatorId)} />
          <DetailRow label="Owner" value={dash(listing.ownerName)} />
          <DetailRow label="Email" value={dash(listing.ownerEmail)} />
          <DetailRow
            label="Owner ID"
            value={listing.ownerId != null ? String(listing.ownerId) : '—'}
          />
          <DetailRow label="Updated" value={formatDateTime(listing.updatedAt)} />
          <DetailRow label="Created" value={formatDateTime(listing.createdAt)} />
        </DetailSection>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 14,
          display: 'grid',
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Moderation history</h2>
        {orderedEvents.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            No moderation history yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {orderedEvents.map(event => (
              <div
                key={event.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 13 }}>
                    {prettyStatus(event.action)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {event.fromStatus ? prettyStatus(event.fromStatus) : '—'} →{' '}
                  {event.toStatus ? prettyStatus(event.toStatus) : '—'} ·{' '}
                  {event.actorLabel || 'System'}
                </div>
                {event.note ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--text-2)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {event.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 6 }}>{children}</div>
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <span
        style={{
          color: 'var(--text-2)',
          fontWeight: 700,
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function pillStyle(bg: string, color: string, border: string): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    background: bg,
    color,
    border: `1px solid ${border}`,
    whiteSpace: 'nowrap',
  }
}

const backLinkStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 13,
  textDecoration: 'none',
}

const buttonLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  display: 'grid',
  gap: 10,
  alignContent: 'start',
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
