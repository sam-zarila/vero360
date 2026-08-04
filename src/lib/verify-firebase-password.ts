/**
 * Verify an email/password against Firebase Auth (Identity Toolkit).
 * Used when a super admin must confirm their own password for sensitive actions.
 */
export async function verifyFirebasePassword(
  email: string,
  password: string,
): Promise<boolean> {
  const e = email.trim().toLowerCase()
  const p = password
  if (!e || !p) return false

  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    'AIzaSyCQ5_4N2J_xwKqmY-lAa8-ifRxovoRTTYk'

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: e,
          password: p,
          returnSecureToken: true,
        }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}
