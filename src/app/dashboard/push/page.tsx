'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'

type PushItem = {
  id: string
  title: string
  body: string
  type: string
  badgeRoute: string
  target: string
  sent: boolean
  createdAt: string | null
  sentAt: string | null
  createdByEmail: string
}

type OpenTarget = 'notifications' | 'quick_promotions' | 'quick_post_arrival' | 'marketplace'

const OPEN_OPTIONS: { value: OpenTarget; label: string }[] = [
  { value: 'notifications', label: 'In-app Notifications page' },
  { value: 'quick_promotions', label: 'Promotions' },
  { value: 'quick_post_arrival', label: "Today's arrivals" },
  { value: 'marketplace', label: 'Marketplace' },
]

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function AdminPushPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [badgeRoute, setBadgeRoute] = useState<OpenTarget>('notifications')
  const [confirmSend, setConfirmSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [items, setItems] = useState<PushItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/push', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load history')
      }
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!title.trim() || !body.trim()) {
      setError('Title and message are required.')
      return
    }
    if (!confirmSend) {
      setError('Tick the confirmation box before sending to everyone.')
      return
    }

    setSending(true)
    try {
      const res = await adminFetch('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          badgeRoute,
          target: 'all',
          type: 'admin_broadcast',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Send failed')
      }
      setNotice(
        data?.message ||
          'Push queued — everyone with the app will receive it shortly.',
      )
      setTitle('')
      setBody('')
      setConfirmSend(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 16px 48px' }}>
      <DashboardBackLink />
      <DashboardPageHeader
        title="Push notification"
        subtitle="Send a push to everyone who has the Vero360 app installed and notifications enabled."
        actions={<DashboardRefreshButton onClick={() => void load()} />}
      />

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 16,
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          color: '#9A3412',
          fontSize: 13.5,
          lineHeight: 1.45,
          fontWeight: 600,
        }}
      >
        This reaches <strong>all app users</strong> via Firebase (topic{' '}
        <code>vero360_all</code>). Use it for important updates — not for spam.
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          marginTop: 18,
          padding: 20,
          borderRadius: 18,
          background: '#fff',
          border: '1px solid #E5E7EB',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          display: 'grid',
          gap: 14,
        }}
      >
        <label style={labelStyle}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. New marketplace feature"
            style={inputStyle}
            required
          />
        </label>

        <label style={labelStyle}>
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Short message users will see on their phone…"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
            required
          />
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
            {body.length}/500
          </span>
        </label>

        <label style={labelStyle}>
          When tapped, open
          <select
            value={badgeRoute}
            onChange={(e) => setBadgeRoute(e.target.value as OpenTarget)}
            style={inputStyle}
          >
            {OPEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
            color: '#1F2937',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={confirmSend}
            onChange={(e) => setConfirmSend(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16 }}
          />
          <span>
            I confirm this push should go to <strong>everyone</strong> with the
            Vero360 app.
          </span>
        </label>

        {error ? (
          <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 13.5 }}>
            {error}
          </div>
        ) : null}
        {notice ? (
          <div style={{ color: '#047857', fontWeight: 700, fontSize: 13.5 }}>
            {notice}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={sending}
          style={{
            marginTop: 4,
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            background: sending ? '#FDBA74' : '#FF8A00',
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            cursor: sending ? 'wait' : 'pointer',
          }}
        >
          {sending ? 'Sending…' : 'Send push to everyone'}
        </button>
      </form>

      <h2
        style={{
          marginTop: 32,
          marginBottom: 12,
          fontSize: 17,
          fontWeight: 900,
          color: '#111827',
        }}
      >
        Recent pushes
      </h2>

      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6B7280' }}>No broadcasts yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: '#111827' }}>
                    {item.title || '(no title)'}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: '#4B5563',
                      fontSize: 13.5,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.body}
                  </div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: item.sent ? '#ECFDF5' : '#FFF7ED',
                    color: item.sent ? '#047857' : '#C2410C',
                  }}
                >
                  {item.sent ? 'Sent' : 'Queued'}
                </span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: '#6B7280',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span>{formatWhen(item.createdAt)}</span>
                {item.createdByEmail ? <span>· {item.createdByEmail}</span> : null}
                {item.type ? <span>· {item.type}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #D1D5DB',
  padding: '11px 12px',
  fontSize: 14,
  fontWeight: 500,
  color: '#111827',
  background: '#F9FAFB',
  outline: 'none',
}
