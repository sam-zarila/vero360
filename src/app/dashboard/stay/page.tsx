'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { VeroIcon } from '@/app/components/landing/icons'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import {
  ACCOMMODATION_TYPES,
  BOOKING_PAYMENT_STATUSES,
  availabilityLabel,
  bookingStatusLabel,
  formatDateTime,
  formatMwk,
  partyContactLine,
  paymentTone,
  pricingLabel,
  resolveStayImage,
  typeLabel,
  typeTone,
  type StayBooking,
  type StayListing,
} from '@/lib/stay'
import { useConfirmDelete } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP.stay

type MainTab = 'listings' | 'bookings'
type TypeFilter = 'all' | (typeof ACCOMMODATION_TYPES)[number]
type AvailabilityFilter = 'all' | 'available' | 'unavailable'
type PaymentFilter = 'all' | (typeof BOOKING_PAYMENT_STATUSES)[number]

type ListingCounts = {
  all: number
  available: number
  unavailable: number
  hotel: number
  lodge: number
  bnb: number
  house: number
  hostel: number
  apartment: number
}

type BookingCounts = {
  all: number
  paid: number
  unpaid: number
  failed: number
}

const EMPTY_LISTING_COUNTS: ListingCounts = {
  all: 0,
  available: 0,
  unavailable: 0,
  hotel: 0,
  lodge: 0,
  bnb: 0,
  house: 0,
  hostel: 0,
  apartment: 0,
}

const EMPTY_BOOKING_COUNTS: BookingCounts = {
  all: 0,
  paid: 0,
  unpaid: 0,
  failed: 0,
}

