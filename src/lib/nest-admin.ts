import {
  apiErrorMessage,
  getVeroAdminToken,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

/** Nest admin routes accept x-admin-api-key after panel auth on Next. */
export function nestAdminHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  }
  const key =
    process.env.VERO_ADMIN_API_KEY?.trim() ||
    process.env.ADMIN_API_KEY?.trim() ||
    getVeroAdminToken()
  if (key) {
    headers['x-admin-api-key'] = key
    headers.Authorization = `Bearer ${key}`
  }
  return headers
}

export async function nestAdminFetch(
  segments: Array<string | number>,
  init?: RequestInit,
) {
  const res = await fetch(veroEndpoint(...segments), {
    ...init,
    headers: {
      ...nestAdminHeaders(
        init?.headers as Record<string, string> | undefined,
      ),
    },
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  return { res, body, error: apiErrorMessage(body, 'Request failed') }
}
