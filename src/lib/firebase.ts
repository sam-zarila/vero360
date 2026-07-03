import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCQ5_4N2J_xwKqmY-lAa8-ifRxovoRTTYk',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'vero360app-ca423.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'vero360app-ca423',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'vero360app-ca423.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '1010595167807',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:1010595167807:android:f63d7c7959bdb2891dc28a',
}

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

export const auth = getAuth(app)
export const db = getFirestore(app)

export function getAdminDashboardUrl() {
  const base = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'
  return `${base.replace(/\/$/, '')}/dashboard`
}