export default function StayAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [mainTab, setMainTab] = useState<MainTab>('listings')
  const [listings, setListings] = useState<StayListing[]>([])
  const [bookings, setBookings] = useState<StayBooking[]>([])
  const [listingCounts, setListingCounts] = useState<ListingCounts>(EMPTY_LISTING_COUNTS)
  const [bookingCounts, setBookingCounts] = useState<BookingCounts>(EMPTY_BOOKING_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, bookRes] = await Promise.all([
        adminFetch('/api/admin/stay', { cache: 'no-store' }),
        adminFetch('/api/admin/stay/bookings', { cache: 'no-store' }),
      ])
      const listData = await listRes.json()
      const bookData = await bookRes.json()

      const errors: string[] = []
      if (!listRes.ok) errors.push(listData.error || 'Failed to load listings')
      else {
        setListings(listData.items || [])
        setListingCounts(listData.counts || EMPTY_LISTING_COUNTS)
      }

      if (!bookRes.ok) errors.push(bookData.error || 'Failed to load bookings')
      else {
        setBookings(bookData.items || [])
        setBookingCounts(bookData.counts || EMPTY_BOOKING_COUNTS)
      }

      if (errors.length) setError(errors.join(' · '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stay data')
    } finally {
      setLoading(false)
    }
  }, [])

  const removeListing = async (item: StayListing) => {
    if (
      !(await confirmDelete(
        item.name,
        'Permanently remove this accommodation listing and its room details? This cannot be undone.',
      ))
    ) {
      return
    }
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/stay/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Removed “${item.name}”`)
      setListings(prev => prev.filter(x => x.id !== item.id))
      setListingCounts(prev => {
        const next = { ...prev }
        next.all = Math.max(0, (next.all || 0) - 1)
        const t = String(item.accommodationType)
        if (t in next) next[t as keyof ListingCounts] = Math.max(0, (next[t as keyof ListingCounts] as number) - 1)
        if (item.isAvailable === true) next.available = Math.max(0, next.available - 1)
        if (item.isAvailable === false) next.unavailable = Math.max(0, next.unavailable - 1)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listings.filter(item => {
      if (typeFilter !== 'all' && item.accommodationType !== typeFilter) return false
      if (availabilityFilter === 'available' && item.isAvailable !== true) return false
      if (availabilityFilter === 'unavailable' && item.isAvailable !== false) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.hostName || '').toLowerCase().includes(q) ||
        (item.hostEmail || '').toLowerCase().includes(q) ||
        (item.hostPhone || '').toLowerCase().includes(q) ||
        (item.hostelGender || '').toLowerCase().includes(q) ||
        typeLabel(item.accommodationType).toLowerCase().includes(q)
      )
    })
  }, [listings, query, typeFilter, availabilityFilter])

  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter(item => {
      if (paymentFilter !== 'all' && item.paymentStatus !== paymentFilter) return false
      if (!q) return true
      return (
        item.bookingNumber.toLowerCase().includes(q) ||
        (item.accommodationName || '').toLowerCase().includes(q) ||
        (item.accommodationLocation || '').toLowerCase().includes(q) ||
        (item.guestName || '').toLowerCase().includes(q) ||
        (item.guestEmail || '').toLowerCase().includes(q) ||
        (item.guestPhone || '').toLowerCase().includes(q) ||
        (item.hostName || '').toLowerCase().includes(q)
      )
    })
  }, [bookings, query, paymentFilter])

  const typeTabs: Array<{ id: TypeFilter; label: string; count: number }> = [
    { id: 'all', label: 'All types', count: listingCounts.all },
    ...ACCOMMODATION_TYPES.map(t => ({
      id: t as TypeFilter,
      label: typeLabel(t),
      count: listingCounts[t] ?? 0,
    })),
  ]

  const availabilityTabs: Array<{ id: AvailabilityFilter; label: string; count: number }> = [
    { id: 'all', label: 'Any availability', count: listingCounts.all },
    { id: 'available', label: 'Available', count: listingCounts.available },
    { id: 'unavailable', label: 'Unavailable', count: listingCounts.unavailable },
  ]

  const paymentTabs: Array<{ id: PaymentFilter; label: string; count: number }> = [
    { id: 'all', label: 'All payments', count: bookingCounts.all },
    { id: 'PAID', label: 'Paid', count: bookingCounts.paid },
    { id: 'UNPAID', label: 'Unpaid', count: bookingCounts.unpaid },
    { id: 'FAILED', label: 'Failed', count: bookingCounts.failed },
  ]

  return (
    <div>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="stay"
        description="Manage accommodations, host contacts, and guest bookings in one place."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(
          [
            { id: 'listings' as const, label: 'Listings', count: listingCounts.all },
            { id: 'bookings' as const, label: 'Bookings', count: bookingCounts.all },
          ] as const
        ).map(tab => {
          const active = mainTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMainTab(tab.id)
                setQuery('')
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-50)' : '#fff',
                color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {tab.label} ({tab.count})
            </button>
          )
        })}
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder={
          mainTab === 'listings'
            ? 'Search name, location, host…'
            : 'Search booking #, guest, property…'
        }
        label={mainTab === 'listings' ? 'Search listings' : 'Search bookings'}
        onClear={() => setQuery('')}
      />

      {mainTab === 'listings' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {typeTabs.map(t => {
              const active = typeFilter === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 100,
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'var(--primary-50)' : '#fff',
                    color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t.label} ({t.count})
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {availabilityTabs.map(t => {
              const active = availabilityFilter === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAvailabilityFilter(t.id)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 100,
                    border: active ? '1px solid #047857' : '1px solid var(--border)',
                    background: active ? '#ECFDF5' : '#fff',
                    color: active ? '#047857' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t.label} ({t.count})
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {paymentTabs.map(t => {
            const active = paymentFilter === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPaymentFilter(t.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 100,
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--primary-50)' : '#fff',
                  color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {t.label} ({t.count})
              </button>
            )
          })}
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
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading stay data…</p>
        ) : mainTab === 'listings' ? (
          filteredListings.length === 0 ? (
            <DashboardEmptyState
              icon={SECTION.icon}
              color={SECTION.color}
              title={
                query.trim() || typeFilter !== 'all' || availabilityFilter !== 'all'
                  ? 'No listings match your filters'
                  : 'No accommodations listed yet'
              }
              hint={
                query.trim() || typeFilter !== 'all' || availabilityFilter !== 'all'
                  ? 'Try clearing search or changing type / availability.'
                  : 'New host listings from the app will show up here.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredListings.map(item => {
                const img = resolveStayImage(item.image)
                const tone = typeTone(item.accommodationType)
                const avail =
                  item.isAvailable === true
                    ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
                    : item.isAvailable === false
                      ? { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
                      : { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' }
                return (
                  <article
                    key={item.id}
                    className="stay-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 1fr auto',
                      gap: 14,
                      padding: 14,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        width: 96,
                        height: 80,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#fff',
                        border: '1px solid var(--border)',
                        position: 'relative',
                      }}
                    >
                      {img ? (
                        <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                      ) : (
                        <DashboardThumbFallback
                          icon={SECTION.icon}
                          color={SECTION.color}
                          bg={SECTION.bg}
                        />
                      )}
                    </div>

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
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.name}</h3>
                        <Chip {...tone}>{typeLabel(item.accommodationType)}</Chip>
                        <Chip {...avail}>{availabilityLabel(item.isAvailable)}</Chip>
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text-2)',
                          marginBottom: 8,
                        }}
                      >
                        {pricingLabel(item.pricingPeriod, item.price)}
                        {item.capacity != null ? ` · ${item.capacity} capacity` : ''}
                        {item.hostelGender
                          ? ` · ${item.hostelGender.charAt(0).toUpperCase()}${item.hostelGender.slice(1)} hostel`
                          : ''}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 8,
                        }}
                      >
                        <Meta label="Location" value={item.location} />
                        <Meta
                          label="Host"
                          value={item.hostName || '—'}
                          sub={
                            partyContactLine(item.hostPhone, item.hostEmail) ||
                            'No phone or email'
                          }
                        />
                        {item.description ? (
                          <Meta
                            label="About"
                            value={
                              item.description.length > 90
                                ? `${item.description.slice(0, 90)}…`
                                : item.description
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 110 }}>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void removeListing(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid #FECACA',
                          background: busyId === item.id ? '#FEE2E2' : '#FEF2F2',
                          color: '#B91C1C',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: busyId === item.id ? 'wait' : 'pointer',
                          opacity: busyId === item.id ? 0.7 : 1,
                        }}
                      >
                        <VeroIcon name="trash" size={14} strokeWidth={2.35} color="currentColor" />
                        {busyId === item.id ? 'Removing…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        ) : filteredBookings.length === 0 ? (
          <DashboardEmptyState
            icon="calendar"
            color={SECTION.color}
            title={
              query.trim() || paymentFilter !== 'all'
                ? 'No bookings match your filters'
                : 'No accommodation bookings yet'
            }
            hint={
              query.trim() || paymentFilter !== 'all'
                ? 'Try clearing search or changing the payment filter.'
                : 'Guest and host bookings from the app appear here.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredBookings.map(item => {
              const img = resolveStayImage(item.accommodationImage)
              const pay = paymentTone(item.paymentStatus)
              return (
                <article
                  key={item.id}
                  className="stay-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 72,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      position: 'relative',
                    }}
                  >
                    {img ? (
                      <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                        size={24}
                      />
                    )}
                  </div>

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
                        {item.accommodationName || 'Accommodation'}
                      </h3>
                      <Chip {...pay}>{item.paymentStatus}</Chip>
                      <Chip bg="#EFF6FF" color="#1D4ED8" border="#BFDBFE">
                        {bookingStatusLabel(item.bookingStatus)}
                      </Chip>
                      {item.accommodationType ? (
                        <Chip {...typeTone(item.accommodationType)}>
                          {typeLabel(item.accommodationType)}
                        </Chip>
                      ) : null}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text-2)',
                        marginBottom: 8,
                      }}
                    >
                      {item.bookingNumber} · {formatMwk(item.price)}
                      {item.bookingFee != null ? ` + fee ${formatMwk(item.bookingFee)}` : ''}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta
                        label="Guest"
                        value={item.guestName || '—'}
                        sub={
                          partyContactLine(item.guestPhone, item.guestEmail) ||
                          'No phone or email'
                        }
                      />
                      <Meta
                        label="Host"
                        value={item.hostName || '—'}
                        sub={
                          partyContactLine(item.hostPhone, item.hostEmail) || undefined
                        }
                      />
                      <Meta
                        label="Stay date"
                        value={item.bookingDate || '—'}
                        sub={
                          item.checkOutDate
                            ? `Checkout ${item.checkOutDate}`
                            : item.accommodationLocation || undefined
                        }
                      />
                      <Meta
                        label="Property"
                        value={item.accommodationLocation || '—'}
                        sub={formatDateTime(item.createdAt)}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

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
          .stay-row {
            grid-template-columns: 72px 1fr !important;
          }
          .stay-row > div:last-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  )
}

function Chip({
  children,
  bg,
  color,
  border,
}: {
  children: React.ReactNode
  bg: string
  color: string
  border: string
}) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 100,
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </span>
  )
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
