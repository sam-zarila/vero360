import 'server-only'

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function normalizePrivateKey(key: string): string {
  let k = key.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1)
  }
  return k.replace(/\\n/g, '\n')
}

/** Default Firebase Storage bucket (must match Flutter / client config). */
export function getAdminStorageBucket(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
    'vero360app-ca423.firebasestorage.app'
  ).trim()
}

function adminAppOptions(projectId: string) {
  return {
    projectId,
    storageBucket: getAdminStorageBucket(),
  }
}

function initAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (jsonEnv) {
    const raw = JSON.parse(jsonEnv) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }
    if (raw.project_id && raw.client_email && raw.private_key) {
      return initializeApp({
        ...adminAppOptions(raw.project_id),
        credential: cert({
          projectId: raw.project_id,
          clientEmail: raw.client_email,
          privateKey: normalizePrivateKey(raw.private_key),
        }),
      })
    }
  }

  const jsonPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (jsonPath) {
    const resolvedPath = resolve(process.cwd(), jsonPath)
    if (existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(readFileSync(resolvedPath, 'utf8')) as {
        project_id: string
        client_email: string
        private_key: string
      }
      return initializeApp({
        ...adminAppOptions(serviceAccount.project_id),
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: normalizePrivateKey(serviceAccount.private_key),
        }),
      })
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'vero360app-ca423'
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (clientEmail && privateKey) {
    return initializeApp({
      ...adminAppOptions(projectId),
      credential: cert({
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKey),
      }),
    })
  }

  throw new Error(
    'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
  )
}

export function getAdminDb() {
  const app = initAdminApp()
  return getFirestore(app)
}

export function getAdminAuth() {
  const app = initAdminApp()
  return getAuth(app)
}

export function getAdminStorage() {
  const app = initAdminApp()
  return getStorage(app)
}
