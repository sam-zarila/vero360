'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
}

export function FrontDeskContactPanel() {
  const [whatsApp, setWhatsApp] = useState('+265992695612')
  const [phone, setPhone] = useState('+265992695612')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/vero-ride/front-desk', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load front desk number')
      setWhatsApp(data.config?.frontDeskWhatsApp || '+265992695612')
      setPhone(data.config?.frontDeskPhone || data.config?.frontDeskWhatsApp || '+265992695612')
      setUpdatedAt(data.config?.updatedAt || null)
      setUpdatedBy(data.config?.updatedByEmail || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load front desk number')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/vero-ride/front-desk', {
        method: 'PUT',
        body: JSON.stringify({
          frontDeskWhatsApp: whatsApp.trim(),
          frontDeskPhone: phone.trim() || whatsApp.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setWhatsApp(data.config?.frontDeskWhatsApp || whatsApp)
      setPhone(data.config?.frontDeskPhone || phone)
      setUpdatedAt(data.config?.updatedAt || null)
      setUpdatedBy(data.config?.updatedByEmail || null)
      setNotice(data.message || 'Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 18,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Front desk WhatsApp</h2>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
        Shown when no driver is nearby. Passengers are sent to in-app Help Center first, with
        WhatsApp as a backup. The app message is: “I did not find a ride in [location].”
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)', marginTop: 14 }}>Loading…</p>
      ) : (
        <form onSubmit={onSave} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 480 }}>
          <label>
            <span style={labelStyle}>WhatsApp number</span>
            <input
              style={inputStyle}
              value={whatsApp}
              onChange={e => setWhatsApp(e.target.value)}
              placeholder="+265992695612"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </label>
          <label>
            <span style={labelStyle}>Call number (optional, defaults to WhatsApp)</span>
            <input
              style={inputStyle}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+265992695612"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          {error ? (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: '#FEF2F2',
                color: '#B91C1C',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
          {notice ? (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: '#ECFDF5',
                color: '#166534',
                fontSize: 13,
              }}
            >
              {notice}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                border: 0,
                borderRadius: 10,
                padding: '10px 16px',
                background: '#EA580C',
                color: '#fff',
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save number'}
            </button>
            {updatedAt ? (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Last saved {new Date(updatedAt).toLocaleString()}
                {updatedBy ? ` · ${updatedBy}` : ''}
              </span>
            ) : null}
          </div>
        </form>
      )}
    </section>
  )
}
