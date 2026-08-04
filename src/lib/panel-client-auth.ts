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
