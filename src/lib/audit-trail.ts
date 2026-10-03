/** Panel audit trail — Firestore `audit_trail`. Safe to import from client pages. */

export const AUDIT_TRAIL_COLLECTION = 'audit_trail'

export type AuditEvent = {
  id: string
  action: string
  resource: string
  resourceId: string | null
  summary: string
  actorUid: string
  actorEmail: string
  actorName: string
  actorRole: string
  createdAt: string | null
}

export type RecordAuditInput = {
  action: string
  resource: string
  resourceId?: string | null
  summary: string
  actorUid: string
  actorEmail?: string | null
  actorName?: string | null
  actorRole?: string | null
}
