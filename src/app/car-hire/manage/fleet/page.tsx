'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  carHireStatusTone,
  carSubtitle,
  carTitle,
  listingStatusLabel,
  maintenanceCategoryLabel,
  resolveCarImage,
  type MaintenanceCategory,
  type OwnerVehicle,
  type VehicleInput,
} from '@/lib/car-hire'
import {
  createMaintenanceBlock,
  createVehicle,
  getFleet,
  ProviderApiError,
  updateVehicle,
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

type VehicleForm = {
  mode: 'create' | 'edit'
  carId: number | null
  make: string
  model: string
  year: string
  licensePlate: string
  color: string
  dailyRate: string
  depositAmount: string
  minRentalDays: string
  maxRentalDays: string
  seats: string
  transmission: string
  fuelType: string
  bodyType: string
  pickupArea: string
  description: string
  imageUrl: string
  isAvailable: boolean
}

const CURRENT_YEAR = new Date().getFullYear()

function emptyVehicleForm(): VehicleForm {
  return {
    mode: 'create',
    carId: null,
    make: '',
    model: '',
    year: String(CURRENT_YEAR),
    licensePlate: '',
    color: '',
    dailyRate: '',
    depositAmount: '0',
    minRentalDays: '1',
    maxRentalDays: '',
    seats: '5',
    transmission: 'AUTOMATIC',
    fuelType: 'PETROL',
    bodyType: 'SEDAN',
    pickupArea: '',
    description: '',
    imageUrl: '',
    isAvailable: true,
  }
}

function vehicleFormFrom(car: OwnerVehicle): VehicleForm {
  return {
    mode: 'edit',
    carId: car.id,
    make: car.make === 'Vehicle' ? '' : car.make,
    model: car.model,
    year: car.year ? String(car.year) : String(CURRENT_YEAR),
    licensePlate: car.licensePlate ?? '',
    color: car.color ?? '',
    dailyRate: car.dailyRate > 0 ? String(car.dailyRate) : '',
    depositAmount: String(car.depositAmount ?? 0),
    minRentalDays: String(car.minRentalDays || 1),
    maxRentalDays: car.maxRentalDays ? String(car.maxRentalDays) : '',
    seats: car.seats ? String(car.seats) : '',
    transmission: car.transmission ?? 'AUTOMATIC',
    fuelType: car.fuelType ?? 'PETROL',
    bodyType: car.bodyType ?? 'SEDAN',
    pickupArea: car.pickupArea ?? '',
    description: car.description ?? '',
    imageUrl: car.imageUrl ?? '',
    isAvailable: car.isAvailable !== false,
  }
}

/** Returns an error string, or '' when the form is valid. */
function validateVehicleForm(form: VehicleForm): string {
  if (!form.make.trim()) return 'Enter the vehicle make (for example Toyota).'
  if (!form.model.trim()) return 'Enter the vehicle model (for example Corolla).'
  const year = Number(form.year)
  if (!Number.isInteger(year) || year < 1950 || year > CURRENT_YEAR + 1) {
    return `Enter a model year between 1950 and ${CURRENT_YEAR + 1}.`
  }
  if (!form.licensePlate.trim()) return 'Enter the registration plate. It stays private.'
  if (!form.color.trim()) return 'Enter the vehicle colour.'
  const dailyRate = Number(form.dailyRate)
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return 'Enter a daily rate greater than zero.'
  }
  const deposit = Number(form.depositAmount || 0)
  if (!Number.isFinite(deposit) || deposit < 0) {
    return 'The deposit cannot be negative.'
  }
  const seats = Number(form.seats || 0)
  if (form.seats.trim() && (!Number.isInteger(seats) || seats < 1 || seats > 60)) {
    return 'Enter a seat count between 1 and 60.'
  }
  const minDays = Number(form.minRentalDays || 1)
  if (!Number.isInteger(minDays) || minDays < 1) {
    return 'The minimum rental must be at least one day.'
  }
  if (form.maxRentalDays.trim()) {
    const maxDays = Number(form.maxRentalDays)
    if (!Number.isInteger(maxDays) || maxDays < minDays) {
      return 'The maximum rental must be a whole number of days, at least the minimum.'
    }
  }
  if (form.imageUrl.trim() && !/^https?:\/\//i.test(form.imageUrl.trim())) {
    return 'The photo URL must start with http:// or https://.'
  }
  return ''
}

