import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function normalizePrivateKey(key: string): string {
  let k = key.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1)
  }
  return k.replace(/\\n/g, '\n')
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
