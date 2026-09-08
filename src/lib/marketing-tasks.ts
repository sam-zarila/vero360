/** Marketing task tracker — Firestore `marketing_tasks`. */

export const MARKETING_TASKS_COLLECTION = 'marketing_tasks'

export type MarketingTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'on_hold'

export type MarketingTask = {
  id: string
  /** When the content/task was posted (primary date for marketers). */
  datePosted: string | null
  dateAssigned: string | null
  marketerUid: string
  marketerName: string
  marketerEmail: string
  taskTitle: string
  category: string
  platform: string
  dueDate: string | null
  status: MarketingTaskStatus
  dateCompleted: string | null
  approvedBy: string | null
  notes: string
  createdByUid: string | null
  createdByRole: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type MarketingTaskCounts = {
  all: number
  not_started: number
  in_progress: number
  completed: number
  on_hold: number
  overdue: number
}

export type CreateMarketingTaskInput = {
  datePosted?: string | null
  dateAssigned?: string | null
  marketerUid: string
  marketerName?: string
  marketerEmail?: string
  taskTitle: string
  category?: string
  platform?: string
  dueDate?: string | null
  status?: MarketingTaskStatus | string
  dateCompleted?: string | null
  approvedBy?: string | null
  notes?: string
}

export type UpdateMarketingTaskInput = Partial<CreateMarketingTaskInput>

export const MARKETING_TASK_STATUSES: MarketingTaskStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'on_hold',
]

export const MARKETING_TASK_CATEGORIES = [
  'Post',
  'Reel',
  'Story',
  'Carousel',
  'Video',
  'Ad',
  'Email',
  'Other',
] as const

export const MARKETING_TASK_PLATFORMS = [
  'Instagram',
  'TikTok',
  'Facebook',
  'X',
  'YouTube',
  'LinkedIn',
  'WhatsApp',
  'Website',
  'Other',
] as const

export function normalizeMarketingTaskStatus(raw: unknown): MarketingTaskStatus {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (v === 'in_progress' || v === 'inprogress' || v === 'progress') return 'in_progress'
  if (v === 'completed' || v === 'complete' || v === 'done') return 'completed'
  if (v === 'on_hold' || v === 'onhold' || v === 'hold' || v === 'paused') return 'on_hold'
  return 'not_started'
}

export function marketingTaskStatusLabel(status: MarketingTaskStatus) {
  switch (status) {
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'on_hold':
      return 'On Hold'
    default:
      return 'Not Started'
  }
}

export function marketingTaskStatusTone(status: MarketingTaskStatus) {
  switch (status) {
    case 'in_progress':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'completed':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'on_hold':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    default:
      return { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' }
  }
}

export function countMarketingTasks(tasks: MarketingTask[]): MarketingTaskCounts {
  const now = Date.now()
  let not_started = 0
  let in_progress = 0
  let completed = 0
  let on_hold = 0
  let overdue = 0

  for (const t of tasks) {
    if (t.status === 'not_started') not_started += 1
    else if (t.status === 'in_progress') in_progress += 1
    else if (t.status === 'completed') completed += 1
    else if (t.status === 'on_hold') on_hold += 1

    if (
      t.status !== 'completed' &&
      t.dueDate &&
      !Number.isNaN(new Date(t.dueDate).getTime()) &&
      new Date(t.dueDate).getTime() < now
    ) {
      overdue += 1
    }
  }

  return {
    all: tasks.length,
    not_started,
    in_progress,
    completed,
    on_hold,
    overdue,
  }
}

/** YYYY-MM-DD for date inputs / sheet-style dates. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
    return m?.[1] || ''
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function formatMarketingDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export type MarketingProgressDay = {
  key: string
  label: string
  count: number
  /** green = good activity, amber = ok, red = poor/no posts */
  tone: 'good' | 'ok' | 'poor'
}

export type MarketingProgressSummary = {
  days: MarketingProgressDay[]
  totalPosted: number
  activeDays: number
  trackedDays: number
  avgPerDay: number
  score: number
  rating: 'good' | 'ok' | 'poor'
  ratingLabel: string
  /** Progress scoring begins on this calendar day (inclusive). */
  trackingStarted: boolean
  trackingStartDate: string
}

/** Official start of marketing progress / KPI live scoring. */
export const MARKETING_PROGRESS_START_DATE = '2026-09-14'

export function isMarketingLiveTrackingActive(now = new Date()) {
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  const start = new Date(`${MARKETING_PROGRESS_START_DATE}T12:00:00`)
  return today.getTime() >= start.getTime()
}

/** Demo KPI is available until live tracking begins (vanishes on 14 Sep 2026). */
export function isMarketingKpiDemoAvailable(now = new Date()) {
  return !isMarketingLiveTrackingActive(now)
}

/**
 * Daily posting activity ending today, for up to `dayCount` days.
 * Live mode never scores earlier than MARKETING_PROGRESS_START_DATE.
 * Demo mode ignores the live start date so sample data can show now.
 */