function vehiclePayload(form: VehicleForm): VehicleInput {
  const editing = form.mode === 'edit'
  const imageUrl = form.imageUrl.trim()
  const pickupArea = form.pickupArea.trim()
  const description = form.description.trim()

  const payload: VehicleInput = {
    make: form.make.trim(),
    model: form.model.trim(),
    year: Number(form.year),
    licensePlate: form.licensePlate.trim().toUpperCase(),
    color: form.color.trim(),
    dailyRate: Number(form.dailyRate),
    depositAmount: Number(form.depositAmount || 0),
    minRentalDays: Number(form.minRentalDays || 1),
    maxRentalDays: form.maxRentalDays.trim() ? Number(form.maxRentalDays) : null,
    isAvailable: form.isAvailable,
    ...(form.transmission ? { transmission: form.transmission } : {}),
    ...(form.fuelType ? { fuelType: form.fuelType } : {}),
    ...(form.bodyType ? { bodyType: form.bodyType } : {}),
  }

  // An omitted field means "leave unchanged" on the owner update endpoint, so
  // edits explicitly clear the values the owner blanked out.
  if (form.seats.trim()) payload.seats = Number(form.seats)
  else if (editing) payload.seats = null

  if (pickupArea) payload.pickupArea = pickupArea
  else if (editing) payload.pickupArea = ''

  if (description) payload.description = description
  else if (editing) payload.description = ''

  if (imageUrl) {
    payload.imageUrl = imageUrl
    payload.images = [imageUrl]
  } else if (editing) {
    payload.imageUrl = ''
    payload.images = []
  }

  return payload
}

const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL']
const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']
const BODY_TYPES = ['SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN', 'COUPE']

