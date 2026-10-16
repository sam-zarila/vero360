'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signInWithEmailAndPassword, signOut, type AuthError } from 'firebase/auth'
import Logo from '@/app/components/landing/Logo'
import { auth } from '@/lib/firebase'

function firebaseSignInMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as AuthError).code)
      : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password, or not an active admin.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account is disabled in Firebase.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled.'
    default:
      return 'Invalid email or password, or not an active admin.'
  }
}

export default function PanelSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bootstrap, setBootstrap] = useState(false)
  const [bootstrapChecked, setBootstrapChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/admin/admins/me', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setBootstrap(Boolean(data?.needsBootstrap))
      } catch {
        if (!cancelled) setBootstrap(false)
      } finally {
        if (!cancelled) setBootstrapChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goToDashboard = () => {
    const next = new URLSearchParams(window.location.search).get('next') || ''
    const safe =
      next.startsWith('/dashboard') && !next.startsWith('//') ? next : '/dashboard'
    window.location.href = safe
  }

  const createFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create admin')
      }

      setNotice(data.message || 'Super admin created. Signing you in…')
      setBootstrap(false)

      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      await cred.user.getIdToken()
      goToDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const token = await cred.user.getIdToken()

      const res = await fetch('/api/admin/admins/me', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({})) as {
        needsBootstrap?: boolean
        authenticated?: boolean
        error?: string
        me?: { status?: string; role?: string }
      }

      if (data?.needsBootstrap) {
        // No admins in Firestore yet — let them through to create the first one.
        window.location.href = '/dashboard/admins'
        return
      }

      if (!res.ok || !data?.authenticated) {
        await signOut(auth)
        const apiError = typeof data?.error === 'string' ? data.error.trim() : ''
        throw new Error(
          apiError ||
            (res.status >= 500
              ? `Server error (${res.status}). `
              : 'Invalid email or password, or not an active admin.'),
        )
      }

      if (data?.me?.status === 'suspended') {
        await signOut(auth)
        throw new Error('This admin account is suspended.')
      }

      if (data?.me?.role === 'marketer') {
        const next = new URLSearchParams(window.location.search).get('next') || ''
        const safe =
          next.startsWith('/dashboard/marketing') ||
          next.startsWith('/dashboard/marketing-tasks') ||
          next.startsWith('/dashboard/settings')
            ? next
            : '/dashboard/marketing/tasks'
        window.location.href = safe
        return
      }

      if (data?.me?.role === 'agent') {
        const next = new URLSearchParams(window.location.search).get('next') || ''
        const safe =
          next.startsWith('/dashboard/agent') || next.startsWith('/dashboard/settings')
            ? next
            : '/dashboard/agent'
        window.location.href = safe
        return
      }

      goToDashboard()
    } catch (err) {
      const message =
        err instanceof Error && err.message && !err.message.includes('Firebase')
          ? err.message
          : firebaseSignInMessage(err)
      setError(message)
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 40%, #FFF7ED 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', marginBottom: 24 }}>
            <Logo height={72} />
          </Link>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginBottom: 8,
              fontFamily: 'var(--font-display)',
              color: 'var(--text)',
            }}
          >
            {bootstrap ? 'Create super admin' : 'Admin sign in'}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {bootstrap
              ? 'No admin accounts exist yet. Create the first super admin below.'
              : 'Only admins can sign in.'}
          </p>
        </div>

        {!bootstrapChecked ? (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
        ) : bootstrap ? (
          <form
            onSubmit={createFirstAdmin}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div>
              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@vero360.app"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="displayName" style={labelStyle}>
                Display name (optional)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Admin"
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Creating…' : 'Create super admin'}
            </button>

            {notice ? <p style={noticeStyle}>{notice}</p> : null}
            {error ? <p style={errorStyle}>{error}</p> : null}
          </form>
        ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: 8,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@vero360.app"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                fontSize: 15,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 16px',
                  borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 8,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.5 3.5M9.9 5.2A10.5 10.5 0 0121 12a10.6 10.6 0 01-3.2 4.6M6.5 6.6A10.5 10.5 0 003 12a10.6 10.6 0 009 6.5c1.1 0 2.2-.2 3.2-.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '14px 24px',
              borderRadius: 12,
              width: '100%',
              border: 'none',
              background: loading ? 'var(--primary-light)' : 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error ? (
            <p style={errorStyle}>{error}</p>
          ) : null}
        </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14 }}>
          <Link href="/" style={{ color: 'var(--text-3)', fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-2)',
  marginBottom: 8,
} as const

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  fontSize: 15,
  outline: 'none',
} as const

function submitStyle(loading: boolean) {
  return {
    marginTop: 8,
    padding: '14px 24px',
    borderRadius: 12,
    width: '100%',
    border: 'none',
    background: loading ? 'var(--primary-light)' : 'var(--primary)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.8 : 1,
  } as const
}

const errorStyle = {
  marginTop: 4,
  fontSize: 14,
  color: 'var(--error)',
  textAlign: 'center',
  lineHeight: 1.5,
} as const

const noticeStyle = {
  marginTop: 4,
  fontSize: 14,
  color: '#047857',
  textAlign: 'center',
  lineHeight: 1.5,
} as const
