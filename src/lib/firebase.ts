import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/** Prefer env, but ignore blank strings (Netlify often sets empty NEXT_PUBLIC_* keys). */
function envOr(key: string, fallback: string): string {
  const v = process.env[key]
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

const firebaseConfig = {
  apiKey: envOr(
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'AIzaSyCQ5_4N2J_xwKqmY-lAa8-ifRxovoRTTYk',
  ),
  authDomain: envOr(
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'vero360app-ca423.firebaseapp.com',
  ),
  projectId: envOr('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'vero360app-ca423'),
  storageBucket: envOr(
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'vero360app-ca423.firebasestorage.app',
  ),
  messagingSenderId: envOr(
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    '1010595167807',
  ),
  appId: envOr(
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    '1:1010595167807:android:f63d7c7959bdb2891dc28a',
  ),
}

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

export const auth = getAuth(app)
export const db = getFirestore(app)

export function getAdminDashboardUrl() {
  const base = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'
  return `${base.replace(/\/$/, '')}/dashboard`
}
