'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CatalogCard } from '@/lib/catalog-cards'
import { formatMwk } from '@/lib/vero-api'

type Props = {
  items: CatalogCard[]
  initialPickupArea: string
  initialStartAt: string | null
  initialEndAt: string | null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function formatRange(startAt: string | null, endAt: string | null): string | null {
  if (!startAt || !endAt) return null
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }
  return `${start.toLocaleString(undefined, opts)} → ${end.toLocaleString(undefined, opts)}`
}

export default function CarHireBrowseClient({
  items,
  initialPickupArea,
  initialStartAt,
  initialEndAt,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [pickupArea, setPickupArea] = useState(initialPickupArea)
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [formError, setFormError] = useState('')
  const [filtering, setFiltering] = useState(false)

  useEffect(() => {
    setPickupArea(initialPickupArea)
    setStartInput(isoToLocalInput(initialStartAt))
    setEndInput(isoToLocalInput(initialEndAt))
  }, [initialPickupArea, initialStartAt, initialEndAt])

  useEffect(() => {
    setFiltering(false)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item =>
      `${item.title} ${item.meta || ''} ${item.location || ''}`.toLowerCase().includes(q),
    )
  }, [items, query])

  const rangeLabel = formatRange(initialStartAt, initialEndAt)
  const hasDateFilter = Boolean(initialStartAt && initialEndAt)
  const hasAnyFilter = Boolean(initialPickupArea || hasDateFilter)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (Boolean(startInput) !== Boolean(endInput)) {
      setFormError('Choose both a start and end date and time.')
      return
    }

    const startAt = localInputToIso(startInput)
    const endAt = localInputToIso(endInput)
    if (startInput && endInput && (!startAt || !endAt)) {
      setFormError('Enter a valid start and end date.')
      return
    }
    if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setFormError('The return date must be after the pickup date.')
      return
    }

    const params = new URLSearchParams()
    if (pickupArea.trim()) params.set('pickupArea', pickupArea.trim())
    if (startAt && endAt) {
      params.set('startAt', startAt)
      params.set('endAt', endAt)
    }
    setFiltering(true)
    router.push(params.toString() ? `/car-hire?${params.toString()}` : '/car-hire')
  }

  function resetFilters() {
    setStartInput('')
    setEndInput('')
    setPickupArea('')
    setFormError('')
    setFiltering(true)
    router.push('/car-hire')
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        aria-label="Search car hire by date and pickup area"
        style={{
          marginTop: -28,
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: 'var(--shadow)',
          padding: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label htmlFor="car-hire-pickup" style={labelStyle}>
            Pickup area
          </label>
          <input
            id="car-hire-pickup"
            value={pickupArea}
            onChange={event => setPickupArea(event.target.value)}
            placeholder="e.g. Lilongwe"
            autoComplete="address-level2"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="car-hire-start" style={labelStyle}>
            Pickup date &amp; time
          </label>
          <input
            id="car-hire-start"
            type="datetime-local"
            value={startInput}
            onChange={event => setStartInput(event.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="car-hire-end" style={labelStyle}>
            Return date &amp; time
          </label>
          <input
            id="car-hire-end"
            type="datetime-local"
            value={endInput}
            onChange={event => setEndInput(event.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={filtering} style={primaryButton}>
            {filtering ? 'Checking…' : 'Search cars'}
          </button>
          {hasAnyFilter || startInput || endInput || pickupArea ? (
            <button type="button" onClick={resetFilters} style={ghostButton}>
              Reset
            </button>
          ) : null}
        </div>
        {formError ? (
          <p role="alert" style={{ ...formMessage, color: '#B91C1C' }}>
            {formError}
          </p>
        ) : (
          <p style={formMessage}>
            Availability only reflects the dates you choose. Leave dates empty to browse every
            published vehicle.
          </p>
        )}
      </form>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '28px 0 18px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.3px' }}>
            {filtered.length} {filtered.length === 1 ? 'car' : 'cars'} available
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            {rangeLabel || 'Browse all published vehicles'}
            {initialPickupArea ? ` · Pickup in ${initialPickupArea}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ position: 'relative', minWidth: 220, flex: '1 1 240px', maxWidth: 320 }}>
            <span className="sr-only">Search cars</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search make, model, or area…"
              autoComplete="off"
              style={{ ...inputStyle, paddingLeft: 38 }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 13,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-4)',
                fontSize: 15,
              }}
            >
              ⌕
            </span>
          </label>
          <Link href="/car-hire/manage" style={ghostButton}>
            Provider dashboard
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={hasAnyFilter ? 'No cars available for these filters' : 'No cars listed yet'}
          body={
            hasAnyFilter
              ? 'Try a different pickup area or date range. Providers may also be reviewing their availability.'
              : 'Published car-hire vehicles will appear here as providers list them. Check back soon.'
          }
          onReset={hasAnyFilter ? resetFilters : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No cars match your search"
          body="Try a different make, model, or pickup area."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map(item => (
            <CarCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p
        style={{
          margin: '30px 0 0',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text-3)',
          maxWidth: 760,
        }}
      >
        Prices are provider daily rates in MWK and may exclude fuel, deposit, delivery, or optional
        extras. The Vero360 app shows the authoritative quote and rental terms before you confirm a
        booking. Listings are provider-managed and availability can change.
      </p>
    </>
  )
}

function CarCard({ item }: { item: CatalogCard }) {
  return (
    <Link href={item.href || '/car-hire'} style={cardStyle} prefetch>
      <div style={{ position: 'relative', background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)' }}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              display: 'grid',
              placeItems: 'center',
              color: '#C2410C',
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            Vero360 Car Hire
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 900,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
          {item.meta || 'Vehicle details in the app'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
          {item.location ? `Pickup: ${item.location}` : 'Pickup area confirmed in the app'}
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 12,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: '#C2410C' }}>
            {item.price != null && item.price > 0 ? `${formatMwk(item.price)} / day` : 'Rate in app'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-2)' }}>View →</span>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({
  title,
  body,
  onReset,
}: {
  title: string
  body: string
  onReset?: () => void
}) {
  return (
    <div
      style={{
        padding: '42px 24px',
        borderRadius: 20,
        border: '1px dashed var(--border-2)',
        background: '#fff',
        textAlign: 'center',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h3>
      <p style={{ margin: '8px auto 0', maxWidth: 440, fontSize: 14, color: 'var(--text-3)' }}>
        {body}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
        {onReset ? (
          <button type="button" onClick={onReset} style={primaryButton}>
            Clear filters
          </button>
        ) : null}
        <Link href="/car-hire/manage" style={ghostButton}>
          Provider dashboard
        </Link>
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text-2)',
  marginBottom: 7,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 13px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--text)',
  outline: 'none',
}

const primaryButton: CSSProperties = {
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 12,
  padding: '12px 18px',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
}

const ghostButton: CSSProperties = {
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
}

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 18,
  overflow: 'hidden',
  textDecoration: 'none',
  color: 'inherit',
  display: 'block',
  boxShadow: 'var(--shadow-sm)',
}

const formMessage: CSSProperties = {
  gridColumn: '1 / -1',
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-3)',
}
