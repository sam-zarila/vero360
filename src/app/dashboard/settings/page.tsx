'use client'

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { panelAuthHeaders } from '@/lib/panel-client-auth'
import { adminRoleLabel, type PanelAdmin } from '@/lib/admins'

export default function SettingsPage() {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [me, setMe] = useState<PanelAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await fetch('/api/admin/admins/me', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.authenticated) {
        throw new Error(data.error || 'Sign in at /panel to manage your settings.')
      }
      setMe(data.me)
      setDisplayName(data.me?.displayName || '')
    } catch (err) {
      setMe(null)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      setLoading(false)
      setMe(null)
      setError('Sign in at /panel to change your name or password.')
      return
    }
    void load()
  }, [authReady, user, load])

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    setNameBusy(true)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders(true)
      const res = await fetch('/api/admin/admins/me', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update name')
      setMe(data.me)
      setDisplayName(data.me?.displayName || displayName.trim())
      setNotice(data.message || 'Display name updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update name')
    } finally {
      setNameBusy(false)
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordBusy(true)
    setError('')
    setNotice('')
    try {
      if (!user?.email) throw new Error('Sign in required.')
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters.')
      }
      if (newPassword !== confirmPassword) {
        throw new Error('New password and confirmation do not match.')
      }
      if (!currentPassword) {
        throw new Error('Enter your current password to confirm the change.')
      }

      // Confirm identity with current password before server-side update.
      const cred = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, cred)

      const headers = await panelAuthHeaders(true)
      const res = await fetch('/api/admin/admins/me', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update password')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice(data.message || 'Password updated.')
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.')
      } else {
        setError(err instanceof Error ? err.message : 'Could not update password')
      }
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link href="/dashboard" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
        ← Dashboard
      </Link>

      <h1 style={{ margin: '10px 0 6px', fontSize: 26, fontWeight: 700 }}>Settings</h1>
      <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
        Update your admin display name and password.
      </p>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading profile…</p>
      ) : !me ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.5 }}>
            You need an active admin session to change settings.
          </p>
          <Link
            href="/panel"
            style={{ ...btnPrimary, display: 'inline-block', marginTop: 14, textDecoration: 'none' }}
          >
            Sign in at /panel
          </Link>
        </div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Signed in</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{me.email}</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
              {adminRoleLabel(me.role)} · {me.status}
            </div>
          </div>

          <form onSubmit={saveName} style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Display name</h2>
            <Field label="Name">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={input}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <button type="submit" disabled={nameBusy} style={{ ...btnPrimary, marginTop: 14 }}>
              {nameBusy ? 'Saving…' : 'Save name'}
            </button>
          </form>

          <form onSubmit={savePassword} style={card}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Password</h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7280', lineHeight: 1.45 }}>
              Enter your current password, then choose a new one (min 6 characters).
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Current password">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={input}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={input}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={input}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={passwordBusy}
              style={{ ...btnPrimary, marginTop: 14 }}
            >
              {passwordBusy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#6B7280',
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
      : { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
  return (
    <div style={{ ...styles, padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14 }}>
      {children}
    </div>
  )
}

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #E5E7EB',
}

const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 14,
  boxSizing: 'border-box',
}

const btnPrimary: CSSProperties = {
  border: 'none',
  background: '#0F766E',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
