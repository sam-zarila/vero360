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
  latestVersion: string
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
  { value: 'app_update', label: 'App update (open store)' },
]

export default function HomeCrawlAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<CrawlItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingUpdate, setSavingUpdate] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [linkType, setLinkType] = useState('none')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateTitle, setUpdateTitle] = useState('Update available')
  const [updateSubtitle, setUpdateSubtitle] = useState(
    'A new version of Vero360 is ready. Tap Update to install.',
  )

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

  async function onPostUpdate(e: FormEvent) {
    e.preventDefault()
    setSavingUpdate(true)
    setError('')
    setNotice('')
    try {
      const version = updateVersion.trim()
      if (!/^\d+(\.\d+){0,3}$/.test(version)) {
        throw new Error('Enter a version like 1.2.0')
      }
      const res = await adminFetch('/api/admin/homepage-crawls', {
        method: 'POST',
        body: JSON.stringify({
          title: updateTitle.trim() || 'Update available',
          subtitle:
            updateSubtitle.trim() ||
            `Latest version ${version} is ready. Tap Update to install.`,
          linkType: 'app_update',
          latestVersion: version,
          linkId: version,
          active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post update notice')
      setNotice(
        `App update notice posted for v${version}. Users on an older build will see Update on home.`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update')
    } finally {
      setSavingUpdate(false)
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
        Use <strong>App update</strong> below when you publish a new store version — users on older
        builds see an Update button.
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: '#B91C1C', fontWeight: 700 }}>{error}</div>
      ) : null}
      {notice ? (
        <div style={{ marginTop: 12, color: '#047857', fontWeight: 700 }}>{notice}</div>
      ) : null}

      <form onSubmit={onPostUpdate} style={{ ...formCard, borderColor: '#FDBA74', background: '#FFFBEB' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#9A3412' }}>
          Notify users to update the app
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: '#9A3412', lineHeight: 1.45 }}>
          Post after you ship a new build. Only one update notice stays active. The app compares this
          version to the installed build and shows <strong>Update</strong> when needed.
        </p>
        <label style={labelStyle}>
          Latest version *
          <input
            value={updateVersion}
            onChange={e => setUpdateVersion(e.target.value)}
            required
            placeholder="e.g. 1.2.0"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Title
          <input
            value={updateTitle}
            onChange={e => setUpdateTitle(e.target.value)}
            maxLength={80}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Message
          <input
            value={updateSubtitle}
            onChange={e => setUpdateSubtitle(e.target.value)}
            maxLength={160}
            style={inputStyle}
          />
        </label>
        <button type="submit" disabled={savingUpdate} style={primaryBtn}>
          {savingUpdate ? 'Posting…' : 'Post update notice'}
        </button>
      </form>

      <form onSubmit={onCreate} style={formCard}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>General crawl message</h3>
        <label style={labelStyle}>
          Title
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
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
            onChange={e => setSubtitle(e.target.value)}
            maxLength={120}
            placeholder="Short detail shown after the title"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          When tapped
          <select
            value={linkType}
            onChange={e => setLinkType(e.target.value)}
            style={inputStyle}
          >
            {LINK_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
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
          {items.map(item => (
            <article key={item.id} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {item.title}
                    {item.linkType === 'app_update' ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                        }}
                      >
                        App update
                        {item.latestVersion ? ` · v${item.latestVersion}` : ''}
                      </span>
                    ) : null}
                  </div>
                  {item.subtitle ? (
                    <div style={{ marginTop: 4, color: '#4B5563', fontSize: 13.5 }}>
                      {item.subtitle}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
                    {item.linkType}
                    {item.latestVersion ? ` · v${item.latestVersion}` : ''} ·{' '}
                    {item.active ? 'Active' : 'Hidden'}
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
