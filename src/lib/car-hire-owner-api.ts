'use client'

/**
 * Authenticated provider (owner/operator) API calls.
 *
 * The caller's Firebase ID token is the only credential used. No service token,
 * admin token, or operator id is ever placed in the browser bundle.
 */

import { auth } from '@/lib/firebase'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'
import {
  parseBookingExtensions,
  parseCarHireBookingResponse,
  parseBookingUnitOptions,
  parseCarHireBookings,
  parseIncidents,
  parseInspectionList,
  parseMaintenanceBlocks,
  parseOperatorInvitation,
  parseOperators,
  parseOwnerVehicles,
  parseProviderAnalytics,
  parseProviderSummary,
  parseSupportCases,
  type AcknowledgeInspectionInput,
  type BookingExtension,
  type BookingUnitOption,
  type CarHireBooking,
  type CreateMaintenanceBlockInput,
  type IncidentReport,
  type InspectionList,
  type InspectionType,
  type MaintenanceBlock,
  type OpenSupportCaseInput,
  type OperatorInvitation,
  type OperatorProfileInput,
  type OperatorSummary,
  type OwnerVehicle,
  type ProviderAnalytics,
  type ProviderSummary,
  type ReportIncidentInput,
  type ResolveIncidentInput,
  type SubmitInspectionInput,
  type SupportCase,
  type VehicleInput,
} from '@/lib/car-hire'

export class ProviderApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ProviderApiError'
    this.status = status
    this.body = body
  }
}

function cleanPath(path: string): string {
  return path.replace(/^\/+/, '')
}

function queryString(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

/**
 * Fetch a car-rental provider endpoint with the signed-in user's ID token.
 * `path` is relative to `/vero/car-rental` (e.g. `owner/summary`).
 */
export async function providerFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const user = auth.currentUser
  if (!user) {
    throw new ProviderApiError('Sign in to manage your provider workspace.', 401, null)
  }

  let token: string
  try {
    token = await user.getIdToken()
  } catch {
    throw new ProviderApiError(
      'Your session expired. Sign out and sign in again.',
      401,
      null,
    )
  }

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(veroEndpoint('car-rental', cleanPath(path)), {
      ...init,
      headers,
      cache: 'no-store',
    })
  } catch {
    throw new ProviderApiError(
      'Could not reach the Vero360 service. Check your connection and try again.',
      0,
      null,
    )
  }

  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new ProviderApiError(
      apiErrorMessage(body, `Request failed (${res.status}).`),
      res.status,
      body,
    )
  }
  return body
}

export async function getSummary(): Promise<ProviderSummary> {
  const body = await providerFetch('owner/summary')
  const summary = parseProviderSummary(body)
  if (!summary) {
    throw new ProviderApiError('The provider summary could not be read.', 502, body)
  }
  return summary
}

export async function getFleet(): Promise<OwnerVehicle[]> {
  const body = await providerFetch('cars/owner/fleet')
  return parseOwnerVehicles(body)
}

const MAX_VEHICLE_PHOTO_BYTES = 20 * 1024 * 1024
const VEHICLE_PHOTO_TYPES = /^image\/(png|jpe?g|webp|heic|heif)$/i

/**
 * Upload one vehicle photo and return its public URL.
 *
 * Uses the same Firebase ID token as the rest of the provider workspace. The
 * backend stores the file under /uploads and returns an absolute URL; the fleet
 * editor saves that URL on the listing (`images[]`, with `imageUrl` as the
 * primary image).
 */
export async function uploadVehiclePhoto(file: File): Promise<string> {
  if (!VEHICLE_PHOTO_TYPES.test(file.type)) {
    throw new ProviderApiError('Choose a PNG, JPG, WEBP, HEIC, or HEIF image.', 400, null)
  }
  if (file.size > MAX_VEHICLE_PHOTO_BYTES) {
    throw new ProviderApiError('Each photo must be 20 MB or smaller.', 400, null)
  }

  const user = auth.currentUser
  if (!user) {
    throw new ProviderApiError('Sign in to upload vehicle photos.', 401, null)
  }

  let token: string
  try {
    token = await user.getIdToken()
  } catch {
    throw new ProviderApiError('Your session expired. Sign out and sign in again.', 401, null)
  }

  const form = new FormData()
  form.append('file', file, file.name || 'vehicle-photo.jpg')

  let res: Response
  try {
    res = await fetch(veroEndpoint('uploads'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
      cache: 'no-store',
    })
  } catch {
    throw new ProviderApiError(
      'Could not reach the Vero360 service. Check your connection and try again.',
      0,
      null,
    )
  }

  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new ProviderApiError(
      apiErrorMessage(body, `Photo upload failed (${res.status}).`),
      res.status,
      body,
    )
  }

  const url =
    body && typeof body === 'object' && 'url' in body
      ? String((body as { url?: unknown }).url ?? '').trim()
      : ''
  if (!url) {
    throw new ProviderApiError('The upload succeeded but returned no image URL.', 502, body)
  }
  return url
}

