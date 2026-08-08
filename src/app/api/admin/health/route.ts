import { NextResponse } from 'next/server'
import { getFirebaseAdminStatus } from '@/lib/firebase-admin'

/** Public diagnostic — no secrets. Use to verify Netlify Firebase Admin env. */
export async function GET() {
  const status = getFirebaseAdminStatus()
  return NextResponse.json(
    {
      success: status.ok,
      firebaseAdmin: status,
      hint: status.ok
        ? 'Firebase Admin OK. Try signing in at /panel with admin@vero360.app'
        : 'Set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY on Netlify (from .env.netlify), remove FIREBASE_SERVICE_ACCOUNT_PATH, redeploy.',
    },
    { status: status.ok ? 200 : 503 },
  )
}
