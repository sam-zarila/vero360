'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'

type CrawlItem = {
  id: string
  title: string
  subtitle: string
  linkType: string
  linkId: string
  active: boolean
  sortOrder: number
  createdAt: string | null
  createdByEmail: string | null
}

const LINK_OPTIONS = [
  { value: 'none', label: 'No link' },
  { value: 'promotions', label: 'Promotions page' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'marketplace', label: 'Marketplace' },
]

export default function HomeCrawlAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<CrawlItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [linkType, setLinkType] = useState('none')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/homepage-crawls', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/homepage-crawls', {
        method: 'POST',
        body: JSON.stringify({ title, subtitle, linkType, active: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setTitle('')
      setSubtitle('')
      setLinkType('none')
      setNotice('Crawl message posted — it will scroll on the app home under search.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: CrawlItem) {
    try {
      const res = await adminFetch(`/api/admin/homepage-crawls/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function remove(item: CrawlItem) {
    if (!(await confirmDelete(item.title, 'Remove this crawl message from the app home ticker?'))) {
      return
    }
    try {
      const res = await adminFetch(`/api/admin/homepage-crawls/${item.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 16px 48px' }}>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="home-crawl"
        description="Messages that scroll under “what are you looking for?” on the Vero360 app home. Promotions are included automatically."
        actions={<DashboardRefreshButton onClick={() => void load()} />}
      />

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          color: '#9A3412',
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        Keep titles short (one line). They scroll continuously right → left on the homepage.
      </div>

      <form onSubmit={onCreate} style={formCard}>
        <label style={labelStyle}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            placeholder="e.g. Free delivery this weekend"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Supporting text (optional)
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={120}
            placeholder="Short detail shown after the title"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          When tapped
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value)}
            style={inputStyle}
          >
            {LINK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {error ? <div style={{ color: '#B91C1C', fontWeight: 700 }}>{error}</div> : null}
        {notice ? <div style={{ color: '#047857', fontWeight: 700 }}>{notice}</div> : null}
        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? 'Posting…' : 'Post crawl message'}
        </button>
      </form>

      <h2 style={{ marginTop: 28, fontSize: 17, fontWeight: 900 }}>Active & draft crawls</h2>
      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6B7280' }}>No crawl messages yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{item.title}</div>
                  {item.subtitle ? (
                    <div style={{ marginTop: 4, color: '#4B5563', fontSize: 13.5 }}>
                      {item.subtitle}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
                    {item.linkType} · {item.active ? 'Active' : 'Hidden'}
                    {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button type="button" onClick={() => void toggleActive(item)} style={ghostBtn}>
                    {item.active ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" onClick={() => void remove(item)} style={dangerBtn}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

const formCard: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 18,
  background: '#fff',
  border: '1px solid #E5E7EB',
  display: 'grid',
  gap: 12,
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
  background: '#F9FAFB',
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '13px 16px',
  background: '#FF8A00',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostBtn: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '8px 10px',
  background: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const dangerBtn: CSSProperties = {
  ...ghostBtn,
  color: '#BE123C',
  borderColor: '#FECDD3',
}

const itemCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 14,
}
