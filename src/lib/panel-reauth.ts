import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase'

/** Re-check the signed-in admin's /panel password (Firebase email/password). */
export async function reauthPanelPassword(password: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) {
    throw new Error('Sign in again at /panel, then try delete again.')
  }
  const cred = EmailAuthProvider.credential(user.email, password)
  await reauthenticateWithCredential(user, cred)
}

export function panelPasswordError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code || '')
      : ''
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Incorrect password. Use the same password you sign in with.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Could not verify password.'
}
