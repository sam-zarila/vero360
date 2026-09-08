/** Marketing task tracker — Firestore `marketing_tasks`. */

export const MARKETING_TASKS_COLLECTION = 'marketing_tasks'

export type MarketingTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'on_hold'

export type MarketingTask = {
  id: string
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
