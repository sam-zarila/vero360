'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'
import type { SellBanner } from '@/lib/sell-banners'

type FormState = {
  title: string
  body: string
  ctaLabel: string
  active: boolean
}

const emptyForm = (): FormState => ({
  title: 'Start selling on Vero360',
  body: 'Open the Vero360 app, create a merchant account, list your products, and reach customers across Malawi.',
  ctaLabel: 'Sell now',
  active: true,
})

export default function SellBannersAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<SellBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/sell-banners', { cache: 'no-store' })
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

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
  }

  function startEdit(item: SellBanner) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      body: item.body,
      ctaLabel: item.ctaLabel || 'Sell now',
      active: item.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        const res = await adminFetch(`/api/admin/sell-banners/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Update failed')
        setNotice('Banner updated. Active banners show on the website and app home.')
      } else {
        const res = await adminFetch('/api/admin/sell-banners', {
          method: 'POST',
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Create failed')
        setNotice('Banner created. Sell now opens merchant signup.')
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: SellBanner) {
    try {
      const res = await adminFetch(`/api/admin/sell-banners/${item.id}`, {
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

  async function remove(item: SellBanner) {
    if (!(await confirmDelete(item.title, 'Remove this sell banner?'))) return
    try {
      const res = await adminFetch(`/api/admin/sell-banners/${item.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      if (editingId === item.id) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 16px 48px' }}>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="sell-banners"
        description="Create free-form banners that tell people how to start selling. Sell now always opens merchant signup."
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
        Active banners appear on the website homepage and the Vero360 app home.
        The CTA always goes to merchant signup (<code>/get-started?role=merchant</code> on web;
        merchant register in the app).
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: '#B91C1C', fontWeight: 700 }}>{error}</div>
      ) : null}
      {notice ? (
        <div style={{ marginTop: 12, color: '#047857', fontWeight: 700 }}>{notice}</div>
      ) : null}

      <form onSubmit={onSubmit} style={formCard}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
          {editingId ? 'Edit sell banner' : 'Create sell banner'}
        </h3>
        <label style={labelStyle}>
          Title *
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            maxLength={100}
            placeholder="e.g. Start selling on Vero360"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          How to start selling
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={4}
            maxLength={400}
            placeholder="Explain the steps in your own words…"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
          />
        </label>
        <label style={labelStyle}>
          Button label
          <input
            value={form.ctaLabel}
            onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))}
            maxLength={40}
            placeholder="Sell now"
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
            color: '#374151',
          }}
        >
          <input
            type="checkbox"
            checked={form.active}
            onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
          />
          Active (visible on homepage)
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving} style={primaryBtn}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create banner'}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} style={outlineBtn}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <h2 style={{ marginTop: 28, fontSize: 17, fontWeight: 900 }}>Your banners</h2>
      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6B7280' }}>No sell banners yet. Create one above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {items.map(item => (
            <article key={item.id} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {item.title}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: item.active ? '#ECFDF5' : '#F3F4F6',
                        color: item.active ? '#047857' : '#6B7280',
                      }}
                    >
                      {item.active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {item.body ? (
                    <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#4B5563', lineHeight: 1.45 }}>
                      {item.body}
                    </p>
                  ) : null}
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#9A3412', fontWeight: 700 }}>
                    CTA: {item.ctaLabel || 'Sell now'} → merchant signup
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" onClick={() => startEdit(item)} style={outlineBtn}>
                  Edit
                </button>
                <button type="button" onClick={() => void toggleActive(item)} style={outlineBtn}>
                  {item.active ? 'Hide' : 'Show'}
                </button>
                <button type="button" onClick={() => void remove(item)} style={dangerBtn}>
                  Delete
                </button>
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
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#fff',
  display: 'grid',
  gap: 14,
}

const itemCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  background: '#fff',
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
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  fontSize: 14,
  fontWeight: 500,
  boxSizing: 'border-box',
}

const primaryBtn: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#EA580C',
  color: '#fff',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

const outlineBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const dangerBtn: CSSProperties = {
  ...outlineBtn,
  borderColor: '#FECACA',
  color: '#B91C1C',
  background: '#FEF2F2',
}
