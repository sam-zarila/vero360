'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  MARKETING_TASK_CATEGORIES,
  MARKETING_TASK_PLATFORMS,
  MARKETING_TASK_STATUSES,
  buildMarketingProgress,
  formatMarketingDate,
  marketingTaskStatusLabel,
  marketingTaskStatusTone,
  toDateInputValue,
  type MarketingTask,
  type MarketingTaskCounts,
  type MarketingTaskStatus,
} from '@/lib/marketing-tasks'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { useConfirm, useConfirmDelete } from '../../ConfirmDialog'
import { MarketingSubNav } from '../MarketingSubNav'

const SECTION = DASHBOARD_SECTION_MAP.marketing

type MarketerOption = { id: string; email: string; displayName: string }

const emptyCounts: MarketingTaskCounts = {
  all: 0,
  not_started: 0,
  in_progress: 0,
  completed: 0,
  on_hold: 0,
  overdue: 0,
}

type FormState = {
  datePosted: string
  marketerUid: string
  taskTitle: string
  category: string
  platform: string
  dueDate: string
  status: MarketingTaskStatus
  dateCompleted: string
  notes: string
}

function emptyForm(defaults?: Partial<FormState>): FormState {
  const today = toDateInputValue(new Date().toISOString())
  return {
    datePosted: today,
    marketerUid: '',
    taskTitle: '',
    category: 'Post',
    platform: 'Instagram',
    dueDate: '',
    status: 'not_started',
    dateCompleted: '',
    notes: '',
    ...defaults,
  }
}

function formFromTask(t: MarketingTask): FormState {
  return {
    datePosted: toDateInputValue(t.datePosted || t.dateAssigned),
    marketerUid: t.marketerUid,
    taskTitle: t.taskTitle,
    category: t.category || 'Other',
    platform: t.platform || 'Other',
    dueDate: toDateInputValue(t.dueDate),
    status: t.status,
    dateCompleted: toDateInputValue(t.dateCompleted),
    notes: t.notes || '',
  }
}

