import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  AUDIT_TRAIL_COLLECTION,
  type AuditEvent,
  type RecordAuditInput,
} from '@/lib/audit-trail'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

function parseAuditEvent(id: string, data: DocumentData): AuditEvent {
  return {
    id,
    action: str(data.action) || 'update',
    resource: str(data.resource) || 'unknown',
    resourceId: str(data.resourceId) || null,
    summary: str(data.summary),
    actorUid: str(data.actorUid),
    actorEmail: str(data.actorEmail),
    actorName: str(data.actorName),
    actorRole: str(data.actorRole),
    createdAt: tsToIso(data.createdAt),
  }
}

export async function recordPanelAudit(
  actor: {
    uid: string
    email: string
    admin: { displayName?: string | null; email?: string | null; role: string }
  },
  input: Pick<RecordAuditInput, 'action' | 'resource' | 'resourceId' | 'summary'>,
): Promise<void> {
  await recordAudit({
    ...input,
    actorUid: actor.uid,
    actorEmail: actor.email || actor.admin.email,
    actorName: actor.admin.displayName || actor.email,
    actorRole: actor.admin.role,
  })
}

/** Append one trail row. Failures are logged and never thrown. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const summary = str(input.summary).slice(0, 500)
  const action = str(input.action).slice(0, 80)
  const resource = str(input.resource).slice(0, 80)
  if (!action || !resource || !summary) return

  try {
    await getAdminDb().collection(AUDIT_TRAIL_COLLECTION).add({
      action,
      resource,
      resourceId: str(input.resourceId) || null,
      summary,
      actorUid: str(input.actorUid) || 'unknown',
      actorEmail: str(input.actorEmail).toLowerCase(),
      actorName: str(input.actorName),
      actorRole: str(input.actorRole) || 'unknown',
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error('recordAudit failed:', err)
  }
}

export async function listAuditEvents(limit = 200): Promise<AuditEvent[]> {
  const cap = Math.min(Math.max(limit, 1), 300)
  const snap = await getAdminDb()
    .collection(AUDIT_TRAIL_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(cap)
    .get()
  return snap.docs.map(d => parseAuditEvent(d.id, d.data()))
}
