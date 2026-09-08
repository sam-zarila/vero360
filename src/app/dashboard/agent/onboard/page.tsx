'use client'

import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { USER_ROLES, type UserRole } from '@/lib/users'
import { MERCHANT_SERVICES } from '@/lib/agent-registrations'
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
  password: string
  confirmPassword: string
  businessName: string
  businessAddress: string
  merchantService: string
  isVerified: boolean
  geoLat: string
  geoLng: string
  geoLabel: string
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  role: 'customer',
  password: '',
  confirmPassword: '',
  businessName: '',
  businessAddress: '',
  merchantService: 'marketplace',
  isVerified: false,
  geoLat: '',
  geoLng: '',
  geoLabel: '',
})

type OtpChannel = 'email' | 'phone'

export default function AgentOnboardPage() {
  const { isAgent } = usePanelSession()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [useTempPassword, setUseTempPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [otpBusy, setOtpBusy] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tempPasswordShown, setTempPasswordShown] = useState('')
  const [authEmail, setAuthEmail] = useState('')

  const [otpChannel, setOtpChannel] = useState<OtpChannel | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [verificationTicket, setVerificationTicket] = useState('')

  const canSendEmailOtp = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    [form.email],
  )
  const canSendPhoneOtp = useMemo(
    () => form.phone.replace(/\D/g, '').length >= 9,
    [form.phone],
  )

  function resetOtp() {
    setOtpChannel(null)
    setOtpCode('')
    setOtpSentTo('')
    setOtpSent(false)
    setVerificationTicket('')
  }

  function updateContact(
    patch: Partial<Pick<FormState, 'email' | 'phone'>>,
  ) {
    setForm(f => ({ ...f, ...patch }))
    // Contact changed — force re-verify.
    resetOtp()
  }

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

  async function sendOtp(channel: OtpChannel) {
    setOtpBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/agent-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          email: form.email || null,
          phone: form.phone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send code')
      setOtpChannel(channel)
      setOtpSent(true)
      setOtpSentTo(data.destination || (channel === 'email' ? form.email : form.phone))
      setVerificationTicket('')
      setOtpCode('')
      setNotice(data.message || `Code sent via ${channel}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code')
    } finally {
      setOtpBusy(false)
    }
  }

  async function verifyOtp() {
    if (!otpChannel) return
    setOtpBusy(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/agent-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: otpChannel,
          email: form.email || null,
          phone: form.phone || null,
          code: otpCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      setVerificationTicket(data.verificationTicket || '')
      setNotice(`Verified via ${otpChannel}. You can create the account now.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
      setVerificationTicket('')
    } finally {
      setOtpBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    setTempPasswordShown('')
    setAuthEmail('')

    if (!form.email.trim() && !form.phone.trim()) {
      setError('Email or phone number is required (same as app signup)')
      setBusy(false)
      return
    }
    if (!verificationTicket) {
      setError('Send and verify OTP (SMS or email) before creating the account')
      setBusy(false)
      return
    }
    if (!useTempPassword) {
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match')
        setBusy(false)
        return
      }
    }

    try {
      const res = await adminFetch('/api/admin/agent-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          role: form.role,
          password: useTempPassword ? null : form.password,
          generateTempPassword: useTempPassword,
          verificationTicket,
          preferredVerification: otpChannel,
          businessName: form.role === 'merchant' ? form.businessName : null,
          businessAddress: form.role === 'merchant' ? form.businessAddress : null,
          merchantService: form.role === 'merchant' ? form.merchantService : null,
          isVerified: form.isVerified || Boolean(verificationTicket),
          geo: {
            lat: form.geoLat ? Number(form.geoLat) : null,
            lng: form.geoLng ? Number(form.geoLng) : null,
            label: form.geoLabel || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      const name = data.registration?.name || form.name
      if (data.usedTempPassword && data.tempPassword) {
        setNotice(`Account created for ${name}. Share the temporary password below securely.`)
        setTempPasswordShown(data.tempPassword)
      } else {
        setNotice(
          `Account created for ${name}. They can sign in on the Vero360 app with the password they entered.`,
        )
      }
      setAuthEmail(data.authEmail || '')
      setForm(emptyForm())
      setUseTempPassword(false)
      setShowPassword(false)
      resetOtp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const otpVerified = Boolean(verificationTicket)

  return (
    <div>
      {!isAgent ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="agents"
        title="Onboard user"
        description="Verify email or phone with OTP (same as the app), then create a real account."
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
          {tempPasswordShown ? (
            <div style={{ marginTop: 8, fontWeight: 700 }}>
              Temporary password: <code>{tempPasswordShown}</code>
              {authEmail ? (
                <>
                  {' '}
                  · Sign-in email: <code>{authEmail}</code>
                </>
              ) : null}
            </div>
          ) : authEmail && notice && !error ? (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600 }}>
              Sign-in email: <code>{authEmail}</code>
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
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={e => updateContact({ email: e.target.value })}
              placeholder="user@email.com"
              style={input}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={e => updateContact({ phone: e.target.value })}
              placeholder="08/09xxxxxxxx or +265…"
              style={input}
            />
          </Field>

          {form.role === 'merchant' ? (
            <>
              <Field label="Merchant service *">
                <select
                  required
                  value={form.merchantService}
                  onChange={e => setForm(f => ({ ...f, merchantService: e.target.value }))}
                  style={input}
                >
                  {MERCHANT_SERVICES.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Business name *">
                <input
                  required
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  style={input}
                />
              </Field>
              <Field label="Business address">
                <input
                  value={form.businessAddress}
                  onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))}
                  style={input}
                />
              </Field>
            </>
          ) : null}

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

        {/* OTP verification */}
        <section
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 14,
            border: otpVerified ? '1px solid #6EE7B7' : '1px solid #FDBA74',
            background: otpVerified ? '#ECFDF5' : '#FFF7ED',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: otpVerified ? '#047857' : '#C2410C',
            }}
          >
            {otpVerified ? 'Contact verified' : 'Verify with OTP *'}
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Same as the app: send a code by email or SMS, then enter it before creating the account.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              disabled={!canSendEmailOtp || otpBusy || otpVerified}
              onClick={() => void sendOtp('email')}
              style={btnGhost}
            >
              {otpBusy && otpChannel === 'email' ? 'Sending…' : 'Send email OTP'}
            </button>
            <button
              type="button"
              disabled={!canSendPhoneOtp || otpBusy || otpVerified}
              onClick={() => void sendOtp('phone')}
              style={btnGhost}
            >
              {otpBusy && otpChannel === 'phone' ? 'Sending…' : 'Send SMS OTP'}
            </button>
            {otpVerified ? (
              <button type="button" onClick={resetOtp} style={btnGhost}>
                Change contact / re-verify
              </button>
            ) : null}
          </div>

          {otpSent && !otpVerified ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <Field label={`Code sent to ${otpSentTo}`}>
                <input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="Enter 4–6 digit code"
                  inputMode="numeric"
                  style={input}
                />
              </Field>
              <button
                type="button"
                disabled={!otpCode.trim() || otpBusy}
                onClick={() => void verifyOtp()}
                style={btnPrimary}
              >
                {otpBusy ? 'Verifying…' : 'Verify code'}
              </button>
              <button
                type="button"
                disabled={otpBusy || !otpChannel}
                onClick={() => otpChannel && void sendOtp(otpChannel)}
                style={btnGhost}
              >
                Resend code
              </button>
            </div>
          ) : null}
        </section>

        {/* Password handoff */}
        <section
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 14,
            border: '1px solid #A7F3D0',
            background: '#ECFDF5',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: '#047857' }}>
            {useTempPassword ? 'Temporary password' : 'Hand device to the user'}
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#065F46', lineHeight: 1.45 }}>
            {useTempPassword
              ? 'Use only when the user is not present. A one-time password will be shown after create.'
              : 'They should type a password only they know (min 8 characters).'}
          </p>

          <label
            style={{
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
              fontWeight: 700,
              fontSize: 13,
              color: '#065F46',
              marginBottom: 12,
            }}
          >
            <input
              type="checkbox"
              checked={useTempPassword}
              onChange={e => {
                const on = e.target.checked
                setUseTempPassword(on)
                if (on) setForm(f => ({ ...f, password: '', confirmPassword: '' }))
              }}
            />
            User not present — generate temporary password
          </label>

          {!useTempPassword ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <Field label="User password *">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  style={input}
                />
              </Field>
              <Field label="Confirm password *">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  style={input}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    gap: 8,
                    alignItems: 'center',
                    fontWeight: 600,
                    fontSize: 13,
                    paddingBottom: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={e => setShowPassword(e.target.checked)}
                  />
                  Show password (user only)
                </label>
              </div>
            </div>
          ) : null}
        </section>

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
          <button type="submit" style={btnPrimary} disabled={busy || !otpVerified}>
            {busy ? 'Creating account…' : `Create ${form.role} account`}
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
