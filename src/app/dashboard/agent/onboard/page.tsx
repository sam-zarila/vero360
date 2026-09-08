'use client'

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { USER_ROLES, type UserRole } from '@/lib/users'
import {
  DashboardPageHeader,
  DashboardBackLink,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { AgentSubNav } from '../AgentSubNav'

type FormState = {
  name: string
  email: string
  phone: string
  role: UserRole
  businessName: string
  isVerified: boolean
  password: string
  geoLat: string
  geoLng: string
  geoLabel: string
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  role: 'customer',
  businessName: '',
  isVerified: false,
  password: '',
  geoLat: '',
  geoLng: '',
  geoLabel: '',
})

export default function AgentOnboardPage() {
  const { isAgent } = usePanelSession()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  async function captureGeo() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser')
      return
    }
    setGeoBusy(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          geoLat: String(pos.coords.latitude),
          geoLng: String(pos.coords.longitude),
          geoLabel: f.geoLabel || 'Current location',
        }))
        setGeoBusy(false)
      },
      () => {
        setError('Could not read location — enter it manually')
        setGeoBusy(false)
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    setTempPassword('')
    try {
      const res = await adminFetch('/api/admin/agent-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          businessName: form.businessName || null,
          isVerified: form.isVerified,
          password: form.password || null,
          geo: {
            lat: form.geoLat ? Number(form.geoLat) : null,
            lng: form.geoLng ? Number(form.geoLng) : null,
            label: form.geoLabel || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setNotice(`Registered ${data.registration?.name || form.name} as ${form.role}`)
      setTempPassword(data.tempPassword || '')
      setForm(emptyForm())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {!isAgent ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="agents"
        title="Onboard user"
        description="Register a customer, merchant, or driver. Capture email, phone, verification, and geo location."
      />

      <AgentSubNav />

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
          {tempPassword ? (
            <div style={{ marginTop: 8, fontWeight: 700 }}>
              Temporary password: <code>{tempPassword}</code> — share securely with the user.
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={e => void submit(e)} style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {USER_ROLES.map(role => (
            <button
              key={role}
              type="button"
              onClick={() => setForm(f => ({ ...f, role }))}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                border: form.role === role ? '1px solid #6EE7B7' : '1px solid var(--border)',
                background: form.role === role ? '#ECFDF5' : 'var(--surface)',
                color: form.role === role ? '#047857' : 'var(--text-2)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <Field label="Full name *">
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={input}
            />
          </Field>
          <Field label="Email *">
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={input}
            />
          </Field>
          <Field label="Phone *">
            <input
              required
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+265…"
              style={input}
            />
          </Field>
          {form.role === 'merchant' ? (
            <Field label="Business name *">
              <input
                required
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                style={input}
              />
            </Field>
          ) : null}
          <Field label="Temp password (optional)">
            <input
              type="text"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Auto-generated if empty"
              style={input}
            />
          </Field>
          <Field label="Location label">
            <input
              value={form.geoLabel}
              onChange={e => setForm(f => ({ ...f, geoLabel: e.target.value }))}
              placeholder="Lilongwe Area 14"
              style={input}
            />
          </Field>
          <Field label="Latitude">
            <input
              value={form.geoLat}
              onChange={e => setForm(f => ({ ...f, geoLat: e.target.value }))}
              style={input}
            />
          </Field>
          <Field label="Longitude">
            <input
              value={form.geoLng}
              onChange={e => setForm(f => ({ ...f, geoLng: e.target.value }))}
              style={input}
            />
          </Field>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 16,
            alignItems: 'center',
          }}
        >
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={form.isVerified}
              onChange={e => setForm(f => ({ ...f, isVerified: e.target.checked }))}
            />
            Mark as verified
          </label>
          <button type="button" onClick={() => void captureGeo()} style={btnGhost} disabled={geoBusy}>
            {geoBusy ? 'Getting location…' : 'Use my location'}
          </button>
          <button type="submit" style={btnPrimary} disabled={busy}>
            {busy ? 'Registering…' : `Register ${form.role}`}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

const card: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const input: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  background: '#fff',
}

const btnPrimary: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#047857',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
}

const btnGhost: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}
