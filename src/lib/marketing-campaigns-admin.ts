import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  MARKETING_CAMPAIGNS_COLLECTION,
  normalizeMarketingCampaignStatus,
  slugifyCampaign,
  type CreateMarketingCampaignInput,
  type MarketingCampaign,
  type UpdateMarketingCampaignInput,
} from '@/lib/marketing-campaigns'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

function channelsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => str(v)).filter(Boolean)
  }
  const raw = str(value)
  if (!raw) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export function parseMarketingCampaign(
  id: string,
  data: DocumentData | Record<string, unknown>,
): MarketingCampaign {
  return {
    id,
    name: str(data.name) || 'Untitled campaign',
    status: normalizeMarketingCampaignStatus(data.status),
    objective: str(data.objective),
    channels: channelsOf(data.channels),
    startDate: dateOnlyToIso(data.startDate),
    endDate: dateOnlyToIso(data.endDate),
    ownerUid: str(data.ownerUid) || null,
    ownerName: str(data.ownerName) || null,
    budgetMwk: numOrNull(data.budgetMwk),
    utmSource: str(data.utmSource) || 'marketing',
    utmMedium: str(data.utmMedium) || 'campaign',
    utmCampaign: str(data.utmCampaign) || slugifyCampaign(str(data.name) || id),
    landingPath: str(data.landingPath) || '/',
    notes: str(data.notes),
    audience: str(data.audience),
    creativeNotes: str(data.creativeNotes),
    cta: str(data.cta),
    targetInstalls: numOrNull(data.targetInstalls),
    targetSignups: numOrNull(data.targetSignups),
    createdByUid: str(data.createdByUid) || null,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  }
}

export async function listMarketingCampaigns(opts?: {
  limit?: number
}): Promise<MarketingCampaign[]> {
  const db = getAdminDb()
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500)
  const snap = await db.collection(MARKETING_CAMPAIGNS_COLLECTION).limit(limit).get()
  const items = snap.docs.map(doc => parseMarketingCampaign(doc.id, doc.data()))
  items.sort((a, b) => {
    const aTime = a.updatedAt || a.createdAt || ''
    const bTime = b.updatedAt || b.createdAt || ''
    return bTime.localeCompare(aTime)
  })
  return items
}

export async function getMarketingCampaign(
  id: string,
): Promise<MarketingCampaign | null> {
  const db = getAdminDb()
  const doc = await db.collection(MARKETING_CAMPAIGNS_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return parseMarketingCampaign(doc.id, doc.data() || {})
}

export async function createMarketingCampaign(
  input: CreateMarketingCampaignInput,
  actor: { uid: string; displayName?: string | null },
): Promise<MarketingCampaign> {
  const db = getAdminDb()
  const name = str(input.name)
  if (!name) throw new Error('Campaign name is required')

  const utmCampaign =
    str(input.utmCampaign) || slugifyCampaign(name)
  const ref = db.collection(MARKETING_CAMPAIGNS_COLLECTION).doc()
  const payload = {
    name,
    status: normalizeMarketingCampaignStatus(input.status),
    objective: str(input.objective),
    channels: channelsOf(input.channels),
    startDate: dateOnlyToIso(input.startDate),
    endDate: dateOnlyToIso(input.endDate),
    ownerUid: str(input.ownerUid) || actor.uid,
    ownerName: str(input.ownerName) || str(actor.displayName) || null,
    budgetMwk: numOrNull(input.budgetMwk),
    utmSource: str(input.utmSource) || 'marketing',
    utmMedium: str(input.utmMedium) || 'campaign',
    utmCampaign,
    landingPath: str(input.landingPath) || '/',
    notes: str(input.notes),
    audience: str(input.audience),
    creativeNotes: str(input.creativeNotes),
    cta: str(input.cta),
    targetInstalls: numOrNull(input.targetInstalls),
    targetSignups: numOrNull(input.targetSignups),
    createdByUid: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await ref.set(payload)
  const created = await ref.get()
  return parseMarketingCampaign(ref.id, created.data() || payload)
}

export async function updateMarketingCampaign(
  id: string,
  input: UpdateMarketingCampaignInput,
): Promise<MarketingCampaign> {
  const db = getAdminDb()
  const ref = db.collection(MARKETING_CAMPAIGNS_COLLECTION).doc(id)
  const existing = await ref.get()
  if (!existing.exists) throw new Error('Campaign not found')

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (input.name !== undefined) patch.name = str(input.name)
  if (input.status !== undefined) {
    patch.status = normalizeMarketingCampaignStatus(input.status)
  }
  if (input.objective !== undefined) patch.objective = str(input.objective)
  if (input.channels !== undefined) patch.channels = channelsOf(input.channels)
  if (input.startDate !== undefined) patch.startDate = dateOnlyToIso(input.startDate)
  if (input.endDate !== undefined) patch.endDate = dateOnlyToIso(input.endDate)
  if (input.ownerUid !== undefined) patch.ownerUid = str(input.ownerUid) || null
  if (input.ownerName !== undefined) patch.ownerName = str(input.ownerName) || null
  if (input.budgetMwk !== undefined) patch.budgetMwk = numOrNull(input.budgetMwk)
  if (input.utmSource !== undefined) patch.utmSource = str(input.utmSource) || 'marketing'
  if (input.utmMedium !== undefined) patch.utmMedium = str(input.utmMedium) || 'campaign'
  if (input.utmCampaign !== undefined) {
    patch.utmCampaign = str(input.utmCampaign) || slugifyCampaign(str(input.name) || id)
  }
  if (input.landingPath !== undefined) patch.landingPath = str(input.landingPath) || '/'
  if (input.notes !== undefined) patch.notes = str(input.notes)
  if (input.audience !== undefined) patch.audience = str(input.audience)
  if (input.creativeNotes !== undefined) patch.creativeNotes = str(input.creativeNotes)
  if (input.cta !== undefined) patch.cta = str(input.cta)
  if (input.targetInstalls !== undefined) {
    patch.targetInstalls = numOrNull(input.targetInstalls)
  }
  if (input.targetSignups !== undefined) {
    patch.targetSignups = numOrNull(input.targetSignups)
  }

  await ref.set(patch, { merge: true })
  const updated = await ref.get()
  return parseMarketingCampaign(id, updated.data() || {})
}

export async function deleteMarketingCampaign(id: string): Promise<void> {
  const db = getAdminDb()
  await db.collection(MARKETING_CAMPAIGNS_COLLECTION).doc(id).delete()
}

export async function countAttributedSignups(utmCampaign: string): Promise<number> {
  const slug = str(utmCampaign)
  if (!slug) return 0
  const db = getAdminDb()
  try {
    const snap = await db
      .collection('users')
      .where('attribution.firstTouch.utmCampaign', '==', slug)
      .limit(500)
      .get()
    return snap.size
  } catch {
    return 0
  }
}
