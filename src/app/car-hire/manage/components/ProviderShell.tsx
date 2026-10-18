'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type AuthError,
  type User,
} from 'firebase/auth'
import Logo from '@/app/components/landing/Logo'
import { auth } from '@/lib/firebase'

export type ProviderAuthValue = {
  user: User | null
  loading: boolean
  signOutNow: () => Promise<void>
}

const ProviderAuthContext = createContext<ProviderAuthValue | null>(null)

export function useProviderAuth(): ProviderAuthValue {
  const value = useContext(ProviderAuthContext)
  if (!value) {
    throw new Error('useProviderAuth must be used inside ProviderShell')
  }
  return value
}

const NAV = [
  { label: 'Overview', href: '/car-hire/manage' },
  { label: 'Fleet', href: '/car-hire/manage/fleet' },
  { label: 'Bookings', href: '/car-hire/manage/bookings' },
  { label: 'Calendar', href: '/car-hire/manage/calendar' },
  { label: 'Performance', href: '/car-hire/manage/performance' },
  { label: 'Team', href: '/car-hire/manage/team' },
]

function firebaseSignInMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as AuthError).code) : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-disabled':
      return 'This Vero360 account is disabled.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled for this project.'
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Could not sign in. Check your details and try again.'
  }
}

export default function ProviderShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      setUser(nextUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signOutNow = useCallback(async () => {
    await signOut(auth)
  }, [])

  return (
    <ProviderAuthContext.Provider value={{ user, loading, signOutNow }}>
      {loading ? (
        <div style={centerScreen}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-3)' }}>
            Checking your Vero360 session…
          </p>
        </div>
      ) : user ? (
        <ProviderChrome user={user} onSignOut={signOutNow}>
          {children}
        </ProviderChrome>
      ) : (
        <ProviderSignIn />
      )}
    </ProviderAuthContext.Provider>
  )
}

function ProviderChrome({
  user,
  onSignOut,
  children,
}: {
  user: User
  onSignOut: () => Promise<void>
  children: ReactNode
}) {
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <Link href="/" aria-label="Vero360 home" style={{ display: 'inline-flex' }}>
              <Logo height={38} />
            </Link>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: '#C2410C',
                }}
              >
                Car hire provider
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-2)',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={user.email || undefined}
              >
                {user.email || 'Signed-in Vero360 account'}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span style={workspacePill}>Vehicle provider workspace</span>
            <Link href="/car-hire" style={headerLink}>
              Public catalogue
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              style={signOutButton}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>

        <nav
          aria-label="Provider workspace"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
          }}
        >
          {NAV.map(item => {
            const active =
              item.href === '/car-hire/manage'
                ? pathname === item.href
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '11px 13px',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? '#C2410C' : 'var(--text-3)',
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 70px' }}>
        {children}
      </main>
    </div>
  )
}

function ProviderSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(firebaseSignInMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 22,
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 42%, #FFF7ED 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          borderRadius: 24,
          padding: '34px 28px',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-flex', marginBottom: 16 }}>
            <Logo height={62} />
          </Link>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, letterSpacing: '-0.4px' }}>
            Provider workspace sign in
          </h1>
          <p style={{ margin: '9px 0 0', fontSize: 13, lineHeight: 1.65, color: 'var(--text-3)' }}>
            Use your existing Vero360 account. This workspace is for approved car-hire owners,
            businesses, and invited staff.
          </p>
        </div>

        <div
          style={{
            padding: '11px 13px',
            borderRadius: 12,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
            marginBottom: 18,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#9A3412' }}>
            Provider applications are made in the Vero360 app. This is not the Vero360 staff admin
            panel. Ask the operator owner to invite your Vero360 email if your account is not set
            up yet.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="provider-email" style={labelStyle}>
              Email
            </label>
            <input
              id="provider-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="provider-password" style={labelStyle}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="provider-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 54 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: 7,
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={submitButton}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#B91C1C', textAlign: 'center' }}>
              {error}
            </p>
          ) : null}
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 12 }}>
          <Link href="/car-hire" style={{ color: 'var(--text-3)', fontWeight: 700 }}>
            ← Back to car hire
          </Link>
        </p>
      </div>
    </div>
  )
}

const centerScreen = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--surface)',
  padding: 24,
} as const

const workspacePill = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  color: '#9A3412',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
} as const

const headerLink = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 11px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  background: '#fff',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
} as const

const signOutButton = {
  padding: '8px 11px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text-2)',
  marginBottom: 6,
} as const

const inputStyle = {
  width: '100%',
  padding: '12px 13px',
  borderRadius: 11,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--text)',
  outline: 'none',
} as const

const submitButton = {
  marginTop: 4,
  padding: '13px 18px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const
