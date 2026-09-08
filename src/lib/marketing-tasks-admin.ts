import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  MARKETING_TASKS_COLLECTION,
  countMarketingTasks,
  normalizeMarketingTaskStatus,
  type CreateMarketingTaskInput,
  type MarketingTask,
  type MarketingTaskCounts,
  type MarketingTaskStatus,
  type UpdateMarketingTaskInput,
} from '@/lib/marketing-tasks'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

function dateOnlyToIso(value: unknown): string | null {
  const raw = str(value)
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return tsToIso(value)
}

export function parseMarketingTask(
  id: string,
  data: DocumentData | Record<string, unknown>,
): MarketingTask {
  const datePosted =
    dateOnlyToIso(data.datePosted) ||
    dateOnlyToIso(data.dateAssigned) ||
    tsToIso(data.createdAt)

  return {
    id,
    datePosted,
    dateAssigned: dateOnlyToIso(data.dateAssigned) || datePosted,
    marketerUid: str(data.marketerUid),
    marketerName: str(data.marketerName) || 'Marketer',
    marketerEmail: str(data.marketerEmail).toLowerCase(),
    taskTitle: str(data.taskTitle) || 'Untitled task',
    category: str(data.category) || 'Other',
    platform: str(data.platform) || 'Other',
    dueDate: dateOnlyToIso(data.dueDate),
    status: normalizeMarketingTaskStatus(data.status),
    dateCompleted: dateOnlyToIso(data.dateCompleted),
    approvedBy: str(data.approvedBy) || null,
    notes: str(data.notes),
    createdByUid: str(data.createdByUid) || null,
    createdByRole: str(data.createdByRole) || null,
    createdByName: str(data.createdByName) || null,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  }
}

export async function listMarketingTasks(opts?: {
  marketerUid?: string
  limit?: number
}): Promise<MarketingTask[]> {
  const db = getAdminDb()
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000)
  let snap

  try {
    if (opts?.marketerUid) {
      snap = await db
        .collection(MARKETING_TASKS_COLLECTION)
        .where('marketerUid', '==', opts.marketerUid.trim())
        .limit(limit)
        .get()
    } else {
      snap = await db
        .collection(MARKETING_TASKS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
    }
  } catch {
    if (opts?.marketerUid) {
      snap = await db
        .collection(MARKETING_TASKS_COLLECTION)
        .where('marketerUid', '==', opts.marketerUid.trim())
        .limit(limit)
        .get()
    } else {
      snap = await db.collection(MARKETING_TASKS_COLLECTION).limit(limit).get()
    }
  }

  const items = snap.docs.map(d => parseMarketingTask(d.id, d.data()))
  items.sort((a, b) => {
    const at = a.datePosted
      ? new Date(a.datePosted).getTime()
      : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0
    const bt = b.datePosted
      ? new Date(b.datePosted).getTime()
      : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0
    return bt - at
  })
  return items
}

export async function getMarketingTask(id: string): Promise<MarketingTask | null> {
  const clean = id.trim()
  if (!clean) return null
  const snap = await getAdminDb().collection(MARKETING_TASKS_COLLECTION).doc(clean).get()
  if (!snap.exists) return null
  return parseMarketingTask(snap.id, snap.data() || {})
}