export function buildMarketingProgress(
  tasks: MarketingTask[],
  dayCount = 14,
  options?: { demo?: boolean },
): MarketingProgressSummary {
  const demo = Boolean(options?.demo)
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const start = new Date(`${MARKETING_PROGRESS_START_DATE}T12:00:00`)
  const trackingStarted = demo || today.getTime() >= start.getTime()

  const counts = new Map<string, number>()
  for (const t of tasks) {
    const raw = t.datePosted || t.dateAssigned || t.createdAt
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    d.setHours(12, 0, 0, 0)
    if (!demo && d.getTime() < start.getTime()) continue
    const key = toDateInputValue(d.toISOString())
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const days: MarketingProgressDay[] = []
  let totalPosted = 0
  let activeDays = 0

  if (!trackingStarted) {
    return {
      days: [],
      totalPosted: 0,
      activeDays: 0,
      trackedDays: 0,
      avgPerDay: 0,
      score: 0,
      rating: 'ok',
      ratingLabel: `Tracking starts ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}`,
      trackingStarted: false,
      trackingStartDate: MARKETING_PROGRESS_START_DATE,
    }
  }

  const earliest = new Date(today)
  earliest.setDate(today.getDate() - (dayCount - 1))
  const windowStart =
    !demo && earliest.getTime() < start.getTime() ? new Date(start) : earliest

  const trackedDays = Math.max(
    0,
    Math.round((today.getTime() - windowStart.getTime()) / 86400000) + 1,
  )

  for (let i = trackedDays - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (!demo && d.getTime() < start.getTime()) continue
    const key = toDateInputValue(d.toISOString())
    const count = counts.get(key) || 0
    totalPosted += count
    if (count > 0) activeDays += 1
    const tone: MarketingProgressDay['tone'] =
      count >= 2 ? 'good' : count === 1 ? 'ok' : 'poor'
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      count,
      tone,
    })
  }

  const denom = days.length || 1
  const avgPerDay = totalPosted / denom
  const consistency = (activeDays / denom) * 55
  const volume = Math.min(avgPerDay / 1.5, 1) * 45
  const score = Math.round(Math.min(100, consistency + volume))

  let rating: MarketingProgressSummary['rating'] = 'poor'
  let ratingLabel = 'Poor performance — post more consistently'
  if (score >= 65) {
    rating = 'good'
    ratingLabel = 'Working well — strong posting activity'
  } else if (score >= 35) {
    rating = 'ok'
    ratingLabel = 'Okay — keep posting to improve'
  }

  return {
    days,
    totalPosted,
    activeDays,
    trackedDays: days.length,
    avgPerDay: Math.round(avgPerDay * 10) / 10,
    score,
    rating,
    ratingLabel,
    trackingStarted: true,
    trackingStartDate: MARKETING_PROGRESS_START_DATE,
  }
}

export type MarketerKpiRow = {
  marketerUid: string
  marketerName: string
  marketerEmail: string
  taskCount: number
  completedCount: number
  inProgressCount: number
  progress: MarketingProgressSummary
}

/** Per-marketer KPI board for admin team tracker. */
export function buildMarketerKpiBoard(
  tasks: MarketingTask[],
  dayCount = 14,
  options?: { demo?: boolean },
): MarketerKpiRow[] {
  const byUid = new Map<string, MarketingTask[]>()
  for (const t of tasks) {
    const uid = t.marketerUid || 'unknown'
    const list = byUid.get(uid)
    if (list) list.push(t)
    else byUid.set(uid, [t])
  }

  const rows: MarketerKpiRow[] = []
  for (const [uid, list] of byUid) {
    const sample = list[0]
    rows.push({
      marketerUid: uid,
      marketerName: sample?.marketerName || 'Unknown marketer',
      marketerEmail: sample?.marketerEmail || '',
      taskCount: list.length,
      completedCount: list.filter(t => t.status === 'completed').length,
      inProgressCount: list.filter(t => t.status === 'in_progress').length,
      progress: buildMarketingProgress(list, dayCount, options),
    })
  }

  rows.sort((a, b) => b.progress.score - a.progress.score || a.marketerName.localeCompare(b.marketerName))
  return rows
}

/** Sample tasks so admins can preview KPI UI before live tracking starts. */
export function buildDemoMarketingTasks(dayCount = 14): MarketingTask[] {
  const marketers = [
    {
      uid: 'demo-marketer-a',
      name: 'Amina Phiri',
      email: 'amina.demo@vero360.com',
      pattern: [2, 1, 3, 0, 2, 2, 1, 2, 0, 3, 2, 1, 2, 2],
    },
    {
      uid: 'demo-marketer-b',
      name: 'Chikondi Banda',
      email: 'chikondi.demo@vero360.com',
      pattern: [1, 0, 1, 0, 2, 0, 1, 1, 0, 0, 1, 0, 1, 0],
    },
    {
      uid: 'demo-marketer-c',
      name: 'Thoko Mwale',
      email: 'thoko.demo@vero360.com',
      pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    },
  ] as const

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const tasks: MarketingTask[] = []
  let n = 0

  for (const m of marketers) {
    for (let i = dayCount - 1; i >= 0; i -= 1) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dayKey = toDateInputValue(d.toISOString())
      const posts = m.pattern[(dayCount - 1 - i) % m.pattern.length] ?? 0
      for (let p = 0; p < posts; p += 1) {
        n += 1
        tasks.push({
          id: `demo-task-${n}`,
          datePosted: `${dayKey}T12:00:00.000Z`,
          dateAssigned: `${dayKey}T09:00:00.000Z`,
          marketerUid: m.uid,
          marketerName: m.name,
          marketerEmail: m.email,
          taskTitle: `Demo post ${n}`,
          category: p % 2 === 0 ? 'Post' : 'Reel',
          platform: p % 2 === 0 ? 'Instagram' : 'TikTok',
          dueDate: null,
          status: 'completed',
          dateCompleted: `${dayKey}T18:00:00.000Z`,
          approvedBy: null,
          notes: 'Demo sample',
          createdByUid: null,
          createdByRole: null,
          createdAt: `${dayKey}T09:00:00.000Z`,
          updatedAt: `${dayKey}T18:00:00.000Z`,
        })
      }
    }
  }

  return tasks
}

