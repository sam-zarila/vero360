'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  carHireStatusTone,
  carSubtitle,
  carTitle,
  listingStatusLabel,
  maintenanceCategoryLabel,
  resolveCarImage,
  type CarListing,
  type MaintenanceCategory,
} from '@/lib/car-hire'
import {
  createMaintenanceBlock,
  getFleet,
  ProviderApiError,
} from '@/lib/car-hire-owner-api'
import { formatMwk } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import {
  DateRangeFields,
  defaultBlockRange,
  localInputToIso,
} from '../components/ProviderDateRange'
import {
  ProviderCard,
  ProviderEmpty,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatusBadge,
  dangerButton,
  ghostButton,
  inputStyle,
  labelStyle,
  primaryButton,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

type BlockForm = {
  carId: number
  carTitle: string
  startAt: string
  endAt: string
  category: MaintenanceCategory
  reason: string
  confirming: boolean
}

export default function ProviderFleetPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [fleet, setFleet] = useState<CarListing[]>([])
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [block, setBlock] = useState<BlockForm | null>(null)
  const [blockBusy, setBlockBusy] = useState(false)
  const [blockError, setBlockError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    try {
      const cars = await getFleet()
      setFleet(cars)
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) {
        setSessionExpired(true)
      }
      setError(
        err instanceof Error ? err.message : 'Could not load your fleet. Please try again.',
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return fleet
    return fleet.filter(car =>
      `${carTitle(car)} ${car.pickupArea || ''} ${car.listingStatus}`
        .toLowerCase()
        .includes(q),
    )
  }, [fleet, query])

  function openBlockForm(car: CarListing) {
    const range = defaultBlockRange()
    setBlock({
      carId: car.id,
      carTitle: carTitle(car),
      startAt: range.startAt,
      endAt: range.endAt,
      category: 'MAINTENANCE',
      reason: '',
      confirming: false,
    })
    setBlockError('')
    setNotice('')
    setExpandedId(null)
  }

  async function submitBlock() {
    if (!block) return
    setBlockError('')
    const startAt = localInputToIso(block.startAt)
    const endAt = localInputToIso(block.endAt)
    if (!startAt || !endAt) {
      setBlockError('Choose a valid start and end date.')
      return
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setBlockError('The block end must be after its start.')
      return
    }

    setBlockBusy(true)
    try {
      await createMaintenanceBlock(block.carId, {
        startAt,
        endAt,
        category: block.category,
        reason: block.reason.trim() || undefined,
      })
      setNotice(
        `${block.carTitle} is blocked from ${block.startAt.replace('T', ' ')} to ${block.endAt.replace('T', ' ')}. It will not appear as bookable for those dates.`,
      )
      setBlock(null)
      await load()
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 409) {
        setBlockError(
          'Those dates conflict with an existing booking, hold, or maintenance block. Choose different dates or check the calendar.',
        )
      } else if (err instanceof ProviderApiError && err.status === 401) {
        setBlockError('Your session expired. Sign out and sign in again.')
      } else {
        setBlockError(
          err instanceof Error ? err.message : 'Could not create the maintenance block.',
        )
      }
      setBlock(current => (current ? { ...current, confirming: false } : current))
    } finally {
      setBlockBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Fleet"
          description="Vehicles belonging to your approved operator workspace."
        />
        <ProviderLoading label="Loading your fleet…" />
      </>
    )
  }

  if (state === 'error') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Fleet"
          description="Vehicles belonging to your approved operator workspace."
        />
        <ProviderError
          message={
            sessionExpired
              ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
              : error || 'Could not load your fleet.'
          }
          onRetry={() => void load()}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : undefined
          }
        />
      </>
    )
  }

  return (
    <>
      <ProviderPageHeading
        eyebrow="Provider workspace"
        title="Fleet"
        description="Listing status and operational availability are separate. Blocks prevent new bookings for the selected dates but do not unpublish a listing."
        actions={
          <button type="button" onClick={() => void load()} style={ghostButton}>
            Refresh fleet
          </button>
        }
      />

      {notice ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="success">{notice}</ProviderNotice>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <label style={{ flex: '1 1 260px', maxWidth: 380 }}>
          <span className="sr-only">Search fleet</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search vehicle, area, or listing status…"
            autoComplete="off"
            style={inputStyle}
          />
        </label>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
          {filtered.length} of {fleet.length} vehicle{fleet.length === 1 ? '' : 's'}
        </p>
      </div>

      {fleet.length === 0 ? (
        <ProviderEmpty
          title="No vehicles in this workspace"
          body="Create or submit a vehicle listing in the Vero360 app. Once the listing belongs to your approved operator, it appears here. Vehicle approval is separate from operator approval."
          action={
            <Link href="/car-hire/manage/bookings" style={ghostButton}>
              Open bookings
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <ProviderEmpty
          title="No vehicles match your search"
          body="Try a different make, model, pickup area, or listing status."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map(car => {
            const image = resolveCarImage(car)
            const expanded = expandedId === car.id
            const listingTone = carHireStatusTone(car.listingStatus)
            const availabilityTone = carHireStatusTone(
              car.isAvailable === false ? 'UNAVAILABLE' : 'AVAILABLE',
            )
            const available =
              car.isAvailable === false
                ? 'Unavailable now'
                : car.isAvailable === true
                  ? 'Available'
                  : 'Availability not set'

            return (
              <ProviderCard key={car.id} padding={0} style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    height: 132,
                    background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
                    overflow: 'hidden',
                  }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={carTitle(car)}
                      loading="lazy"
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

                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <StatusBadge tone={listingTone} label={listingStatusLabel(car.listingStatus)} />
                    <StatusBadge tone={availabilityTone} label={available} />
                    {car.availableForDates === false ? (
                      <StatusBadge tone={carHireStatusTone('UNAVAILABLE')} label="Dates blocked" />
                    ) : null}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: '-0.2px' }}>
                    {carTitle(car)}
                  </h2>
                  <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' }}>
                    {carSubtitle(car) || 'Vehicle details not provided'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 11,
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#C2410C' }}>
                      {car.dailyRate > 0 ? `${formatMwk(car.dailyRate)} / day` : 'Rate not set'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)' }}>
                      {car.seats ? `${Math.round(car.seats)} seats` : 'Seats not set'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : car.id)}
                      style={ghostButton}
                    >
                      {expanded ? 'Hide details' : 'Details'}
                    </button>
                    <button type="button" onClick={() => openBlockForm(car)} style={ghostButton}>
                      Block dates
                    </button>
                    <Link href={`/car-hire/${car.id}`} style={ghostButton}>
                      Public page
                    </Link>
                  </div>

                  {expanded ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        display: 'grid',
                        gap: 5,
                      }}
                    >
                      <DetailRow label="Pickup area" value={car.pickupArea || 'Not set'} />
                      <DetailRow label="Transmission" value={car.transmission || 'Not set'} />
                      <DetailRow label="Fuel" value={car.fuelType || 'Not set'} />
                      <DetailRow
                        label="Minimum rental"
                        value={`${car.minRentalDays} ${car.minRentalDays === 1 ? 'day' : 'days'}`}
                      />
                      <DetailRow
                        label="Deposit"
                        value={car.depositAmount > 0 ? formatMwk(car.depositAmount) : 'None listed'}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-3)' }}>
                        {car.description || 'No description on this listing.'}
                      </p>
                    </div>
                  ) : null}

                  {block && block.carId === car.id ? (
                    <BlockDatesForm
                      block={block}
                      busy={blockBusy}
                      error={blockError}
                      onChange={next => setBlock(next)}
                      onCancel={() => {
                        setBlock(null)
                        setBlockError('')
                      }}
                      onConfirm={() => void submitBlock()}
                    />
                  ) : null}
                </div>
              </ProviderCard>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          Private vehicle data such as registration plates, owner identifiers, and tracker details
          is never rendered on this page. Maintenance reasons are for your workspace only.
        </ProviderNotice>
      </div>
    </>
  )
}

