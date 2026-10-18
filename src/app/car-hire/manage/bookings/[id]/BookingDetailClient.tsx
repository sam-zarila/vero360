'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import {
  bookingIsPending,
  bookingRenterLabel,
  bookingStatusLabel,
  bookingStatusTone,
  carTitle,
  extensionStatusLabel,
  incidentStatusLabel,
  incidentTypeLabel,
  inspectionStatusLabel,
  inspectionTypeLabel,
  paymentStatusLabel,
  paymentTone,
  prettyStatus,
  type BookingExtension,
  type CarHireBooking,
  type ConditionGrade,
  type HandoverInspection,
  type IncidentRemedy,
  type IncidentReport,
  type IncidentType,
  type InspectionList,
  type InspectionType,
  type StatusTone,
  type SubmitInspectionInput,
  type SupportCase,
  type SupportCaseCategory,
} from '@/lib/car-hire'
import {
  acknowledgeInspection,
  approveExtension,
  declineExtension,
  getBooking,
  getExtensions,
  getIncidents,
  getInspections,
  getSupportCases,
  openSupportCase,
  ProviderApiError,
  reportIncident,
  resolveIncident,
  submitInspection,
} from '@/lib/car-hire-owner-api'
import { formatDateTime, formatMwk, resolveVeroMediaUrl } from '@/lib/vero-api'
import { useProviderAuth } from '../../components/ProviderShell'
import { localInputToIso } from '../../components/ProviderDateRange'
import {
  ProviderCard,
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
} from '../../components/ProviderUI'

type LoadState = 'loading' | 'ready' | 'error'

type ErrorKind = 'session' | 'forbidden' | 'not-found' | 'api' | null

type PanelKey = 'inspections' | 'incidents' | 'extensions' | 'support'

type InspectionDraft = {
  odometer: string
  fuelLevel: string
  condition: '' | ConditionGrade
  checklist: Record<string, boolean>
  notes: string
}

type IncidentDraft = {
  type: IncidentType
  description: string
  occurredAt: string
  contactPhone: string
}

type SupportDraft = {
  category: SupportCaseCategory
  subject: string
  message: string
}

type ResolveDraft = {
  incidentId: string
  resolution: string
  remedy: '' | IncidentRemedy
}

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'exterior', label: 'Exterior' },
  { key: 'tyres', label: 'Tyres' },
  { key: 'interior', label: 'Interior' },
  { key: 'documents', label: 'Documents' },
  { key: 'fuel', label: 'Fuel' },
]

const CONDITION_OPTIONS: { value: ConditionGrade; label: string }[] = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
  { value: 'DAMAGED', label: 'Damaged' },
]

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'UNSAFE_VEHICLE', label: 'Unsafe vehicle' },
  { value: 'NO_SHOW', label: 'Renter no-show' },
  { value: 'FAILED_PICKUP', label: 'Failed pickup' },
  { value: 'OWNER_UNAVAILABLE', label: 'Owner unavailable' },
  { value: 'OTHER', label: 'Other' },
]

const REMEDY_OPTIONS: { value: IncidentRemedy; label: string }[] = [
  { value: 'NONE', label: 'No remedy' },
  { value: 'REPLACEMENT', label: 'Replacement vehicle' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'PARTIAL_REFUND', label: 'Partial refund' },
  { value: 'EXTENSION', label: 'Rental extension' },
  { value: 'ESCALATION', label: 'Escalate' },
]

const SUPPORT_CATEGORIES: { value: SupportCaseCategory; label: string }[] = [
  { value: 'BOOKING', label: 'Booking' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'HANDOVER', label: 'Handover' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'OTHER', label: 'Other' },
]

function emptyInspectionDraft(): InspectionDraft {
  return { odometer: '', fuelLevel: '', condition: '', checklist: {}, notes: '' }
}

function emptyIncidentDraft(): IncidentDraft {
  return { type: 'ACCIDENT', description: '', occurredAt: '', contactPhone: '' }
}

function emptySupportDraft(): SupportDraft {
  return { category: 'BOOKING', subject: '', message: '' }
}

