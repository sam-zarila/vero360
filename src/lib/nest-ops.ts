import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

const OPS_KEY_MISSING =
  'Car-hire ops key missing. Add CAR_HIRE_OPS_KEY to .env.local (must match vero-backend CAR_HIRE_OPS_KEY), then restart the dev server.'

/**
 * Why this is separate from nestAdminFetch: the car-hire moderation API is
 * guarded by the dedicated `x-ops-key` header, not the admin bearer token /
 * x-admin-api-key used by every other Nest admin route. Sharing one helper
 * would send the wrong credential and leak the admin key to the ops service.
 *
 * The key is read only from server env. It is never accepted from the request,
 * query string, or client, and it is never logged or echoed back.
 */
function configuredOpsKey(): string {
  return process.env.CAR_HIRE_OPS_KEY?.trim() || ''
}

export async function nestOpsFetch(
  segments: Array<string | number>,
  init?: RequestInit,
) {
  const key = configuredOpsKey()
  if (!key) {
    return {
      res: { ok: false, status: 503 } as Response,
      body: { message: OPS_KEY_MISSING },
      error: OPS_KEY_MISSING,
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
    'x-ops-key': key,
  }

  const res = await fetch(veroEndpoint(...segments), {
    ...init,
    headers,
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  return { res, body, error: apiErrorMessage(body, 'Request failed') }
}