export default function MarketingTasksPage() {
  const { me, isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [items, setItems] = useState<MarketingTask[]>([])
  const [counts, setCounts] = useState<MarketingTaskCounts>(emptyCounts)
  const [marketers, setMarketers] = useState<MarketerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [statusFilter, setStatusFilter] = useState<'all' | MarketingTaskStatus | 'overdue'>('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [marketerFilter, setMarketerFilter] = useState('all')
  const [q, setQ] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketing-tasks', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)

      if (isFullAdmin) {
        const mRes = await adminFetch('/api/admin/marketers', { cache: 'no-store' })
        const mData = await mRes.json()
        if (mRes.ok) setMarketers(mData.marketers || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [isFullAdmin])

  useEffect(() => {
    if (sessionLoading) return
    void load()
  }, [sessionLoading, load])

  const filtered = useMemo(() => {
    const now = Date.now()
    return items.filter(t => {
      if (statusFilter === 'overdue') {
        if (
          t.status === 'completed' ||
          !t.dueDate ||
          Number.isNaN(new Date(t.dueDate).getTime()) ||
          new Date(t.dueDate).getTime() >= now
        ) {
          return false
        }
      } else if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false
      }
      if (platformFilter !== 'all' && t.platform !== platformFilter) return false
      if (marketerFilter !== 'all' && t.marketerUid !== marketerFilter) return false
      const query = q.trim().toLowerCase()
      if (!query) return true
      return [
        t.taskTitle,
        t.category,
        t.platform,
        t.marketerName,
        t.marketerEmail,
        t.notes,
        t.approvedBy,
        marketingTaskStatusLabel(t.status),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [items, statusFilter, platformFilter, marketerFilter, q])

  const openCreate = () => {
    setEditingId(null)
    setForm(
      emptyForm({
        marketerUid: isMarketer ? me?.id || '' : '',
      }),
    )
    setFormOpen(true)
    setNotice('')
    setError('')
  }

  const openEdit = (t: MarketingTask) => {
    setEditingId(t.id)
    setForm(formFromTask(t))
    setFormOpen(true)
    setNotice('')
    setError('')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const selected = marketers.find(m => m.id === form.marketerUid)
      const payload = {
        datePosted: form.datePosted || null,
        dateAssigned: form.datePosted || null,
        marketerUid: isMarketer ? me?.id : form.marketerUid,
        marketerName: isMarketer
          ? me?.displayName
          : selected?.displayName || undefined,
        marketerEmail: isMarketer ? me?.email : selected?.email || undefined,
        taskTitle: form.taskTitle.trim(),
        category: form.category,
        platform: form.platform,
        dueDate: isMarketer ? null : form.dueDate || null,
        status: form.status,
        dateCompleted: isMarketer
          ? form.status === 'completed'
            ? form.datePosted || toDateInputValue(new Date().toISOString())
            : null
          : form.dateCompleted || null,
        notes: form.notes,
      }

      const res = await adminFetch(
        editingId
          ? `/api/admin/marketing-tasks/${editingId}`
          : '/api/admin/marketing-tasks',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setNotice(editingId ? 'Task updated' : 'Task created')
      setFormOpen(false)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const approve = async (t: MarketingTask) => {
    const ok = await confirm({
      title: 'Approve this task?',
      message: `Mark “${t.taskTitle}” as approved by you.`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/marketing-tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approve failed')
      setNotice(data.message || 'Task approved')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (t: MarketingTask) => {
    if (!(await confirmDelete(t.taskTitle, 'This permanently deletes the marketing task.'))) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/marketing-tasks/${t.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Task deleted')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const setStatusQuick = async (t: MarketingTask, status: MarketingTaskStatus) => {
    setBusy(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/marketing-tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          dateCompleted:
            status === 'completed'
              ? toDateInputValue(t.datePosted || t.dateAssigned || new Date().toISOString())
              : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`Status → ${marketingTaskStatusLabel(status)}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const progress = useMemo(() => buildMarketingProgress(items, 14), [items])

  const statusTabs: Array<{ id: typeof statusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'not_started', label: 'Not Started', count: counts.not_started },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'on_hold', label: 'On Hold', count: counts.on_hold },
    { id: 'overdue', label: 'Overdue', count: counts.overdue },
  ]

  const maxBar = Math.max(3, ...progress.days.map(d => d.count))
  const ratingColor =
    progress.rating === 'good' ? '#047857' : progress.rating === 'ok' ? '#B45309' : '#B91C1C'
  const ratingBg =
    progress.rating === 'good' ? '#ECFDF5' : progress.rating === 'ok' ? '#FFFBEB' : '#FEF2F2'

  return (
    <div>
      {!isMarketer ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="marketing"
        title="Marketing tasks"
        description={
          isMarketer
            ? 'Record content you posted and track your daily progress.'
            : 'Assign content tasks to marketers and track posting progress.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={openCreate} style={primaryBtn} disabled={busy}>
              + {isMarketer ? 'Add my task' : 'Assign task'}
            </button>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading || busy} />
          </div>
        }
      />

      <MarketingSubNav />

      {(error || notice) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error || notice}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Metric label="All tasks" value={String(counts.all)} />
        <Metric label="In progress" value={String(counts.in_progress)} />
        <Metric label="Completed" value={String(counts.completed)} />
        <Metric label="Posted (14d)" value={String(progress.totalPosted)} />
      </div>

      {/* My progress graph */}
      <section style={{ ...card, marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              {isMarketer ? 'My progress' : 'Posting progress'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
              Activity by date posted · last 14 days
            </p>
          </div>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              background: ratingBg,
              color: ratingColor,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Score {progress.score} · {progress.ratingLabel}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            height: 160,
            padding: '8px 4px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {progress.days.map(day => {
            const heightPct = Math.max(day.count === 0 ? 6 : (day.count / maxBar) * 100, 6)
            const barColor =
              day.tone === 'good' ? '#16A34A' : day.tone === 'ok' ? '#F59E0B' : '#EF4444'
            return (
              <div
                key={day.key}
                title={`${day.label}: ${day.count} posted`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '100%',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)' }}>
                  {day.count || ''}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 28,
                    height: `${heightPct}%`,
                    minHeight: day.count === 0 ? 8 : 16,
                    borderRadius: '8px 8px 4px 4px',
                    background: barColor,
                    opacity: day.count === 0 ? 0.35 : 1,
                    transition: 'height 0.25s ease',
                  }}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {progress.days.map(day => (
            <div
              key={`${day.key}-lbl`}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'center',
                fontSize: 9,
                color: 'var(--text-3)',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {day.label}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            marginTop: 14,
            fontSize: 12,
            color: 'var(--text-3)',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#16A34A' }} />
            Good (2+ posts)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F59E0B' }} />
            Okay (1 post)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#EF4444' }} />
            Poor (none)
          </span>
          <span style={{ marginLeft: 'auto' }}>
            {progress.activeDays}/14 active days · avg {progress.avgPerDay}/day
          </span>
        </div>
      </section>

      {formOpen ? (
        <form onSubmit={e => void save(e)} style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>
            {editingId ? 'Edit task' : isMarketer ? 'Add my task' : 'Assign a task'}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Date posted *">
              <input
                type="date"
                required
                value={form.datePosted}
                onChange={e => setForm(f => ({ ...f, datePosted: e.target.value }))}
                style={input}
              />
            </Field>
            {isFullAdmin ? (
              <Field label="Marketer *">
                <select
                  required
                  value={form.marketerUid}
                  onChange={e => setForm(f => ({ ...f, marketerUid: e.target.value }))}
                  style={input}
                >
                  <option value="">Select marketer…</option>
                  {marketers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.email})
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Marketer">
                <input
                  value={me?.displayName || me?.email || ''}
                  disabled
                  style={{ ...input, opacity: 0.75 }}
                />
              </Field>
            )}
            <Field label="Task / content piece *">
              <input
                required
                value={form.taskTitle}
                onChange={e => setForm(f => ({ ...f, taskTitle: e.target.value }))}
                placeholder="Instagram carousel — Vero Ride…"
                style={input}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={input}
              >
                {MARKETING_TASK_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                style={input}
              >
                {MARKETING_TASK_PLATFORMS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    status: e.target.value as MarketingTaskStatus,
                  }))
                }
                style={input}
              >
                {MARKETING_TASK_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {marketingTaskStatusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            {!isMarketer ? (
              <>
                <Field label="Due date">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    style={input}
                  />
                </Field>
                <Field label="Date completed">
                  <input
                    type="date"
                    value={form.dateCompleted}
                    onChange={e => setForm(f => ({ ...f, dateCompleted: e.target.value }))}
                    style={input}
                  />
                </Field>
              </>
            ) : null}
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Draft shared for review…"
              style={{ ...input, marginTop: 12, resize: 'vertical' }}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create task'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
              }}
              style={outlineBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {statusTabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              style={{
                ...chip,
                background: statusFilter === t.id ? '#FFF7ED' : '#fff',
                borderColor: statusFilter === t.id ? '#F97316' : 'var(--border)',
                color: statusFilter === t.id ? '#C2410C' : 'var(--text-2)',
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isFullAdmin
              ? '1fr minmax(140px, 180px) minmax(140px, 200px)'
              : '1fr minmax(140px, 180px)',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search task, marketer, notes…"
            style={input}
          />
          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            style={input}
          >
            <option value="all">All platforms</option>
            {MARKETING_TASK_PLATFORMS.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {isFullAdmin ? (
            <select
              value={marketerFilter}
              onChange={e => setMarketerFilter(e.target.value)}
              style={input}
            >
              <option value="all">All marketers</option>
              {marketers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {loading && items.length === 0 ? (
          <p style={{ color: 'var(--muted)', marginTop: 12 }}>Loading tasks…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No tasks in this view"
            hint={
              isMarketer
                ? 'Add a task to start tracking your content work.'
                : 'Create a marketer account under Admins, then assign tasks here.'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMarketer ? 720 : 980 }}>
              <thead>
                <tr>
                  {(isMarketer
                    ? [
                        'Date Posted',
                        'Task / Content Piece',
                        'Category',
                        'Platform',
                        'Status',
                        'Approved By',
                        'Notes',
                        'Actions',
                      ]
                    : [
                        'Date Posted',
                        'Marketer',
                        'Task / Content Piece',
                        'Category',
                        'Platform',
                        'Due Date',
                        'Status',
                        'Date Completed',
                        'Approved By',
                        'Notes',
                        'Actions',
                      ]
                  ).map(h => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const tone = marketingTaskStatusTone(t.status)
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>{formatMarketingDate(t.datePosted || t.dateAssigned)}</td>
                      {!isMarketer ? (
                        <td style={td}>
                          <div style={{ fontWeight: 700 }}>{t.marketerName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.marketerEmail}</div>
                        </td>
                      ) : null}
                      <td style={{ ...td, fontWeight: 650, maxWidth: 220 }}>{t.taskTitle}</td>
                      <td style={td}>{t.category}</td>
                      <td style={td}>{t.platform}</td>
                      {!isMarketer ? (
                        <td style={td}>{formatMarketingDate(t.dueDate)}</td>
                      ) : null}
                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            background: tone.bg,
                            color: tone.color,
                            border: `1px solid ${tone.border}`,
                          }}
                        >
                          {marketingTaskStatusLabel(t.status)}
                        </span>
                      </td>
                      {!isMarketer ? (
                        <td style={td}>{formatMarketingDate(t.dateCompleted)}</td>
                      ) : null}
                      <td style={td}>{t.approvedBy || '—'}</td>
                      <td style={{ ...td, maxWidth: 180, color: 'var(--text-2)' }}>
                        {t.notes || '—'}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEdit(t)}
                            style={smallBtn}
                          >
                            Edit
                          </button>
                          {t.status !== 'in_progress' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void setStatusQuick(t, 'in_progress')}
                              style={smallBtn}
                            >
                              In progress
                            </button>
                          ) : null}
                          {t.status !== 'completed' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void setStatusQuick(t, 'completed')}
                              style={smallBtn}
                            >
                              Complete
                            </button>
                          ) : null}
                          {isFullAdmin && !t.approvedBy ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void approve(t)}
                              style={{ ...smallBtn, color: '#047857', borderColor: '#A7F3D0' }}
                            >
                              Approve
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void remove(t)}
                            style={{ ...smallBtn, color: '#BE123C', borderColor: '#FECDD3' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, letterSpacing: '-0.3px' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  )
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 22,
  boxShadow: 'var(--shadow-sm)',
}

const input: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
}

const chip: CSSProperties = {
  border: '1px solid',
  borderRadius: 999,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  background: '#fff',
}

const badge: CSSProperties = {
  borderRadius: 999,
  padding: '3px 9px',
  fontSize: 11,
  fontWeight: 800,
  display: 'inline-block',
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '9px 12px',
  background: '#F97316',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
}

const outlineBtn: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '9px 12px',
  background: '#fff',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const smallBtn: CSSProperties = {
  ...outlineBtn,
  padding: '5px 8px',
  fontSize: 11,
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: '#fff',
  background: '#9A3412',
  padding: '10px 12px',
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '12px',
  fontSize: 13,
  verticalAlign: 'top',
  background: '#FFFBEB',
}