/** Create a listing owned by the signed-in provider. */
export async function createVehicle(
  input: VehicleInput,
): Promise<OwnerVehicle | null> {
  const body = await providerFetch('cars', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return parseOwnerVehicles(body)[0] ?? null
}

/** Add identical units (new registrations) to a listing. */
export async function addListingUnits(
  carId: number | string,
  units: { licensePlate: string; color?: string; unitLabel?: string }[],
): Promise<{ listingId: string | null; created: number[] }> {
  const body = (await providerFetch(`cars/${encodeURIComponent(String(carId))}/units`, {
    method: 'POST',
    body: JSON.stringify({ units }),
  })) as { listingId?: string; created?: number[] } | null
  return { listingId: body?.listingId ?? null, created: body?.created ?? [] }
}

/** Merge separately listed identical cars into one listing (first car wins). */
export async function groupListingUnits(carIds: number[]): Promise<void> {
  await providerFetch('cars/owner/group-units', {
    method: 'POST',
    body: JSON.stringify({ carIds }),
  })
}

export async function ungroupListingUnit(carId: number | string): Promise<void> {
  await providerFetch(`cars/${encodeURIComponent(String(carId))}/ungroup`, {
    method: 'POST',
  })
}

/** Units of a booking's listing with whether each is free for that rental. */
export async function getBookingUnitOptions(
  bookingId: number | string,
): Promise<BookingUnitOption[]> {
  const body = await providerFetch(`bookings/${encodeURIComponent(String(bookingId))}/units`)
  return parseBookingUnitOptions(body)
}

export async function assignBookingUnit(
  bookingId: number | string,
  carId: number,
): Promise<CarHireBooking | null> {
  const body = await providerFetch(
    `bookings/${encodeURIComponent(String(bookingId))}/assign-unit`,
    { method: 'POST', body: JSON.stringify({ carId }) },
  )
  return parseCarHireBookingResponse(body)
}

/** Update one of the signed-in provider's own listings. */
export async function updateVehicle(
  carId: number | string,
  input: Partial<VehicleInput>,
): Promise<OwnerVehicle | null> {
  const body = await providerFetch(
    `cars/${encodeURIComponent(String(carId))}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  return parseOwnerVehicles(body)[0] ?? null
}

export async function getOwnerBookings(options: {
  status?: string
  page?: number
  limit?: number
} = {}): Promise<CarHireBooking[]> {
  const query = queryString({
    status: options.status,
    page: options.page,
    limit: options.limit ?? 100,
  })
  const body = await providerFetch(`owner/bookings${query}`)
  return parseCarHireBookings(body)
}

export async function getMaintenanceBlocks(carId: number | string): Promise<MaintenanceBlock[]> {
  const body = await providerFetch(`cars/${encodeURIComponent(String(carId))}/maintenance-blocks`)
  return parseMaintenanceBlocks(body)
}

export async function createMaintenanceBlock(
  carId: number | string,
  input: CreateMaintenanceBlockInput,
): Promise<MaintenanceBlock | null> {
  const body = await providerFetch(
    `cars/${encodeURIComponent(String(carId))}/maintenance-blocks`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return parseMaintenanceBlocks(body)[0] ?? null
}

export async function confirmBooking(bookingId: number | string): Promise<void> {
  await providerFetch(`bookings/${encodeURIComponent(String(bookingId))}/confirm`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function rejectBooking(
  bookingId: number | string,
  reason: string,
): Promise<void> {
  await providerFetch(`bookings/${encodeURIComponent(String(bookingId))}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason.trim() }),
  })
}

function bookingPath(bookingId: number | string): string {
  return `bookings/${encodeURIComponent(String(bookingId))}`
}

export async function getBooking(bookingId: number | string): Promise<CarHireBooking | null> {
  const body = await providerFetch(bookingPath(bookingId))
  return parseCarHireBookingResponse(body)
}

/* ------------------------------------------------------------------------- */
/* Handover inspections                                                      */
/* ------------------------------------------------------------------------- */

