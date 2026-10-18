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
  parseCarHireBookings,
  parseCarListings,
  parseMaintenanceBlocks,
  parseProviderSummary,
  type CarHireBooking,
  type CarListing,
  type CreateMaintenanceBlockInput,
  type MaintenanceBlock,
  type ProviderSummary,
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

export async function getFleet(): Promise<CarListing[]> {
  const body = await providerFetch('cars/owner/fleet')
  return parseCarListings(body)
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