export default function ProviderFleetPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [fleet, setFleet] = useState<OwnerVehicle[]>([])
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [block, setBlock] = useState<BlockForm | null>(null)
  const [blockBusy, setBlockBusy] = useState(false)
  const [blockError, setBlockError] = useState('')
  const [notice, setNotice] = useState('')
  const [vehicleForm, setVehicleForm] = useState<VehicleForm | null>(null)
  const [vehicleBusy, setVehicleBusy] = useState(false)
  const [vehicleError, setVehicleError] = useState('')

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

  function openBlockForm(car: OwnerVehicle) {
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
    setVehicleForm(null)
    setVehicleError('')
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

  function openCreateForm() {
    setVehicleForm(emptyVehicleForm())
    setVehicleError('')
    setNotice('')
    setBlock(null)
    setBlockError('')
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openEditForm(car: OwnerVehicle) {
    setVehicleForm(vehicleFormFrom(car))
    setVehicleError('')
    setNotice('')
    setBlock(null)
    setBlockError('')
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitVehicle() {
    if (!vehicleForm) return
    setVehicleError('')
    const invalid = validateVehicleForm(vehicleForm)
    if (invalid) {
      setVehicleError(invalid)
      return
    }

    const payload = vehiclePayload(vehicleForm)
    const editingId = vehicleForm.carId
    setVehicleBusy(true)
    try {
      if (editingId != null) {
        await updateVehicle(editingId, payload)
        setNotice(`${payload.make} ${payload.model} was updated.`)
      } else {
        await createVehicle(payload)
        setNotice(
          `${payload.make} ${payload.model} was submitted. If listing review is enabled it stays hidden from search until Vero360 operations approves it.`,
        )
      }
      setVehicleForm(null)
      await load()
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) {
        setVehicleError('Your session expired. Sign out and sign in again.')
      } else if (err instanceof ProviderApiError && err.status === 403) {
        setVehicleError(
          'Vero360 operations controls publication and suspension. Save the listing without changing its publication status and contact support if it needs review.',
        )
      } else if (err instanceof ProviderApiError && err.status === 400) {
        setVehicleError(
          err.message ||
            'Some vehicle details were rejected. Check the plate, year, rate, and seat count.',
        )
      } else {
        setVehicleError(
          err instanceof Error ? err.message : 'Could not save the vehicle listing.',
        )
      }
    } finally {
      setVehicleBusy(false)
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
        description="Add and edit the vehicles you own. Listing status and operational availability are separate; date blocks prevent new bookings without unpublishing a listing."
        actions={
          <>
            {vehicleForm ? null : (
              <button type="button" onClick={openCreateForm} style={primaryButton}>
                Add vehicle
              </button>
            )}
            <button type="button" onClick={() => void load()} style={ghostButton}>
              Refresh fleet
            </button>
          </>
        }
      />

      {notice ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="success">{notice}</ProviderNotice>
        </div>
      ) : null}

      {vehicleForm ? (
        <VehicleEditor
          form={vehicleForm}
          busy={vehicleBusy}
          error={vehicleError}
          onChange={next => {
            setVehicleForm(next)
            setVehicleError('')
          }}
          onCancel={() => {
            setVehicleForm(null)
            setVehicleError('')
          }}
          onSubmit={() => void submitVehicle()}
        />
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
          body="Add your first vehicle to start receiving car-hire bookings. You will need the make, model, year, registration plate, colour, and daily rate. Vehicle approval is separate from operator approval."
          action={
            <button type="button" onClick={openCreateForm} style={primaryButton}>
              List your first vehicle
            </button>
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
                    <button type="button" onClick={() => openEditForm(car)} style={ghostButton}>
                      Edit
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
          is never rendered on public pages or search results. Maintenance reasons are for your
          workspace only.
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

function VehicleEditor({
  form,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: VehicleForm
  busy: boolean
  error: string
  onChange: (next: VehicleForm) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const editing = form.mode === 'edit'
  const set = (patch: Partial<VehicleForm>) => onChange({ ...form, ...patch })

  return (
    <ProviderCard style={{ marginBottom: 16 }}>
      <form
        onSubmit={event => {
          event.preventDefault()
          if (!busy) onSubmit()
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#C2410C',
            }}
          >
            {editing ? 'Edit listing' : 'New listing'}
          </p>
          <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px' }}>
            {editing
              ? `Edit ${[form.make, form.model].filter(Boolean).join(' ') || 'vehicle'}`
              : 'Add a vehicle'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-3)' }}>
            {editing
              ? 'Changes apply to your public listing as soon as they are saved. Publication and suspension stay with Vero360 operations when listing review is enabled.'
              : 'This vehicle is linked to your account as the owner, so it appears in this workspace and can accept bookings once it is live. The registration plate stays private.'}
          </p>
        </div>

        <VehicleSection title="Vehicle identity">
          <VehicleGrid>
            <VehicleField id="vf-make" label="Make">
              <input
                id="vf-make"
                value={form.make}
                onChange={event => set({ make: event.target.value })}
                placeholder="Toyota"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-model" label="Model">
              <input
                id="vf-model"
                value={form.model}
                onChange={event => set({ model: event.target.value })}
                placeholder="Corolla"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-year" label="Model year">
              <input
                id="vf-year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={CURRENT_YEAR + 1}
                value={form.year}
                onChange={event => set({ year: event.target.value })}
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-color" label="Colour">
              <input
                id="vf-color"
                value={form.color}
                onChange={event => set({ color: event.target.value })}
                placeholder="White"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField
              id="vf-plate"
              label="Registration plate"
              hint="Private. Never shown in public search."
            >
              <input
                id="vf-plate"
                value={form.licensePlate}
                onChange={event => set({ licensePlate: event.target.value })}
                placeholder="ABC-1234"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-body" label="Body type">
              <select
                id="vf-body"
                value={form.bodyType}
                onChange={event => set({ bodyType: event.target.value })}
                disabled={busy}
                style={inputStyle}
              >
                {BODY_TYPES.map(value => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </VehicleField>
          </VehicleGrid>
        </VehicleSection>

        <VehicleSection title="Pricing and rental rules">
          <VehicleGrid>
            <VehicleField id="vf-rate" label="Daily rate" hint="MWK per day.">
              <input
                id="vf-rate"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.dailyRate}
                onChange={event => set({ dailyRate: event.target.value })}
                placeholder="45000"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-deposit" label="Security deposit" hint="Use 0 for no deposit.">
              <input
                id="vf-deposit"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.depositAmount}
                onChange={event => set({ depositAmount: event.target.value })}
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-min-days" label="Minimum rental days">
              <input
                id="vf-min-days"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.minRentalDays}
                onChange={event => set({ minRentalDays: event.target.value })}
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField
              id="vf-max-days"
              label="Maximum rental days"
              hint="Leave blank for no maximum."
            >
              <input
                id="vf-max-days"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.maxRentalDays}
                onChange={event => set({ maxRentalDays: event.target.value })}
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField
              id="vf-available"
              label="Availability"
              hint="Unavailable vehicles stay listed but cannot be booked."
            >
              <select
                id="vf-available"
                value={form.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
                onChange={event => set({ isAvailable: event.target.value === 'AVAILABLE' })}
                disabled={busy}
                style={inputStyle}
              >
                <option value="AVAILABLE">Available for bookings</option>
                <option value="UNAVAILABLE">Unavailable right now</option>
              </select>
            </VehicleField>
          </VehicleGrid>
        </VehicleSection>

        <VehicleSection title="Vehicle details">
          <VehicleGrid>
            <VehicleField id="vf-seats" label="Seats">
              <input
                id="vf-seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                step={1}
                value={form.seats}
                onChange={event => set({ seats: event.target.value })}
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField id="vf-transmission" label="Transmission">
              <select
                id="vf-transmission"
                value={form.transmission}
                onChange={event => set({ transmission: event.target.value })}
                disabled={busy}
                style={inputStyle}
              >
                {TRANSMISSIONS.map(value => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </VehicleField>
            <VehicleField id="vf-fuel" label="Fuel">
              <select
                id="vf-fuel"
                value={form.fuelType}
                onChange={event => set({ fuelType: event.target.value })}
                disabled={busy}
                style={inputStyle}
              >
                {FUEL_TYPES.map(value => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </VehicleField>
            <VehicleField id="vf-area" label="Pickup area">
              <input
                id="vf-area"
                value={form.pickupArea}
                onChange={event => set({ pickupArea: event.target.value })}
                placeholder="Area 43, Lilongwe"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
            <VehicleField
              id="vf-photo"
              label="Photo URL"
              hint="Optional. Use a public https image link."
            >
              <input
                id="vf-photo"
                value={form.imageUrl}
                onChange={event => set({ imageUrl: event.target.value })}
                placeholder="https://…"
                autoComplete="off"
                disabled={busy}
                style={inputStyle}
              />
            </VehicleField>
          </VehicleGrid>
        </VehicleSection>

        <VehicleSection title="Description">
          <VehicleField
            id="vf-description"
            label="What should a renter know?"
            hint="Condition, extras, pickup instructions, or usage limits. Do not include personal contact details."
          >
            <textarea
              id="vf-description"
              value={form.description}
              onChange={event => set({ description: event.target.value })}
              rows={3}
              maxLength={2000}
              disabled={busy}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </VehicleField>
        </VehicleSection>

        {error ? (
          <p
            role="alert"
            style={{ margin: '14px 0 0', fontSize: 12, lineHeight: 1.5, color: '#B91C1C' }}
          >
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="submit" style={primaryButton} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create listing'}
          </button>
          <button type="button" onClick={onCancel} style={ghostButton} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </ProviderCard>
  )
}

function VehicleSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: 'var(--text-2)' }}>{title}</p>
      {hint ? (
        <p style={{ margin: '3px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--text-3)' }}>
          {hint}
        </p>
      ) : null}
      <div style={{ marginTop: 9 }}>{children}</div>
    </section>
  )
}

function VehicleGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
      }}
    >
      {children}
    </div>
  )
}

function VehicleField({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={id} style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint ? (
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: 10,
            lineHeight: 1.45,
            color: 'var(--text-3)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  )
}
