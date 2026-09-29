'use client'

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { DashboardBackLink } from '@/app/dashboard/DashboardChrome'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

/**
 * Requires the signed-in admin's panel password before showing children.
 * Unlock is in-memory only — leaving/refreshing the page locks again.
 * Same pattern for Finance and Important files.
 */
export function AdminPasswordGate({ title, description, children }: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = auth.currentUser
      if (!user?.email) {
        throw new Error('Sign in again at /panel, then return here.')
      }
      const cred = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, cred)
      setUnlocked(true)
      setPassword('')
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code || '')
          : ''
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'
      ) {
        setError('Incorrect password. Use the same password you sign in with.')
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not verify password.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '8px 16px 48px' }}>
      <DashboardBackLink />
      <div style={card}>
        <div style={lockIcon} aria-hidden>
          Locked
        </div>
        <h1 style={heading}>{title}</h1>
        <p style={body}>
          {description ||
            'Enter your admin panel password to continue. This is the same password you use to sign in.'}
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={label}>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              disabled={busy}
              style={input}
              placeholder="Your /panel sign-in password"
            />
          </label>
          {error ? <div style={errorText}>{error}</div> : null}
          <button type="submit" disabled={busy || !password} style={btn}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

const card: CSSProperties = {
  marginTop: 24,
  padding: 28,
  borderRadius: 20,
  background: '#fff',
  border: '1px solid #E5E7EB',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
  textAlign: 'center',
}

const lockIcon: CSSProperties = {
  display: 'inline-block',
  marginBottom: 12,
  padding: '6px 12px',
  borderRadius: 999,
  background: '#FFF7ED',
  color: '#C2410C',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const heading: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const body: CSSProperties = {
  margin: '0 0 20px',
  fontSize: 14,
  color: '#6B7280',
  lineHeight: 1.5,
}

const label: CSSProperties = {
  display: 'grid',
  gap: 6,
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
}

const input: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #D1D5DB',
  padding: '12px 14px',
  fontSize: 15,
  background: '#F9FAFB',
  fontFamily: 'inherit',
}

const btn: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '13px 16px',
  background: '#FF8A00',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const errorText: CSSProperties = {
  color: '#B91C1C',
  fontWeight: 700,
  fontSize: 13,
  textAlign: 'left',
}
