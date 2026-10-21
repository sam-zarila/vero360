import type { OwnerVehicle } from '@/lib/car-hire'

/** Currency-aware money label. Falls back to the listing currency, then the summary currency. */
export function money(amount: number, currency?: string | null): string {
  if (!Number.isFinite(amount)) return '—'
  const code = (currency || 'MWK').trim()
  return `${code} ${Math.round(amount).toLocaleString('en-US')}`
}

export type ListingState = {
  key: 'published' | 'pending' | 'draft' | 'suspended' | 'other'
  label: string
  /** Tailwind background class for the legend dot / status pip. */
  dot: string
  /** Tailwind classes for an inline chip. */
  chip: string
  short: string
}

export function listingStateOf(
  car: Pick<OwnerVehicle, 'listingStatus'> | { listingStatus?: string | null },
): ListingState {
  switch (String(car.listingStatus || '').toUpperCase()) {
    case 'PUBLISHED':
      return {
        key: 'published',
        label: 'Published',
        short: 'Live',
        dot: 'bg-emerald-500',
        chip: 'bg-emerald-50 text-emerald-700',
      }
    case 'PENDING_REVIEW':
      return {
        key: 'pending',
        label: 'Awaiting review',
        short: 'In review',
        dot: 'bg-secondary-container',
        chip: 'bg-secondary-fixed text-on-secondary-fixed',
      }
    case 'DRAFT':
      return {
        key: 'draft',
        label: 'Draft',
        short: 'Draft',
        dot: 'bg-slate-400',
        chip: 'bg-surface-container text-on-surface-variant',
      }
    case 'SUSPENDED':
      return {
        key: 'suspended',
        label: 'Suspended',
        short: 'Suspended',
        dot: 'bg-error',
        chip: 'bg-error-container text-error',
      }
    default:
      return {
        key: 'other',
        label: 'Unknown state',
        short: 'Unknown',
        dot: 'bg-outline',
        chip: 'bg-surface-container text-on-surface-variant',
      }
  }
}

/** A unit needs attention when it is not live, or the backend reports it unavailable. */
export function needsAttention(car: OwnerVehicle): boolean {
  const state = listingStateOf(car)
  return state.key !== 'published' || car.isAvailable === false
}

export function unitPlate(car: OwnerVehicle): string {
  return car.licensePlate || car.unitLabel || `Unit #${car.id}`
}

/** Keep the first occurrence of each booking id across merged queues. */
export function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

/** Local wall-clock label, e.g. `14:45`. */
export function timeOf(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function dayOf(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Relative distance to a timestamp. Returns `null` until the client clock is
 * known so server and client markup stay identical during hydration.
 */
export function relativeLabel(
  iso: string | null | undefined,
  now: number | null,
): { text: string; overdue: boolean } | null {
  if (!iso || now == null) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  const diffMinutes = Math.round((target - now) / 60000)
  const abs = Math.abs(diffMinutes)
  if (abs < 1) return { text: 'now', overdue: diffMinutes < 0 }
  const unit =
    abs >= 1440
      ? `${Math.round(abs / 1440)}d`
      : abs >= 60
        ? `${Math.floor(abs / 60)}h${abs % 60 ? ` ${abs % 60}m` : ''}`
        : `${abs}m`
  return diffMinutes < 0
    ? { text: `overdue by ${unit}`, overdue: true }
    : { text: `in ${unit}`, overdue: false }
}

export function percent(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
}
