import { formatDateTime, resolveVeroMediaUrl } from '@/lib/vero-api'

export type JobRegion = 'malawi' | 'international'
export type JobSource = 'manual' | 'remotive' | 'jooble' | string

export type JobPost = {
  id: number
  position: string
  description: string
  jobLink: string
  photoUrl: string | null
  isActive: boolean
  source: JobSource
  externalId: string | null
  region: JobRegion
  company: string | null
  location: string | null
  isRemote: boolean
  syncedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type JobInput = {
  position: string
  description: string
  jobLink: string
  photoUrl?: string | null
  isActive?: boolean
  region?: JobRegion
  company?: string | null
  location?: string | null
  isRemote?: boolean
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return fallback
}

function ts(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  return null
}

export function parseJobPost(raw: unknown): JobPost | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const id = Number(m.id)
  if (!Number.isFinite(id) || id <= 0) return null

  const regionRaw = str(m.region).toLowerCase()
  const region: JobRegion =
    regionRaw === 'international' ? 'international' : 'malawi'

  return {
    id,
    position: str(m.position) || 'Untitled role',
    description: str(m.description),
    jobLink: str(m.jobLink),
    photoUrl: str(m.photoUrl) || null,
    isActive: bool(m.isActive, true),
    source: str(m.source) || 'manual',
    externalId: str(m.externalId) || null,
    region,
    company: str(m.company) || null,
    location: str(m.location) || null,
    isRemote: bool(m.isRemote, false),
    syncedAt: ts(m.syncedAt),
    createdAt: ts(m.createdAt),
    updatedAt: ts(m.updatedAt),
  }
}

export function parseJobPosts(body: unknown): JobPost[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : []
  return list.map(parseJobPost).filter((j): j is JobPost => j != null)
}

export function resolveJobImage(url?: string | null) {
  return resolveVeroMediaUrl(url)
}

export function regionLabel(region: JobRegion) {
  return region === 'international' ? 'International' : 'Malawi'
}

export function sourceLabel(source: JobSource) {
  switch (String(source).toLowerCase()) {
    case 'manual':
      return 'Posted by admin'
    case 'remotive':
      return 'Remotive'
    case 'jooble':
      return 'Jooble'
    default:
      return source || 'Unknown'
  }
}

export function jobStatusTone(isActive: boolean) {
  return isActive
    ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: 'Active' }
    : { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB', label: 'Inactive' }
}

/** Ensure Nest `@IsUrl` accepts the value (adds https:// when missing). */
export function normalizeHttpUrl(raw: string, fallback = ''): string {
  let v = str(raw)
  if (!v) return fallback
  if (/^(mailto|tel):/i.test(v)) return v
  if (!/^https?:\/\//i.test(v)) v = `https://${v.replace(/^\/+/, '')}`
  return v
}

/** Build Nest CreateJobDto / UpdateJobDto payload; omit empty optional fields. */
export function toJobApiBody(input: Partial<JobInput>, opts?: { partial?: boolean }) {
  const partial = opts?.partial === true
  const body: Record<string, unknown> = {}

  if (input.position !== undefined) {
    const v = str(input.position)
    if (!partial && !v) throw new Error('Position is required')
    if (v) body.position = v
    else if (!partial) throw new Error('Position is required')
  }

  if (input.description !== undefined) {
    const v = str(input.description)
    if (!partial && !v) throw new Error('Description is required')
    if (v) body.description = v
    else if (!partial) throw new Error('Description is required')
  }

  if (input.jobLink !== undefined) {
    const v = normalizeHttpUrl(
      str(input.jobLink),
      partial ? '' : 'https://vero360.app/careers',
    )
    if (!partial && !v) throw new Error('Application link is required')
    if (v) body.jobLink = v
  }

  if (input.photoUrl !== undefined) {
    const v = normalizeHttpUrl(str(input.photoUrl))
    if (v) body.photoUrl = v
    // Never send "" / null on create — Nest @IsUrl rejects empty strings.
  }

  if (input.isActive !== undefined) body.isActive = Boolean(input.isActive)
  if (input.region !== undefined) {
    body.region = input.region === 'international' ? 'international' : 'malawi'
  }
  if (input.company !== undefined) {
    const v = str(input.company)
    if (v) body.company = v
  }
  if (input.location !== undefined) {
    const v = str(input.location)
    if (v) body.location = v
  }
  if (input.isRemote !== undefined) body.isRemote = Boolean(input.isRemote)

  return body
}

export { formatDateTime }
