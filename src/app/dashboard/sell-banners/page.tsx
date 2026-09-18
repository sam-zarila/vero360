'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Image from 'next/image'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'
import { resolveSellBannerImage, type SellBanner } from '@/lib/sell-banners'

type FormState = {
  title: string
  body: string
  ctaLabel: string
  imageUrl: string
  imageFile: File | null
  active: boolean
}

const emptyForm = (): FormState => ({
  title: 'Start selling on Vero360',
  body: 'Open the Vero360 app, create a merchant account, list your products, and reach customers across Malawi.',
  ctaLabel: 'Sell now',
  imageUrl: '',
  imageFile: null,
  active: true,
})

export default function SellBannersAdminPage() {
  const confirmDelete = useConfirmDelete()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<SellBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clearImage, setClearImage] = useState(false)

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

  const previewUrl = useMemo(() => {
    if (form.imageFile) return URL.createObjectURL(form.imageFile)
    if (clearImage) return ''
    return resolveSellBannerImage(form.imageUrl) || ''
  }, [form.imageFile, form.imageUrl, clearImage])

  useEffect(() => {
    if (!form.imageFile || !previewUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [form.imageFile, previewUrl])

  function resetForm() {
    setEditingId(null)
    setClearImage(false)
    setForm(emptyForm())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startEdit(item: SellBanner) {
    setEditingId(item.id)
    setClearImage(false)
    setForm({
      title: item.title,
      body: item.body,
      ctaLabel: item.ctaLabel || 'Sell now',
      imageUrl: item.imageUrl || '',
      imageFile: null,
      active: item.active,
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const useMultipart = Boolean(form.imageFile)

      if (editingId) {
        if (useMultipart) {
          const body = new FormData()
          body.set('title', form.title)
          body.set('body', form.body)
          body.set('ctaLabel', form.ctaLabel || 'Sell now')
          body.set('active', form.active ? 'true' : 'false')
          if (form.imageFile) body.set('image', form.imageFile)
          const res = await adminFetch(`/api/admin/sell-banners/${editingId}`, {
            method: 'PATCH',
            body,
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Update failed')
        } else {
          const res = await adminFetch(`/api/admin/sell-banners/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: form.title,
              body: form.body,
              ctaLabel: form.ctaLabel || 'Sell now',
              active: form.active,
              imageUrl: clearImage ? '' : form.imageUrl.trim(),
              clearImage,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Update failed')
        }
        setNotice('Banner updated. Active banners show on the website and app home.')
      } else if (useMultipart) {
        const body = new FormData()
        body.set('title', form.title)
        body.set('body', form.body)
        body.set('ctaLabel', form.ctaLabel || 'Sell now')
        body.set('active', form.active ? 'true' : 'false')
        if (form.imageUrl.trim()) body.set('imageUrl', form.imageUrl.trim())
        if (form.imageFile) body.set('image', form.imageFile)
        const res = await adminFetch('/api/admin/sell-banners', {
          method: 'POST',
          body,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Create failed')
        setNotice('Banner created. Sell now opens merchant signup.')
      } else {
        const res = await adminFetch('/api/admin/sell-banners', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title,
            body: form.body,
            ctaLabel: form.ctaLabel || 'Sell now',
            active: form.active,
            imageUrl: form.imageUrl.trim() || null,
          }),
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
        Add a photo via image URL or the gallery picker. Sell now always opens merchant signup.
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

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Banner photo</div>
          <label style={labelStyle}>
            Image URL
            <input
              value={form.imageUrl}
              onChange={e => {
                setClearImage(false)
                setForm(f => ({ ...f, imageUrl: e.target.value, imageFile: null }))
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              type="url"
              placeholder="https://…"
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0] || null
                setClearImage(false)
                setForm(f => ({ ...f, imageFile: file, imageUrl: file ? '' : f.imageUrl }))
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={outlineBtn}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
                  <path d="M21 16l-5.5-5.5L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Choose from gallery
              </span>
            </button>
            {(previewUrl || form.imageUrl || form.imageFile) && !clearImage ? (
              <button
                type="button"
                onClick={() => {
                  setClearImage(true)
                  setForm(f => ({ ...f, imageUrl: '', imageFile: null }))
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                style={dangerBtn}
              >
                Remove photo
              </button>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#6B7280', lineHeight: 1.4 }}>
            Optional. Paste a link or pick a JPEG, PNG, WebP, or GIF (max 8MB). Gallery upload
            overrides the URL.
          </p>
          {previewUrl ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 320,
                aspectRatio: '16 / 10',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
                background: '#F9FAFB',
              }}
            >
              <Image
                src={previewUrl}
                alt="Banner preview"
                fill
                unoptimized={previewUrl.startsWith('blob:')}
                style={{ objectFit: 'cover' }}
              />
            </div>
          ) : null}
        </div>

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
          {items.map(item => {
            const thumb = resolveSellBannerImage(item.imageUrl)
            return (
              <article key={item.id} style={itemCard}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {thumb ? (
                    <div
                      style={{
                        position: 'relative',
                        width: 72,
                        height: 56,
                        borderRadius: 10,
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#F3F4F6',
                      }}
                    >
                      <Image src={thumb} alt="" fill style={{ objectFit: 'cover' }} />
                    </div>
                  ) : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
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
                      {item.imageUrl ? ' · photo attached' : ''}
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
            )
          })}
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
