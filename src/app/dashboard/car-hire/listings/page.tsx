'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { carHireStatusTone, resolveVeroMediaUrl } from '@/lib/car-hire'
import {
  CAR_HIRE_LISTING_STATUSES,
  EMPTY_LISTING_COUNTS,
  opsListingLabel,
  opsListingSubtitle,
  opsListingTitle,
  opsListingTone,
  parseOpsListingPage,
  type CarHireListingStatus,
  type OpsListing,
  type OpsListingCounts,
} from '@/lib/car-hire-ops'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import ListingActions, { opsApiError } from '../ListingActions'

const SECTION = DASHBOARD_SECTION_MAP['car-hire']

export default function CarHireListingsPage() {
  const [status, setStatus] = useState<CarHireListingStatus>('PENDING_REVIEW')
  const [items, setItems] = useState<OpsListing[]>([])
  const [counts, setCounts] = useState<OpsListingCounts>(EMPTY_LISTING_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch(
        `/api/admin/car-hire/listings?status=${encodeURIComponent(status)}`,
        { headers, cache: 'no-store' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(opsApiError(data, res.status, 'Failed to load listings'))
      const page = parseOpsListingPage(data)
      setItems(page.items)
      setCounts(page.counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    // Data loads on mount and on tab change, matching the other dashboard queues.
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(listing => {
      const haystack = [
        opsListingTitle(listing),
        listing.make,
        listing.model,
        listing.licensePlate,
        listing.pickupArea,
        listing.operatorName,
        listing.ownerName,
        listing.ownerEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="car-hire"
        title="Cars to verify"
        description="Review vehicle listings before they go live. Registration plates stay private and are shown to operations only."
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CAR_HIRE_LISTING_STATUSES.map(next => {
          const active = status === next
          return (
            <button
              key={next}
              type="button"
              onClick={() => setStatus(next)}
              style={{
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary-soft, #FFF7ED)' : 'var(--surface)',
                color: active ? 'var(--primary)' : 'var(--text)',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {opsListingLabel(next)} ({counts[next]})
            </button>
          )
        })}
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search make, plate, pickup area, company, owner email…"
        label="Search car hire listings"
        onClear={() => setQuery('')}
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading listings…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title={
            query.trim()
              ? 'No listings match your search'
              : `No ${opsListingLabel(status).toLowerCase()} listings`
          }
          hint={
            query.trim()
              ? 'Try a different make, plate, pickup area, company, or owner email.'
              : 'Switch tabs to review another status. New listings appear automatically.'
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map(listing => {
            const tone = opsListingTone(listing.listingStatus)
            const availabilityTone = carHireStatusTone(
              listing.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
            )
            const image = resolveVeroMediaUrl(listing.imageUrl)
            return (
              <article
                key={listing.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    height: 150,
                    background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
                    overflow: 'hidden',
                  }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={opsListingTitle(listing)}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
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

                <div
                  style={{
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                    {opsListingTitle(listing)}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--text-3)',
                    }}
                  >
                    {opsListingSubtitle(listing) || 'Vehicle details not provided'}
                  </p>

                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Plate (private): </span>
                      {listing.licensePlate || '—'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Rate: </span>
                      {formatMwk(listing.dailyRate)} / day
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Pickup area: </span>
                      {listing.pickupArea || '—'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Company: </span>
                      {listing.operatorName || '—'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Owner: </span>
                      {listing.ownerName || '—'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--muted)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {listing.ownerEmail || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Updated {formatDateTime(listing.updatedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      marginTop: 'auto',
                      paddingTop: 4,
                    }}
                  >
                    <ListingActions
                      listing={listing}
                      onDone={handleDone}
                      onError={setError}
                    />
                    <Link
                      href={`/dashboard/car-hire/listings/${listing.id}`}
                      style={linkButtonStyle}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
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

const linkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
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