function decisionTone(status: string | null | undefined): StatusTone {
  const raw = (status || '').toUpperCase()
  if (['APPROVED', 'ACKNOWLEDGED', 'ACCEPTED', 'RESOLVED', 'CLOSED', 'COMPLETED'].includes(raw)) {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  }
  if (['DECLINED', 'DISPUTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(raw)) {
    return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  }
  if (
    [
      'PENDING',
      'PENDING_ACKNOWLEDGEMENT',
      'AWAITING_ACKNOWLEDGEMENT',
      'OPEN',
      'REQUESTED',
      'INVESTIGATING',
      'ESCALATED',
    ].includes(raw)
  ) {
    return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  }
  return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
}

function panelErrorText(err: unknown): string {
  if (err instanceof ProviderApiError) {
    if (err.status === 401) return 'Your session expired. Sign out and sign in again.'
    if (err.status === 403) return 'Your membership does not allow this section for this booking.'
    if (err.status === 404) return 'This section is not available for this booking yet.'
    return err.message
  }
  return err instanceof Error ? err.message : 'This section could not be loaded.'
}

function actionErrorText(err: unknown): string {
  if (err instanceof ProviderApiError) {
    if (err.status === 401) return 'Your session expired. Sign out and sign in again.'
    if (err.status === 403) {
      return 'Your membership does not allow this action. Ask the operator owner for access.'
    }
    if (err.status === 404) return 'This record is no longer available. Refresh the page.'
    if (err.status === 409) {
      return 'The backend rejected this because the booking state has changed. Refresh and check the latest status.'
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'The action could not be completed.'
}

function buildInspectionInput(draft: InspectionDraft): {
  input: SubmitInspectionInput
  error: string | null
} {
  const input: SubmitInspectionInput = {}
  const odometerRaw = draft.odometer.trim()
  if (odometerRaw) {
    const parsed = Number(odometerRaw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { input, error: 'Odometer must be a number of kilometres, 0 or more.' }
    }
    input.odometer = Math.round(parsed)
  }
  const fuelRaw = draft.fuelLevel.trim()
  if (fuelRaw) {
    const parsed = Number(fuelRaw)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return { input, error: 'Fuel level must be between 0 and 100 percent.' }
    }
    input.fuelLevel = Math.round(parsed)
  }
  if (draft.condition) input.condition = draft.condition
  const checklist: Record<string, string> = {}
  for (const item of CHECKLIST_ITEMS) {
    if (draft.checklist[item.key]) checklist[item.key] = 'OK'
  }
  if (Object.keys(checklist).length > 0) input.checklist = checklist
  const notes = draft.notes.trim()
  if (notes) input.notes = notes
  return { input, error: null }
}

export default function BookingDetailClient({ bookingId }: { bookingId: string }) {
  const { signOutNow } = useProviderAuth()

  const [state, setState] = useState<LoadState>('loading')
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [loadError, setLoadError] = useState('')

  const [booking, setBooking] = useState<CarHireBooking | null>(null)
  const [inspections, setInspections] = useState<InspectionList | null>(null)
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [extensions, setExtensions] = useState<BookingExtension[]>([])
  const [supportCases, setSupportCases] = useState<SupportCase[]>([])
  const [panelErrors, setPanelErrors] = useState<Partial<Record<PanelKey, string>>>({})

  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const [openInspection, setOpenInspection] = useState<'' | InspectionType>('')
  const [pickupDraft, setPickupDraft] = useState<InspectionDraft>(emptyInspectionDraft)
  const [returnDraft, setReturnDraft] = useState<InspectionDraft>(emptyInspectionDraft)
  const [declineInspectionTarget, setDeclineInspectionTarget] = useState<{
    inspectionId: string
    note: string
  } | null>(null)

  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [declineExtensionTarget, setDeclineExtensionTarget] = useState<{
    extensionId: string
    reason: string
  } | null>(null)

  const [incidentOpen, setIncidentOpen] = useState(false)
  const [incidentDraft, setIncidentDraft] = useState<IncidentDraft>(emptyIncidentDraft)
  const [resolveDraft, setResolveDraft] = useState<ResolveDraft | null>(null)

  const [supportOpen, setSupportOpen] = useState(false)
  const [supportDraft, setSupportDraft] = useState<SupportDraft>(emptySupportDraft)

  const loadPanels = useCallback(async () => {
    const errors: Partial<Record<PanelKey, string>> = {}
    const results = await Promise.allSettled([
      getInspections(bookingId),
      getIncidents(bookingId),
      getExtensions(bookingId),
      getSupportCases(bookingId),
    ])
    const [inspectionResult, incidentResult, extensionResult, supportResult] = results

    if (inspectionResult.status === 'fulfilled') setInspections(inspectionResult.value)
    else errors.inspections = panelErrorText(inspectionResult.reason)

    if (incidentResult.status === 'fulfilled') setIncidents(incidentResult.value)
    else errors.incidents = panelErrorText(incidentResult.reason)

    if (extensionResult.status === 'fulfilled') setExtensions(extensionResult.value)
    else errors.extensions = panelErrorText(extensionResult.reason)

    if (supportResult.status === 'fulfilled') setSupportCases(supportResult.value)
    else errors.support = panelErrorText(supportResult.reason)

    setPanelErrors(errors)
  }, [bookingId])

  const load = useCallback(async () => {
    setState('loading')
    setErrorKind(null)
    setLoadError('')
    setPanelErrors({})
    setInspections(null)
    try {
      const detail = await getBooking(bookingId)
      if (!detail) {
        setBooking(null)
        setErrorKind('not-found')
        setLoadError('This booking could not be found for your operator workspace.')
        setState('error')
        return
      }
      setBooking(detail)
      setState('ready')
    } catch (err) {
      const apiErr = err instanceof ProviderApiError ? err : null
      if (apiErr?.status === 401) setErrorKind('session')
      else if (apiErr?.status === 403) setErrorKind('forbidden')
      else if (apiErr?.status === 404) setErrorKind('not-found')
      else setErrorKind('api')
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Could not load this booking from the backend.',
      )
      setState('error')
      return
    }
    await loadPanels()
  }, [bookingId, loadPanels])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(
    key: string,
    work: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(key)
    setActionError('')
    setNotice('')
    try {
      await work()
      setNotice(successMessage)
      await load()
      return true
    } catch (err) {
      setActionError(actionErrorText(err))
      return false
    } finally {
      setBusy('')
    }
  }

  async function submitHandover(type: InspectionType) {
    const draft = type === 'PICKUP' ? pickupDraft : returnDraft
    const built = buildInspectionInput(draft)
    if (built.error) {
      setActionError(built.error)
      return
    }
    const ok = await runAction(
      `inspection-${type}`,
      async () => {
        await submitInspection(bookingId, type, built.input)
      },
      `${type === 'PICKUP' ? 'Pickup' : 'Return'} inspection saved. Reloaded from the backend.`,
    )
    if (!ok) return
    if (type === 'PICKUP') setPickupDraft(emptyInspectionDraft())
    else setReturnDraft(emptyInspectionDraft())
    setOpenInspection('')
  }

  async function acknowledge(
    inspection: HandoverInspection,
    decision: 'ACCEPTED' | 'DECLINED',
  ) {
    const note =
      decision === 'DECLINED' && declineInspectionTarget?.inspectionId === inspection.id
        ? declineInspectionTarget.note.trim()
        : ''
    if (decision === 'DECLINED' && note.length < 3) {
      setActionError(
        'Add a short note (at least 3 characters) explaining why you are declining this inspection.',
      )
      return
    }
    const ok = await runAction(
      `ack-${inspection.id}-${decision}`,
      async () => {
        await acknowledgeInspection(bookingId, inspection.id, {
          decision,
          ...(note ? { note } : {}),
        })
      },
      `${inspectionTypeLabel(inspection.type)} ${
        decision === 'ACCEPTED' ? 'acknowledged' : 'declined'
      }. Reloaded from the backend.`,
    )
    if (ok) setDeclineInspectionTarget(null)
  }

  async function approveExtensionRequest(extension: BookingExtension) {
    const ok = await runAction(
      `extension-${extension.id}-approve`,
      async () => {
        await approveExtension(bookingId, extension.id)
      },
      'Extension approved. Reloaded from the backend.',
    )
    if (ok) setApproveTarget(null)
  }

  async function declineExtensionRequest(extension: BookingExtension) {
    const reason =
      declineExtensionTarget?.extensionId === extension.id
        ? declineExtensionTarget.reason.trim()
        : ''
    const ok = await runAction(
      `extension-${extension.id}-decline`,
      async () => {
        await declineExtension(bookingId, extension.id, reason || undefined)
      },
      'Extension declined. Reloaded from the backend.',
    )
    if (ok) setDeclineExtensionTarget(null)
  }

  async function submitIncidentReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const description = incidentDraft.description.trim()
    if (description.length < 3) {
      setActionError('Describe what happened (at least 3 characters).')
      return
    }
    let occurredAt: string | null = null
    if (incidentDraft.occurredAt) {
      occurredAt = localInputToIso(incidentDraft.occurredAt)
      if (!occurredAt) {
        setActionError('Choose a valid date and time for the incident.')
        return
      }
    }
    const phone = incidentDraft.contactPhone.trim()
    const ok = await runAction(
      'incident-create',
      async () => {
        await reportIncident(bookingId, {
          type: incidentDraft.type,
          description,
          ...(occurredAt ? { occurredAt } : {}),
          ...(phone ? { contactPhone: phone } : {}),
        })
      },
      'Incident reported. Reloaded from the backend.',
    )
    if (!ok) return
    setIncidentDraft(emptyIncidentDraft())
    setIncidentOpen(false)
  }

  async function submitResolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolveDraft) return
    const draft = resolveDraft
    const resolution = draft.resolution.trim()
    if (resolution.length < 3) {
      setActionError('Describe the resolution (at least 3 characters).')
      return
    }
    const ok = await runAction(
      `incident-${draft.incidentId}-resolve`,
      async () => {
        await resolveIncident(bookingId, draft.incidentId, {
          resolution,
          ...(draft.remedy ? { remedy: draft.remedy } : {}),
        })
      },
      'Incident resolved. Reloaded from the backend.',
    )
    if (ok) setResolveDraft(null)
  }

  async function submitSupportCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const subject = supportDraft.subject.trim()
    const message = supportDraft.message.trim()
    if (subject.length < 3) {
      setActionError('Add a short subject (at least 3 characters).')
      return
    }
    if (message.length < 3) {
      setActionError('Add a message for support (at least 3 characters).')
      return
    }
    const ok = await runAction(
      'support-create',
      async () => {
        await openSupportCase(bookingId, {
          category: supportDraft.category,
          subject,
          message,
        })
      },
      'Support case opened. Reloaded from the backend.',
    )
    if (!ok) return
    setSupportDraft(emptySupportDraft())
    setSupportOpen(false)
  }

  if (state === 'loading') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Booking"
          title="Booking details"
          description="Loading the booking, handover inspections, incidents, extensions, and support cases."
        />
        <ProviderLoading label="Loading booking details…" />
      </>
    )
  }

  if (state === 'error' || !booking) {
    const message =
      errorKind === 'session'
        ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
        : errorKind === 'forbidden'
          ? 'This Vero360 account is not authorised to view this booking. Bookings are visible only to the operator that owns the vehicle.'
          : errorKind === 'not-found'
            ? 'This booking does not exist, was removed, or does not belong to your operator workspace.'
            : loadError || 'Could not load this booking from the backend.'
    return (
      <>
        <ProviderPageHeading
          eyebrow="Booking"
          title="Booking details"
          description="Handover, incidents, extensions, and support for a single booking."
        />
        <ProviderError
          message={message}
          onRetry={() => void load()}
          action={
            errorKind === 'session' ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire/manage/bookings" style={ghostButton}>
                Back to bookings
              </Link>
            )
          }
        />
      </>
    )
  }

  const carLabel = booking.car
    ? carTitle(booking.car)
    : booking.carId
      ? `Car #${booking.carId}`
      : 'Vehicle details not provided'
  const start = booking.startAt || booking.startDate
  const end = booking.endAt || booking.endDate
  const pending = bookingIsPending(booking)

  function renderInspection(inspection: HandoverInspection) {
    const ownerAck = inspection.acknowledgements.find(ack => ack.party === 'OWNER')
    const authoredByOwner = inspection.actorRole === 'OWNER'
    const declining = declineInspectionTarget?.inspectionId === inspection.id
    const checklistRows = Object.entries(inspection.checklist)

    return (
      <div key={inspection.id} style={subCard}>
        <div style={rowBetween}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
              {inspectionTypeLabel(inspection.type)}
            </p>
            <p style={smallMeta}>
              Recorded {formatDateTime(inspection.createdAt)}
              {inspection.actorRole ? ` · By ${prettyStatus(inspection.actorRole)}` : ''}
            </p>
          </div>
          <StatusBadge
            tone={decisionTone(inspection.status)}
            label={inspectionStatusLabel(inspection.status)}
          />
        </div>

        <div style={metaGrid}>
          <DetailRow
            label="Odometer"
            value={
              inspection.odometer != null
                ? `${inspection.odometer.toLocaleString('en-MW')} km`
                : '—'
            }
          />
          <DetailRow
            label="Fuel level"
            value={inspection.fuelLevel != null ? `${inspection.fuelLevel}%` : '—'}
          />
          <DetailRow
            label="Condition"
            value={inspection.condition ? prettyStatus(inspection.condition) : '—'}
          />
        </div>

        {checklistRows.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
            {checklistRows.map(([key, value]) => (
              <span key={`${inspection.id}-${key}`} style={chip}>
                {prettyStatus(key)}: <strong>{value}</strong>
              </span>
            ))}
          </div>
        ) : null}

        {inspection.notes ? (
          <p style={{ ...smallMeta, marginTop: 9, color: 'var(--text-2)' }}>
            Notes: {inspection.notes}
          </p>
        ) : null}

        {inspection.media.length > 0 ? (
          <EvidenceList
            items={inspection.media}
            idPrefix={`${inspection.id}-media`}
            label="Photo"
          />
        ) : null}

        <div style={{ marginTop: 10 }}>
          <p style={smallMeta}>Acknowledgements</p>
          {inspection.acknowledgements.length === 0 ? (
            <p style={{ ...smallMeta, marginTop: 3 }}>No acknowledgements recorded.</p>
          ) : (
            <ul style={ackList}>
              {inspection.acknowledgements.map((ack, index) => (
                <li key={ack.id || `${inspection.id}-ack-${index}`}>
                  <strong>
                    {ack.party === 'OWNER'
                      ? 'Owner'
                      : ack.party === 'RENTER'
                        ? 'Renter'
                        : prettyStatus(ack.party)}
                  </strong>
                  : {prettyStatus(ack.decision)}
                  {ack.note ? ` — ${ack.note}` : ''}{' '}
                  <span style={{ color: 'var(--text-3)' }}>
                    ({formatDateTime(ack.createdAt)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ownerAck ? (
          <div style={{ marginTop: 10 }}>
            <ProviderNotice tone={ownerAck.decision === 'DECLINED' ? 'error' : 'success'}>
              Your workspace has already recorded “{prettyStatus(ownerAck.decision)}” for this
              inspection{ownerAck.note ? `: ${ownerAck.note}` : '.'}
            </ProviderNotice>
          </div>
        ) : authoredByOwner ? (
          <p style={{ ...smallMeta, marginTop: 9 }}>
            This inspection was recorded by your workspace. The renter acknowledges it in the
            Vero360 app.
          </p>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void acknowledge(inspection, 'ACCEPTED')}
                disabled={busy !== ''}
                style={primaryButton}
              >
                {busy === `ack-${inspection.id}-ACCEPTED`
                  ? 'Acknowledging…'
                  : 'Acknowledge inspection'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeclineInspectionTarget({
                    inspectionId: inspection.id,
                    note: '',
                  })
                }
                disabled={busy !== ''}
                style={dangerButton}
              >
                Decline inspection
              </button>
            </div>

            {declining && declineInspectionTarget ? (
              <div style={{ marginTop: 9 }}>
                <Labelled
                  id={`decline-inspection-${inspection.id}`}
                  label="Reason for declining (required)"
                >
                  <textarea
                    id={`decline-inspection-${inspection.id}`}
                    value={declineInspectionTarget.note}
                    onChange={event =>
                      setDeclineInspectionTarget({
                        inspectionId: inspection.id,
                        note: event.target.value,
                      })
                    }
                    rows={2}
                    placeholder="e.g. Fuel level does not match the reading at pickup"
                    disabled={busy !== ''}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </Labelled>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                  <button
                    type="button"
                    onClick={() => void acknowledge(inspection, 'DECLINED')}
                    disabled={busy !== ''}
                    style={dangerButton}
                  >
                    {busy === `ack-${inspection.id}-DECLINED`
                      ? 'Declining…'
                      : 'Confirm decline'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclineInspectionTarget(null)}
                    disabled={busy !== ''}
                    style={ghostButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <ProviderPageHeading
        eyebrow="Booking"
        title={booking.bookingNumber}
        description="Handover inspections, extensions, incidents, and support for this rental. Every action is authorised by the backend and the page refetches afterwards."
        actions={
          <Link href="/car-hire/manage/bookings" style={ghostButton}>
            ← All bookings
          </Link>
        }
      />

      {notice ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="success">{notice}</ProviderNotice>
        </div>
      ) : null}

      {actionError ? (
        <div style={{ marginBottom: 14 }} role="alert">
          <ProviderNotice tone="error">{actionError}</ProviderNotice>
        </div>
      ) : null}

      <ProviderCard>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
              <StatusBadge
                tone={bookingStatusTone(booking.bookingStatus)}
                label={bookingStatusLabel(booking.bookingStatus)}
              />
              <StatusBadge
                tone={paymentTone(booking.paymentStatus)}
                label={paymentStatusLabel(booking.paymentStatus)}
              />
            </div>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: '-0.3px' }}>
              {carLabel}
            </h2>
            <p style={{ ...smallMeta, marginTop: 5 }}>
              {formatDateTime(start)} → {formatDateTime(end)}
            </p>
            <p style={{ ...smallMeta, marginTop: 3 }}>
              Renter:{' '}
              <strong style={{ color: 'var(--text-2)' }}>{bookingRenterLabel(booking)}</strong>
              {booking.renterPhone ? (
                <>
                  {' · '}
                  <a href={`tel:${booking.renterPhone}`} style={inlineLink}>
                    {booking.renterPhone}
                  </a>
                </>
              ) : null}
              {booking.renterEmail ? (
                <>
                  {' · '}
                  <a href={`mailto:${booking.renterEmail}`} style={inlineLink}>
                    {booking.renterEmail}
                  </a>
                </>
              ) : null}
            </p>
            {booking.renterNotes ? (
              <p
                style={{
                  margin: '10px 0 0',
                  padding: '8px 10px',
                  borderRadius: 9,
                  background: 'var(--surface)',
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: 'var(--text-2)',
                }}
              >
                Renter note: {booking.renterNotes}
              </p>
            ) : null}
            {pending ? (
              <p style={{ ...smallMeta, marginTop: 10, color: '#B45309', fontWeight: 700 }}>
                This request is still awaiting a decision. Confirm or reject it from the bookings
                queue.
              </p>
            ) : null}
          </div>

          <div style={{ minWidth: 180, textAlign: 'right' }}>
            <p style={metaLabel}>Booking total</p>
            <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900 }}>
              {formatMwk(booking.total || booking.totalCost)}
            </p>
            <p style={{ ...smallMeta, marginTop: 4 }}>
              Created {formatDateTime(booking.createdAt)}
            </p>
            {booking.holdExpiresAt && pending ? (
              <p style={{ ...smallMeta, marginTop: 3, color: '#B45309', fontWeight: 700 }}>
                Hold expires {formatDateTime(booking.holdExpiresAt)}
              </p>
            ) : null}
            {booking.quoteId ? (
              <p style={{ ...smallMeta, marginTop: 3 }}>Quote {booking.quoteId}</p>
            ) : null}
          </div>
        </div>
      </ProviderCard>

      <ProviderCard style={{ marginTop: 16 }}>
        <SectionHeader
          title="Handover inspections"
          description="Record the vehicle state at pickup and return, then acknowledge or decline the other party's inspection. Odometer, fuel, and condition are sent to the backend exactly as entered."
        />

        {panelErrors.inspections ? (
          <ProviderNotice tone="error">{panelErrors.inspections}</ProviderNotice>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {(['PICKUP', 'RETURN'] as const).map(type => {
              const draft = type === 'PICKUP' ? pickupDraft : returnDraft
              const setDraft: (next: InspectionDraft) => void =
                type === 'PICKUP' ? setPickupDraft : setReturnDraft
              const latest =
                type === 'PICKUP'
                  ? inspections?.latestPickup ?? null
                  : inspections?.latestReturn ?? null
              const open = openInspection === type
              return (
                <div key={type} style={subCard}>
                  <div style={rowBetween}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
                        {inspectionTypeLabel(type)}
                      </p>
                      <p style={smallMeta}>
                        {inspections === null && !panelErrors.inspections
                          ? 'Loading inspections…'
                          : latest
                            ? `Latest: ${formatDateTime(latest.createdAt)} · ${inspectionStatusLabel(
                                latest.status,
                              )}`
                            : 'No inspection recorded yet.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenInspection(open ? '' : type)}
                      aria-expanded={open}
                      disabled={busy !== ''}
                      style={ghostButton}
                    >
                      {open
                        ? 'Close form'
                        : `Record ${type === 'PICKUP' ? 'pickup' : 'return'} inspection`}
                    </button>
                  </div>

                  {open ? (
                    <form
                      onSubmit={event => {
                        event.preventDefault()
                        void submitHandover(type)
                      }}
                      style={{ display: 'grid', gap: 10, marginTop: 12 }}
                    >
                      <div style={formGrid}>
                        <Labelled id={`${type}-odometer`} label="Odometer (km)">
                          <input
                            id={`${type}-odometer`}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            value={draft.odometer}
                            onChange={event =>
                              setDraft({ ...draft, odometer: event.target.value })
                            }
                            disabled={busy !== ''}
                            placeholder="e.g. 84210"
                            style={inputStyle}
                          />
                        </Labelled>
                        <Labelled id={`${type}-fuel`} label="Fuel level (%)">
                          <input
                            id={`${type}-fuel`}
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            inputMode="numeric"
                            value={draft.fuelLevel}
                            onChange={event =>
                              setDraft({ ...draft, fuelLevel: event.target.value })
                            }
                            disabled={busy !== ''}
                            placeholder="0–100"
                            style={inputStyle}
                          />
                        </Labelled>
                        <Labelled id={`${type}-condition`} label="Condition">
                          <select
                            id={`${type}-condition`}
                            value={draft.condition}
                            onChange={event =>
                              setDraft({
                                ...draft,
                                condition: event.target.value as '' | ConditionGrade,
                              })
                            }
                            disabled={busy !== ''}
                            style={inputStyle}
                          >
                            <option value="">Not assessed</option>
                            {CONDITION_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Labelled>
                      </div>

                      <fieldset style={fieldset}>
                        <legend style={legend}>
                          Checklist — tick each item that is present and in order
                        </legend>
                        <div style={checkGrid}>
                          {CHECKLIST_ITEMS.map(item => (
                            <label
                              key={item.key}
                              htmlFor={`${type}-check-${item.key}`}
                              style={checkboxLabel}
                            >
                              <input
                                id={`${type}-check-${item.key}`}
                                type="checkbox"
                                checked={draft.checklist[item.key] === true}
                                onChange={event =>
                                  setDraft({
                                    ...draft,
                                    checklist: {
                                      ...draft.checklist,
                                      [item.key]: event.target.checked,
                                    },
                                  })
                                }
                                disabled={busy !== ''}
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <Labelled id={`${type}-notes`} label="Notes (optional)">
                        <textarea
                          id={`${type}-notes`}
                          value={draft.notes}
                          onChange={event => setDraft({ ...draft, notes: event.target.value })}
                          rows={2}
                          placeholder="Scratches, missing items, or anything the renter should confirm"
                          disabled={busy !== ''}
                          style={{ ...inputStyle, resize: 'vertical' }}
                        />
                      </Labelled>

                      <div>
                        <button type="submit" disabled={busy !== ''} style={primaryButton}>
                          {busy === `inspection-${type}`
                            ? 'Saving inspection…'
                            : 'Save inspection'}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <h3 style={subTitle}>Recorded inspections</h3>
          {panelErrors.inspections ? null : inspections === null ? (
            <p style={{ ...smallMeta, marginTop: 6 }}>Loading inspections…</p>
          ) : inspections.inspections.length === 0 ? (
            <p style={{ ...smallMeta, marginTop: 6 }}>
              No inspections have been recorded for this booking yet. Record a pickup inspection
              before the rental and a return inspection when the vehicle comes back.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              {inspections.inspections.map(renderInspection)}
            </div>
          )}
        </div>
      </ProviderCard>

      <ProviderCard style={{ marginTop: 16 }}>
        <SectionHeader
          title="Booking extensions"
          description="Renter-requested date extensions. Approving or declining is final in the backend; this page does not change dates locally."
        />
        {panelErrors.extensions ? (
          <ProviderNotice tone="error">{panelErrors.extensions}</ProviderNotice>
        ) : extensions.length === 0 ? (
          <p style={smallMeta}>No extension requests for this booking.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {extensions.map(extension => {
              const pendingDecision =
                extension.status === 'PENDING' || extension.status === 'REQUESTED'
              const approving = approveTarget === extension.id
              const declining = declineExtensionTarget?.extensionId === extension.id
              return (
                <div key={extension.id} style={subCard}>
                  <div style={rowBetween}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
                        Requested return {formatDateTime(extension.requestedEndAt)}
                      </p>
                      <p style={smallMeta}>
                        Previous return {formatDateTime(extension.previousEndAt)} · Requested{' '}
                        {formatDateTime(extension.createdAt)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={decisionTone(extension.status)}
                      label={extensionStatusLabel(extension.status)}
                    />
                  </div>

                  <div style={metaGrid}>
                    <DetailRow
                      label="Additional amount"
                      value={
                        extension.additionalAmount != null
                          ? formatMwk(extension.additionalAmount)
                          : '—'
                      }
                    />
                    <DetailRow label="Currency" value={extension.currency || '—'} />
                  </div>

                  {extension.decisionReason ? (
                    <p style={{ ...smallMeta, marginTop: 8, color: 'var(--text-2)' }}>
                      Decision note: {extension.decisionReason}
                    </p>
                  ) : null}

                  {pendingDecision ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setApproveTarget(approving ? null : extension.id)}
                          aria-expanded={approving}
                          disabled={busy !== ''}
                          style={primaryButton}
                        >
                          Approve extension
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeclineExtensionTarget({ extensionId: extension.id, reason: '' })}
                          disabled={busy !== ''}
                          style={dangerButton}
                        >
                          Decline extension
                        </button>
                      </div>

                      {approving ? (
                        <div style={confirmBox}>
                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#065F46', fontWeight: 700 }}>
                            Approve the extension to {formatDateTime(extension.requestedEndAt)}? The
                            backend applies{' '}
                            {extension.additionalAmount != null
                              ? formatMwk(extension.additionalAmount)
                              : 'the recorded additional amount'}{' '}
                            and updates availability.
                          </p>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                            <button
                              type="button"
                              onClick={() => void approveExtensionRequest(extension)}
                              disabled={busy !== ''}
                              style={primaryButton}
                            >
                              {busy === `extension-${extension.id}-approve`
                                ? 'Approving…'
                                : 'Yes, approve extension'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setApproveTarget(null)}
                              disabled={busy !== ''}
                              style={ghostButton}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {declining && declineExtensionTarget ? (
                        <div style={{ marginTop: 9 }}>
                          <Labelled
                            id={`decline-extension-${extension.id}`}
                            label="Reason (optional)"
                          >
                            <textarea
                              id={`decline-extension-${extension.id}`}
                              value={declineExtensionTarget.reason}
                              onChange={event =>
                                setDeclineExtensionTarget({
                                  extensionId: extension.id,
                                  reason: event.target.value,
                                })
                              }
                              rows={2}
                              placeholder="e.g. Vehicle is already booked after the current return date"
                              disabled={busy !== ''}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </Labelled>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                            <button
                              type="button"
                              onClick={() => void declineExtensionRequest(extension)}
                              disabled={busy !== ''}
                              style={dangerButton}
                            >
                              {busy === `extension-${extension.id}-decline`
                                ? 'Declining…'
                                : 'Confirm decline'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeclineExtensionTarget(null)}
                              disabled={busy !== ''}
                              style={ghostButton}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </ProviderCard>

      <ProviderCard style={{ marginTop: 16 }}>
        <SectionHeader
          title="Incidents"
          description="Report accidents, breakdowns, theft, unsafe vehicles, or failed handovers, then record the resolution. The backend keeps the incident history."
          action={
            <button
              type="button"
              onClick={() => setIncidentOpen(value => !value)}
              aria-expanded={incidentOpen}
              disabled={busy !== ''}
              style={ghostButton}
            >
              {incidentOpen ? 'Close form' : 'New incident report'}
            </button>
          }
        />

        {panelErrors.incidents ? (
          <ProviderNotice tone="error">{panelErrors.incidents}</ProviderNotice>
        ) : null}

        {incidentOpen ? (
          <form onSubmit={event => void submitIncidentReport(event)} style={formPanel}>
            <div style={formGrid}>
              <Labelled id="incident-type" label="Incident type">
                <select
                  id="incident-type"
                  value={incidentDraft.type}
                  onChange={event =>
                    setIncidentDraft({
                      ...incidentDraft,
                      type: event.target.value as IncidentType,
                    })
                  }
                  disabled={busy !== ''}
                  style={inputStyle}
                >
                  {INCIDENT_TYPES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled id="incident-occurred" label="Occurred at (optional)">
                <input
                  id="incident-occurred"
                  type="datetime-local"
                  value={incidentDraft.occurredAt}
                  onChange={event =>
                    setIncidentDraft({ ...incidentDraft, occurredAt: event.target.value })
                  }
                  disabled={busy !== ''}
                  style={inputStyle}
                />
              </Labelled>
              <Labelled id="incident-phone" label="Contact phone (optional)">
                <input
                  id="incident-phone"
                  type="tel"
                  value={incidentDraft.contactPhone}
                  onChange={event =>
                    setIncidentDraft({ ...incidentDraft, contactPhone: event.target.value })
                  }
                  disabled={busy !== ''}
                  placeholder="+265…"
                  style={inputStyle}
                />
              </Labelled>
            </div>
            <Labelled id="incident-description" label="What happened?">
              <textarea
                id="incident-description"
                value={incidentDraft.description}
                onChange={event =>
                  setIncidentDraft({ ...incidentDraft, description: event.target.value })
                }
                rows={3}
                placeholder="Describe the incident, where it happened, and who was involved"
                disabled={busy !== ''}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Labelled>
            <div>
              <button type="submit" disabled={busy !== ''} style={dangerButton}>
                {busy === 'incident-create' ? 'Reporting…' : 'Report incident'}
              </button>
            </div>
          </form>
        ) : null}

        {incidents.length === 0 ? (
          <p style={{ ...smallMeta, marginTop: 10 }}>
            No incidents reported for this booking.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {incidents.map(incident => {
              const resolved = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(incident.status)
              const resolving = resolveDraft?.incidentId === incident.id
              return (
                <div key={incident.id} style={subCard}>
                  <div style={rowBetween}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
                        {incidentTypeLabel(incident.type)}
                      </p>
                      <p style={smallMeta}>
                        Reported {formatDateTime(incident.createdAt)}
                        {incident.occurredAt
                          ? ` · Occurred ${formatDateTime(incident.occurredAt)}`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge
                      tone={decisionTone(incident.status)}
                      label={incidentStatusLabel(incident.status)}
                    />
                  </div>

                  <p style={{ ...smallMeta, marginTop: 8, color: 'var(--text-2)' }}>
                    {incident.description || 'No description recorded.'}
                  </p>

                  <div style={metaGrid}>
                    <DetailRow
                      label="Remedy"
                      value={incident.remedy ? prettyStatus(incident.remedy) : '—'}
                    />
                    <DetailRow
                      label="Contact phone"
                      value={incident.contactPhone || '—'}
                    />
                  </div>

                  {incident.resolution ? (
                    <p style={{ ...smallMeta, marginTop: 8, color: 'var(--text-2)' }}>
                      Resolution: {incident.resolution}
                    </p>
                  ) : null}

                  {incident.evidence.length > 0 ? (
                    <EvidenceList
                      items={incident.evidence}
                      idPrefix={`${incident.id}-evidence`}
                      label="Evidence"
                    />
                  ) : null}

                  {resolved ? null : (
                    <div style={{ marginTop: 10 }}>
                      {!resolving || !resolveDraft ? (
                        <button
                          type="button"
                          onClick={() =>
                            setResolveDraft({ incidentId: incident.id, resolution: '', remedy: '' })
                          }
                          disabled={busy !== ''}
                          style={ghostButton}
                        >
                          Resolve incident
                        </button>
                      ) : (
                        <form onSubmit={event => void submitResolution(event)} style={innerForm}>
                          <Labelled
                            id={`resolve-${incident.id}`}
                            label="Resolution (what was done?)"
                          >
                            <textarea
                              id={`resolve-${incident.id}`}
                              value={resolveDraft.resolution}
                              onChange={event =>
                                setResolveDraft(current =>
                                  current
                                    ? { ...current, resolution: event.target.value }
                                    : current,
                                )
                              }
                              rows={2}
                              placeholder="e.g. Replacement vehicle delivered; renter confirmed handover"
                              disabled={busy !== ''}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </Labelled>
                          <div style={{ marginTop: 9 }}>
                            <Labelled id={`remedy-${incident.id}`} label="Remedy (optional)">
                              <select
                                id={`remedy-${incident.id}`}
                                value={resolveDraft.remedy}
                                onChange={event =>
                                  setResolveDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          remedy: event.target.value as '' | IncidentRemedy,
                                        }
                                      : current,
                                  )
                                }
                                disabled={busy !== ''}
                                style={inputStyle}
                              >
                                <option value="">Not specified</option>
                                {REMEDY_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </Labelled>
                          </div>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                            <button type="submit" disabled={busy !== ''} style={primaryButton}>
                              {busy === `incident-${incident.id}-resolve`
                                ? 'Resolving…'
                                : 'Save resolution'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setResolveDraft(null)}
                              disabled={busy !== ''}
                              style={ghostButton}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ProviderCard>

      <ProviderCard style={{ marginTop: 16 }}>
        <SectionHeader
          title="Support cases"
          description="Open a case for payment, damage, handover, or safety questions. Support replies are handled by the Vero360 team."
          action={
            <button
              type="button"
              onClick={() => setSupportOpen(value => !value)}
              aria-expanded={supportOpen}
              disabled={busy !== ''}
              style={ghostButton}
            >
              {supportOpen ? 'Close form' : 'New support case'}
            </button>
          }
        />

        {panelErrors.support ? (
          <ProviderNotice tone="error">{panelErrors.support}</ProviderNotice>
        ) : null}

        {supportOpen ? (
          <form onSubmit={event => void submitSupportCase(event)} style={formPanel}>
            <Labelled id="support-category" label="Category">
              <select
                id="support-category"
                value={supportDraft.category}
                onChange={event =>
                  setSupportDraft({
                    ...supportDraft,
                    category: event.target.value as SupportCaseCategory,
                  })
                }
                disabled={busy !== ''}
                style={inputStyle}
              >
                {SUPPORT_CATEGORIES.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled id="support-subject" label="Subject">
              <input
                id="support-subject"
                value={supportDraft.subject}
                onChange={event =>
                  setSupportDraft({ ...supportDraft, subject: event.target.value })
                }
                disabled={busy !== ''}
                placeholder="Short summary of the issue"
                style={inputStyle}
              />
            </Labelled>
            <Labelled id="support-message" label="Message">
              <textarea
                id="support-message"
                value={supportDraft.message}
                onChange={event =>
                  setSupportDraft({ ...supportDraft, message: event.target.value })
                }
                rows={3}
                placeholder="Include dates, amounts, and anything the support team should check"
                disabled={busy !== ''}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Labelled>
            <div>
              <button type="submit" disabled={busy !== ''} style={primaryButton}>
                {busy === 'support-create' ? 'Opening case…' : 'Open support case'}
              </button>
            </div>
          </form>
        ) : null}

        {supportCases.length === 0 ? (
          <p style={{ ...smallMeta, marginTop: 10 }}>
            No support cases for this booking. Open one if payment, damage, or handover needs the
            Vero360 team.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {supportCases.map(supportCase => (
              <div key={supportCase.id} style={subCard}>
                <div style={rowBetween}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
                      {supportCase.subject}
                    </p>
                    <p style={smallMeta}>
                      {prettyStatus(supportCase.category)} · Opened{' '}
                      {formatDateTime(supportCase.createdAt)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={decisionTone(supportCase.status)}
                    label={prettyStatus(supportCase.status)}
                  />
                </div>
                {supportCase.message ? (
                  <p style={{ ...smallMeta, marginTop: 8, color: 'var(--text-2)' }}>
                    {supportCase.message}
                  </p>
                ) : null}
                {supportCase.resolution ? (
                  <p style={{ ...smallMeta, marginTop: 6, color: 'var(--text-2)' }}>
                    Resolution: {supportCase.resolution}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </ProviderCard>

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          Handover, incident, extension, and support actions are authorised by the backend. This
          page never changes booking dates, amounts, or statuses locally — it refetches after every
          action.
        </ProviderNotice>
      </div>
    </>
  )
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div style={{ ...rowBetween, marginBottom: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={subTitle}>{title}</h2>
        {description ? (
          <p style={{ ...smallMeta, marginTop: 5, maxWidth: 720 }}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

function Labelled({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {children}
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

function EvidenceList({
  items,
  idPrefix,
  label,
}: {
  items: string[]
  idPrefix: string
  label: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((item, index) => {
        const href = /^(https?:\/\/|\/)/i.test(item) ? resolveVeroMediaUrl(item) : null
        return href ? (
          <a
            key={`${idPrefix}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={inlineLink}
          >
            {label} {index + 1}
          </a>
        ) : (
          <span key={`${idPrefix}-${index}`} style={smallMeta}>
            {item}
          </span>
        )
      })}
    </div>
  )
}

const subTitle = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: '-0.2px',
} as const

const smallMeta = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--text-3)',
} as const

const metaLabel = {
  margin: 0,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-4)',
} as const

const inlineLink = {
  color: '#C2410C',
  fontWeight: 800,
  textDecoration: 'none',
} as const

const subCard = {
  border: '1px solid var(--border)',
  borderRadius: 13,
  padding: 13,
  background: '#fff',
} as const

const rowBetween = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'flex-start',
  justifyContent: 'space-between',
} as const

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 10,
  alignItems: 'start',
} as const

const checkGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 8,
  marginTop: 4,
} as const

const checkboxLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-2)',
} as const

const fieldset = {
  border: '1px solid var(--border)',
  borderRadius: 11,
  padding: '9px 12px 11px',
  margin: 0,
} as const

const legend = {
  padding: '0 4px',
  fontSize: 11,
  fontWeight: 900,
  color: 'var(--text-3)',
} as const

const chip = {
  display: 'inline-flex',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 999,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-2)',
} as const

const ackList = {
  margin: '4px 0 0',
  paddingLeft: 18,
  fontSize: 12,
  lineHeight: 1.60,
  color: 'var(--text-2)',
} as const

const metaGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 6,
  marginTop: 9,
  padding: '9px 11px',
  borderRadius: 10,
  background: 'var(--surface)',
} as const

const formPanel = {
  display: 'grid',
  gap: 10,
  padding: 13,
  borderRadius: 13,
  border: '1px solid #FED7AA',
  background: '#FFFBF5',
  marginBottom: 12,
} as const

const confirmBox = {
  padding: 11,
  borderRadius: 11,
  border: '1px solid #A7F3D0',
  background: '#F0FDF4',
  marginTop: 9,
} as const

const innerForm = {
  display: 'grid',
  gap: 9,
  padding: 11,
  borderRadius: 11,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
} as const
