import { auth } from '@/lib/firebase'

/** Firebase ID token for admin API calls (empty string if signed out). */
export async function getPanelIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}

export async function panelAuthHeaders(
  json = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  const token = await getPanelIdToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** Authenticated fetch for `/api/admin/*`. Always sends the Firebase ID token. */
export async function adminFetch(input: string, init: RequestInit = {}) {
  const body = init.body
  const isForm =
    typeof FormData !== 'undefined' && body instanceof FormData
  const authHeaders = await panelAuthHeaders(Boolean(body) && !isForm)
  const merged: Record<string, string> = { ...authHeaders }
  const extra = init.headers
  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        merged[key] = value
      })
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) merged[key] = value
    } else {
      Object.assign(merged, extra)
    }
  }
  return fetch(input, {
    ...init,
    cache: init.cache ?? 'no-store',
    headers: merged,
  })
}