function BlockDatesForm({
  block,
  busy,
  error,
  onChange,
  onCancel,
  onConfirm,
}: {
  block: BlockForm
  busy: boolean
  error: string
  onChange: (next: BlockForm) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      style={{
        marginTop: 13,
        padding: 13,
        borderRadius: 13,
        border: '1px solid #FED7AA',
        background: '#FFFBF5',
        display: 'grid',
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#9A3412' }}>
          Block {block.carTitle}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, lineHeight: 1.5, color: '#9A3412' }}>
          Blocked vehicles are removed from date-based search for this interval. Existing bookings
          are not cancelled.
        </p>
      </div>

      <DateRangeFields
        idPrefix={`block-${block.carId}`}
        startAt={block.startAt}
        endAt={block.endAt}
        onStartChange={value => onChange({ ...block, startAt: value, confirming: false })}
        onEndChange={value => onChange({ ...block, endAt: value, confirming: false })}
        disabled={busy}
      />

      <div>
        <label htmlFor={`block-${block.carId}-category`} style={labelStyle}>
          Category
        </label>
        <select
          id={`block-${block.carId}-category`}
          value={block.category}
          onChange={event =>
            onChange({
              ...block,
              category: event.target.value as MaintenanceCategory,
              confirming: false,
            })
          }
          disabled={busy}
          style={inputStyle}
        >
          <option value="MAINTENANCE">Maintenance</option>
          <option value="CLEANING">Cleaning</option>
          <option value="SAFETY">Safety hold</option>
        </select>
      </div>

      <div>
        <label htmlFor={`block-${block.carId}-reason`} style={labelStyle}>
          Reason (internal, optional)
        </label>
        <textarea
          id={`block-${block.carId}-reason`}
          value={block.reason}
          onChange={event => onChange({ ...block, reason: event.target.value, confirming: false })}
          disabled={busy}
          rows={2}
          placeholder="e.g. Scheduled service"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }}>
          {error}
        </p>
      ) : null}

      {!block.confirming ? (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onChange({ ...block, confirming: true })}
            style={ghostButton}
            disabled={busy}
          >
            Review block
          </button>
          <button type="button" onClick={onCancel} style={ghostButton} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: 11,
            borderRadius: 11,
            border: '1px solid #FECACA',
            background: '#FFF7F7',
          }}
        >
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#991B1B', fontWeight: 700 }}>
            Block {block.carTitle} from {block.startAt.replace('T', ' ')} to{' '}
            {block.endAt.replace('T', ' ')} for {maintenanceCategoryLabel(block.category)}? It will
            not be bookable during this interval.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
            <button type="button" onClick={onConfirm} style={dangerButton} disabled={busy}>
              {busy ? 'Creating block…' : 'Create block'}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...block, confirming: false })}
              style={ghostButton}
              disabled={busy}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>{label}</span>
      <span style={{ color: 'var(--text-2)', fontWeight: 800, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