export async function getInspections(bookingId: number | string): Promise<InspectionList> {
  const body = await providerFetch(`${bookingPath(bookingId)}/inspections`)
  return parseInspectionList(body)
}

export async function submitInspection(
  bookingId: number | string,
  type: InspectionType,
  input: SubmitInspectionInput,
): Promise<void> {
  await providerFetch(`${bookingPath(bookingId)}/inspections/${type.toLowerCase()}`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function acknowledgeInspection(
  bookingId: number | string,
  inspectionId: string,
  input: AcknowledgeInspectionInput,
): Promise<void> {
  await providerFetch(
    `${bookingPath(bookingId)}/inspections/${encodeURIComponent(inspectionId)}/acknowledge`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

/* ------------------------------------------------------------------------- */
/* Incidents                                                                 */
/* ------------------------------------------------------------------------- */

export async function getIncidents(bookingId: number | string): Promise<IncidentReport[]> {
  const body = await providerFetch(`${bookingPath(bookingId)}/incidents`)
  return parseIncidents(body)
}

export async function reportIncident(
  bookingId: number | string,
  input: ReportIncidentInput,
): Promise<void> {
  await providerFetch(`${bookingPath(bookingId)}/incidents`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function resolveIncident(
  bookingId: number | string,
  incidentId: string,
  input: ResolveIncidentInput,
): Promise<void> {
  await providerFetch(
    `${bookingPath(bookingId)}/incidents/${encodeURIComponent(incidentId)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

/* ------------------------------------------------------------------------- */
/* Support cases                                                             */
/* ------------------------------------------------------------------------- */

export async function getSupportCases(bookingId: number | string): Promise<SupportCase[]> {
  const body = await providerFetch(`${bookingPath(bookingId)}/support-cases`)
  return parseSupportCases(body)
}

export async function openSupportCase(
  bookingId: number | string,
  input: OpenSupportCaseInput,
): Promise<void> {
  await providerFetch(`${bookingPath(bookingId)}/support-cases`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ------------------------------------------------------------------------- */
/* Extensions                                                                */
/* ------------------------------------------------------------------------- */

export async function getExtensions(
  bookingId: number | string,
): Promise<BookingExtension[]> {
  const body = await providerFetch(`${bookingPath(bookingId)}/extensions`)
  return parseBookingExtensions(body)
}

export async function approveExtension(
  bookingId: number | string,
  extensionId: string,
): Promise<void> {
  await providerFetch(
    `${bookingPath(bookingId)}/extensions/${encodeURIComponent(extensionId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  )
}

export async function declineExtension(
  bookingId: number | string,
  extensionId: string,
  reason?: string,
): Promise<void> {
  const trimmed = reason?.trim() ?? ''
  await providerFetch(
    `${bookingPath(bookingId)}/extensions/${encodeURIComponent(extensionId)}/decline`,
    {
      method: 'POST',
      body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
    },
  )
}

/* ------------------------------------------------------------------------- */
/* Team                                                                      */
/* ------------------------------------------------------------------------- */

export async function getMyOperators(): Promise<OperatorSummary[]> {
  const body = await providerFetch('operators/mine')
  return parseOperators(body)
}

export async function updateOperatorProfile(
  operatorId: string,
  input: OperatorProfileInput,
): Promise<OperatorSummary | null> {
  const body = await providerFetch(`operators/${encodeURIComponent(operatorId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return parseOperators(body)[0] ?? null
}

export async function inviteMember(
  operatorId: string,
  input: { email: string; permissions?: string[] },
): Promise<OperatorInvitation | null> {
  const body = await providerFetch(
    `operators/${encodeURIComponent(operatorId)}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email.trim(),
        ...(input.permissions && input.permissions.length > 0
          ? { permissions: input.permissions }
          : {}),
      }),
    },
  )
  return parseOperatorInvitation(body)
}

export async function revokeMember(operatorId: string, userId: string): Promise<void> {
  await providerFetch(
    `operators/${encodeURIComponent(operatorId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}

/* ------------------------------------------------------------------------- */
/* Performance                                                               */
/* ------------------------------------------------------------------------- */

export async function getAnalytics(from?: string, to?: string): Promise<ProviderAnalytics> {
  const query = queryString({ from, to })
  const body = await providerFetch(`owner/analytics${query}`)
  const analytics = parseProviderAnalytics(body)
  if (!analytics) {
    throw new ProviderApiError('The performance analytics could not be read.', 502, body)
  }
  return analytics
}
