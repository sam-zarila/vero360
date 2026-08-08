import 'server-only'

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function normalizePrivateKey(key: string): string {
  let k = key.trim()
  // Netlify UI often wraps values in quotes
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1)
  }
  return k.replace(/\\n/g, '\n')
}

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** Parse service account from Netlify env (JSON, quoted JSON, or base64). */
function parseServiceAccountEnv(raw: string): ServiceAccount {
  let s = raw.trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }

  if (!s.startsWith('{')) {
    s = Buffer.from(s, 'base64').toString('utf8').trim()
  }

  let parsed: unknown = JSON.parse(s)
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Service account value is not a JSON object')
  }

  const obj = parsed as Record<string, unknown>
  const projectId = String(obj.project_id || obj.projectId || '').trim()
  const clientEmail = String(obj.client_email || obj.clientEmail || '').trim()
  const privateKey = String(obj.private_key || obj.privateKey || '').trim()
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Service account missing project_id, client_email, or private_key')
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  }
}

/** Default Firebase Storage bucket (must match Flutter / client config). */
export function getAdminStorageBucket(): string {
  return (
    pickEnv(
      'FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'GOOGLE_CLOUD_STORAGE_BUCKET',
    ) || 'vero360app-ca423.firebasestorage.app'
  )
}

function adminAppOptions(projectId: string) {
  return {
    projectId,
    storageBucket: getAdminStorageBucket(),
  }
}

function initFromServiceAccount(sa: ServiceAccount, projectId: string): App {
  return initializeApp({
    ...adminAppOptions(projectId),
    credential: cert(sa),
  })
}

function initAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const errors: string[] = []

  // 1) Prefer simple Netlify-friendly email + private key (no JSON paste issues)
  const projectId =
    pickEnv('FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') ||
    'vero360app-ca423'
  const clientEmail = pickEnv('FIREBASE_CLIENT_EMAIL')
  const privateKey = pickEnv('FIREBASE_PRIVATE_KEY')
  if (clientEmail && privateKey) {
    try {
      return initFromServiceAccount(
        {
          projectId,
          clientEmail,
          privateKey: normalizePrivateKey(privateKey),
        },
        projectId,
      )
    } catch (err) {
      errors.push(
        `FIREBASE_CLIENT_EMAIL/PRIVATE_KEY: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // 2) JSON or base64 blob (try each independently)
  for (const key of [
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64',
  ] as const) {
    const raw = pickEnv(key)
    if (!raw) continue
    try {
      const sa = parseServiceAccountEnv(raw)
      return initFromServiceAccount(sa, String(sa.projectId || projectId))
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 3) Local file path (dev only — does not exist on Netlify)
  const jsonPath = pickEnv(
    'FIREBASE_SERVICE_ACCOUNT_PATH',
    'GOOGLE_APPLICATION_CREDENTIALS',
  )
  if (jsonPath) {
    const resolvedPath = resolve(process.cwd(), jsonPath)
    if (existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(readFileSync(resolvedPath, 'utf8')) as {
          project_id: string
          client_email: string
          private_key: string
        }
        return initFromServiceAccount(
          {
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: normalizePrivateKey(serviceAccount.private_key),
          },
          serviceAccount.project_id,
        )
      } catch (err) {
        errors.push(
          `FIREBASE_SERVICE_ACCOUNT_PATH: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    } else {
      errors.push(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${resolvedPath}`)
    }
  }

  throw new Error(
    `Firebase Admin is not configured on this host. ${
      errors.length ? errors.join(' | ') : 'Set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
    }`,
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

/** Non-secret status for debugging Netlify env (no private key leaked). */
export function getFirebaseAdminStatus() {
  try {
    const app = initAdminApp()
    return {
      ok: true,
      projectId: app.options.projectId || null,
      hasClientEmail: Boolean(pickEnv('FIREBASE_CLIENT_EMAIL')),
      hasPrivateKey: Boolean(pickEnv('FIREBASE_PRIVATE_KEY')),
      hasServiceAccountJson: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON')),
      hasServiceAccountBase64: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64')),
      hasServiceAccountPath: Boolean(
        pickEnv('FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_APPLICATION_CREDENTIALS'),
      ),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      hasClientEmail: Boolean(pickEnv('FIREBASE_CLIENT_EMAIL')),
      hasPrivateKey: Boolean(pickEnv('FIREBASE_PRIVATE_KEY')),
      hasServiceAccountJson: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON')),
      hasServiceAccountBase64: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64')),
      hasServiceAccountPath: Boolean(
        pickEnv('FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_APPLICATION_CREDENTIALS'),
      ),
    }
  }
}
