'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  formatAnnouncementPostedAt,
  resolveAnnouncementImage,
  type Announcement,
} from '@/lib/announcements'
import { useConfirmDelete } from '../ConfirmDialog'

function toLocalInputValue(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInputValue(value: string) {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type FormState = {
  title: string
  description: string
  postedAt: string
  active: boolean
  imageUrl: string
  imageFile: File | null
}

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  postedAt: toLocalInputValue(),
  active: true,
  imageUrl: '',
  imageFile: null,
})

export default function AnnouncementsAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (form.imageFile) return URL.createObjectURL(form.imageFile)
    return resolveAnnouncementImage(form.imageUrl) || ''
  }, [form.imageFile, form.imageUrl])

  useEffect(() => {
    if (!form.imageFile || !previewUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [form.imageFile, previewUrl])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/announcements', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load announcements')
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
  }

  const startEdit = (item: Announcement) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description,
      postedAt: toLocalInputValue(item.postedAt),
      active: item.active,
      imageUrl: item.imageUrl || '',
      imageFile: null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.set('title', form.title.trim())
      body.set('description', form.description.trim())
      body.set('active', form.active ? 'true' : 'false')
      const postedIso = fromLocalInputValue(form.postedAt)
      if (postedIso) body.set('postedAt', postedIso)
      if (form.imageUrl.trim()) body.set('imageUrl', form.imageUrl.trim())
      if (form.imageFile) body.set('image', form.imageFile)

      const url = editingId
        ? `/api/admin/announcements/${editingId}`
        : '/api/admin/announcements'
      const res = await adminFetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        body,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setNotice(editingId ? 'Announcement updated' : 'Announcement published')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Announcement) => {
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/announcements/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setItems(prev => prev.map(x => (x.id === item.id ? { ...x, active: !item.active } : x)))
      setNotice(item.active ? 'Hidden from website' : 'Shown on website')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const remove = async (item: Announcement) => {
    if (!(await confirmDelete(item.title, 'This permanently removes the announcement.'))) return
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/announcements/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Announcement deleted')
      if (editingId === item.id) resetForm()
      setItems(prev => prev.filter(x => x.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 900, letterSpacing: '-0.4px', marginBottom: 6 }}>
          Announcements
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0 }}>
          Post website announcements with a picture, description, and posted date. They appear on the homepage after the stats bar.
        </p>
      </div>

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

      <form
        onSubmit={e => void submit(e)}
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 24,
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {editingId ? 'Edit announcement' : 'New announcement'}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '8px 14px',
                borderRadius: 100,
                border: '1px solid var(--border)',
                background: '#fff',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Title</span>
          <input
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Launch week update"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Description</span>
          <textarea
            required
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What should visitors know?"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }}
          />
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
          className="announce-form-grid"
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Posted date & time</span>
            <input
              type="datetime-local"
              required
              value={form.postedAt}
              onChange={e => setForm(f => ({ ...f, postedAt: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Visibility</span>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              Show on website
            </label>
          </label>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Picture</span>
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0] || null
              setForm(f => ({ ...f, imageFile: file }))
            }}
          />
          <input
            value={form.imageUrl}
            onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value, imageFile: null }))}
            placeholder="Or paste an image URL"
            style={inputStyle}
          />
          {previewUrl ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 420,
                height: 220,
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: '#f3f4f6',
              }}
            >
              <Image src={previewUrl} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            justifySelf: 'start',
            padding: '12px 20px',
            borderRadius: 100,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish announcement'}
        </button>
      </form>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          minHeight: 280,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Published</h2>
          <button
            type="button"
            onClick={() => void load()}
            style={{
              padding: '8px 14px',
              borderRadius: 100,
              border: '1px solid var(--border)',
              background: '#fff',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading announcements…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>No announcements yet. Publish one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map(item => {
              const img = resolveAnnouncementImage(item.imageUrl)
              return (
                <article
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '112px 1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'center',
                  }}
                  className="announce-row"
                >
                  <div
                    style={{
                      width: 112,
                      height: 84,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      position: 'relative',
                    }}
                  >
                    {img ? (
                      <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--text-4)',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        No image
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.title}</h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 100,
                          background: item.active ? '#ECFDF5' : '#F3F4F6',
                          color: item.active ? '#166534' : '#6B7280',
                        }}
                      >
                        {item.active ? 'Live' : 'Hidden'}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0 0 8px',
                        fontSize: 14,
                        color: 'var(--text-2)',
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.description}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                      Posted {formatAnnouncementPostedAt(item.postedAt)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button type="button" onClick={() => startEdit(item)} style={actionBtn}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void toggleActive(item)} style={actionBtn}>
                      {item.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      style={{ ...actionBtn, color: '#BE123C', borderColor: '#FECDD3' }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style>{`
        @media (max-width: 720px) {
          .announce-form-grid { grid-template-columns: 1fr !important; }
          .announce-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--text)',
}

const actionBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 100,
  border: '1px solid var(--border)',
  background: '#fff',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