export async function createMarketingTask(
  input: CreateMarketingTaskInput,
  meta: { createdByUid: string; createdByRole: string; createdByName?: string },
): Promise<MarketingTask> {
  const marketerUid = str(input.marketerUid)
  if (!marketerUid) throw new Error('Marketer is required')
  const taskTitle = str(input.taskTitle)
  if (!taskTitle) throw new Error('Task / content piece is required')

  const status = normalizeMarketingTaskStatus(input.status)
  const dateCompleted =
    status === 'completed'
      ? dateOnlyToIso(input.dateCompleted) || new Date().toISOString()
      : dateOnlyToIso(input.dateCompleted)

  const posted =
    dateOnlyToIso(input.datePosted) ||
    dateOnlyToIso(input.dateAssigned) ||
    null

  const ref = getAdminDb().collection(MARKETING_TASKS_COLLECTION).doc()
  await ref.set({
    datePosted: posted || FieldValue.serverTimestamp(),
    dateAssigned: posted || FieldValue.serverTimestamp(),
    marketerUid,
    marketerName: str(input.marketerName) || 'Marketer',
    marketerEmail: str(input.marketerEmail).toLowerCase(),
    taskTitle,
    category: str(input.category) || 'Other',
    platform: str(input.platform) || 'Other',
    dueDate: dateOnlyToIso(input.dueDate),
    status,
    dateCompleted: dateCompleted || null,
    approvedBy: str(input.approvedBy) || null,
    notes: str(input.notes),
    createdByUid: meta.createdByUid,
    createdByRole: meta.createdByRole,
    createdByName: str(meta.createdByName) || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const snap = await ref.get()
  return parseMarketingTask(ref.id, snap.data() || {})
}

export async function updateMarketingTask(
  id: string,
  patch: UpdateMarketingTaskInput,
  opts?: {
    allowAssignee?: boolean
    allowApprovedBy?: boolean
    /** When an admin reassigns, stamp who assigned. */
    assignedBy?: { uid: string; role: string; name: string }
  },
): Promise<MarketingTask> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing task id')
  const ref = getAdminDb().collection(MARKETING_TASKS_COLLECTION).doc(clean)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Task not found')

  const current = parseMarketingTask(snap.id, snap.data() || {})
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (patch.taskTitle !== undefined) {
    const title = str(patch.taskTitle)
    if (!title) throw new Error('Task / content piece is required')
    updates.taskTitle = title
  }
  if (patch.category !== undefined) updates.category = str(patch.category) || 'Other'
  if (patch.platform !== undefined) updates.platform = str(patch.platform) || 'Other'
  if (patch.notes !== undefined) updates.notes = str(patch.notes)
  if (patch.datePosted !== undefined || patch.dateAssigned !== undefined) {
    const posted =
      dateOnlyToIso(patch.datePosted) || dateOnlyToIso(patch.dateAssigned)
    updates.datePosted = posted
    updates.dateAssigned = posted
  }
  if (patch.dueDate !== undefined) updates.dueDate = dateOnlyToIso(patch.dueDate)

  let nextStatus: MarketingTaskStatus | undefined
  if (patch.status !== undefined) {
    nextStatus = normalizeMarketingTaskStatus(patch.status)
    updates.status = nextStatus
  }

  if (patch.dateCompleted !== undefined) {
    updates.dateCompleted = dateOnlyToIso(patch.dateCompleted)
  } else if (nextStatus === 'completed' && !current.dateCompleted) {
    updates.dateCompleted = FieldValue.serverTimestamp()
  } else if (nextStatus && nextStatus !== 'completed' && current.status === 'completed') {
    updates.dateCompleted = null
  }

  if (opts?.allowAssignee !== false && patch.marketerUid !== undefined) {
    const uid = str(patch.marketerUid)
    if (!uid) throw new Error('Marketer is required')
    updates.marketerUid = uid
    if (patch.marketerName !== undefined) {
      updates.marketerName = str(patch.marketerName) || 'Marketer'
    }
    if (patch.marketerEmail !== undefined) {
      updates.marketerEmail = str(patch.marketerEmail).toLowerCase()
    }
    if (opts?.assignedBy) {
      updates.createdByUid = opts.assignedBy.uid
      updates.createdByRole = opts.assignedBy.role
      updates.createdByName = opts.assignedBy.name
    }
  } else if (opts?.allowAssignee === false) {
    // Marketers cannot reassign.
  } else {
    if (patch.marketerName !== undefined) {
      updates.marketerName = str(patch.marketerName) || current.marketerName
    }
    if (patch.marketerEmail !== undefined) {
      updates.marketerEmail = str(patch.marketerEmail).toLowerCase() || current.marketerEmail
    }
  }

  if (opts?.allowApprovedBy && patch.approvedBy !== undefined) {
    updates.approvedBy = str(patch.approvedBy) || null
  }

  await ref.set(updates, { merge: true })
  const updated = await ref.get()
  return parseMarketingTask(updated.id, updated.data() || {})
}

export async function deleteMarketingTask(id: string): Promise<void> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing task id')
  await getAdminDb().collection(MARKETING_TASKS_COLLECTION).doc(clean).delete()
}

export function buildMarketingTaskCounts(tasks: MarketingTask[]): MarketingTaskCounts {
  return countMarketingTasks(tasks)
}
