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
import {
  LuArrowUpRight,
  LuCalendarCheck,
  LuCalendarDays,
  LuCarFront,
  LuEye,
  LuEyeOff,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPlus,
  LuRoute,
  LuShieldCheck,
  LuStore,
  LuTrendingUp,
  LuUsers,
  LuX,
} from 'react-icons/lu'
import type { IconType } from 'react-icons'
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

type NavItem = {
  label: string
  href: string
  Icon: IconType
}

const NAV: NavItem[] = [
  { label: 'Overview', href: '/car-hire/manage', Icon: LuLayoutDashboard },
  { label: 'Fleet & units', href: '/car-hire/manage/fleet', Icon: LuCarFront },
  { label: 'Bookings & dispatch', href: '/car-hire/manage/bookings', Icon: LuCalendarCheck },
  { label: 'Dispatch board', href: '/car-hire/manage/dispatch', Icon: LuRoute },
  { label: 'Calendar', href: '/car-hire/manage/calendar', Icon: LuCalendarDays },
  { label: 'Performance', href: '/car-hire/manage/performance', Icon: LuTrendingUp },
  { label: 'Team & branches', href: '/car-hire/manage/team', Icon: LuUsers },
]

const COLLAPSE_KEY = 'vero360.carhire.sidebar.collapsed'

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

function initialsOf(value: string): string {
  const source = value.split('@')[0] || value
  const parts = source.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  if (parts.length === 0) return 'V3'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
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
        <div className="grid min-h-screen place-items-center bg-surface px-6">
          <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-[0_1px_8px_rgba(0,31,63,0.06)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary-container" />
            <p className="text-[13px] font-semibold text-on-surface-variant">
              Checking your Vero360 session…
            </p>
          </div>
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
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore the collapsed preference after mount so SSR markup stays stable.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only preference after hydration
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* private mode — keep the default */
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(value => {
      const next = !value
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const closeMobileNav = useCallback(() => setMobileOpen(false), [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  const accountLabel = user.email || user.displayName || 'Provider account'

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        id="provider-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-outline-variant/50 bg-surface-container-low transition-[width,transform] duration-300 ease-in-out ${
          collapsed ? 'w-72 lg:w-[84px]' : 'w-72'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={`flex h-16 items-center gap-3 ${collapsed ? 'px-3 lg:justify-center lg:px-0' : 'px-5'}`}
          >
            <Link
              href="/car-hire/manage"
              onClick={closeMobileNav}
              className="flex min-w-0 items-center gap-3"
            >
              <span className="shrink-0">
                <Logo height={36} />
              </span>
              <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <span className="block truncate font-heading text-[17px] font-extrabold leading-tight tracking-tight text-primary">
                  Vero360
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
                  Fleet OS
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-lg p-2 text-on-surface-variant hover:bg-surface-container lg:hidden"
              aria-label="Close navigation"
            >
              <LuX className="text-[18px]" aria-hidden />
            </button>
          </div>

          <div className={`pb-3 ${collapsed ? 'px-3 lg:px-2' : 'px-4'}`}>
            <div
              className={`flex items-center justify-between gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 shadow-[0_1px_4px_rgba(0,31,63,0.05)] ${
                collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary-container opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary-container" />
                </span>
                <span
                  className={`text-[11px] font-bold text-on-surface ${collapsed ? 'lg:hidden' : ''}`}
                >
                  Workspace live
                </span>
              </span>
              <span
                className={`text-[11px] font-medium text-on-surface-variant ${collapsed ? 'lg:hidden' : ''}`}
              >
                Provider
              </span>
            </div>
          </div>

          <nav
            aria-label="Provider workspace"
            className={`min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 ${
              collapsed ? 'px-3 lg:px-2' : 'px-4'
            }`}
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
                  onClick={closeMobileNav}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-primary-container font-bold text-on-primary shadow-[0_2px_8px_rgba(0,31,63,0.18)]'
                      : 'font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                >
                  <item.Icon
                    className={`shrink-0 text-[19px] ${active ? 'text-secondary-container' : ''}`}
                    aria-hidden
                  />
                  <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className={`border-t border-outline-variant/40 py-3 ${collapsed ? 'px-3 lg:px-2' : 'px-4'}`}>
          <div
            className={`rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2.5 shadow-[0_1px_4px_rgba(0,31,63,0.05)] ${
              collapsed ? 'lg:flex lg:justify-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                {initialsOf(accountLabel)}
              </span>
              <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <p
                  className="truncate text-[12px] font-bold leading-tight text-on-surface"
                  title={accountLabel}
                >
                  {accountLabel}
                </p>
                <p className="text-[11px] text-on-surface-variant">Provider account</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface px-2 py-1.5 text-[11px] font-bold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-60 ${
                collapsed ? 'lg:hidden' : ''
              }`}
            >
              <LuLogOut className="text-[14px]" aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mt-2 hidden w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface lg:flex"
            aria-expanded={!collapsed}
            aria-controls="provider-sidebar"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <LuPanelLeftOpen className="text-[17px]" aria-hidden />
            ) : (
              <>
                <LuPanelLeftClose className="text-[17px]" aria-hidden />
                <span>Collapse view</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-72'}`}>
        <header
          className={`fixed right-0 top-0 z-40 h-16 border-b border-outline-variant/40 bg-surface/90 backdrop-blur-xl transition-[left] duration-300 ease-in-out ${
            collapsed ? 'left-0 lg:left-[84px]' : 'left-0 lg:left-72'
          }`}
        >
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface lg:hidden"
                aria-label="Open navigation"
                aria-controls="provider-sidebar"
              >
                <LuMenu className="text-[20px]" aria-hidden />
              </button>
              <Link
                href="/car-hire"
                className="group flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 shadow-[0_1px_4px_rgba(0,31,63,0.05)] transition-colors hover:bg-surface-container-low"
              >
                <LuStore className="text-[17px] text-secondary-container" aria-hidden />
                <span className="hidden text-left sm:block">
                  <span className="block text-[10px] leading-none text-on-surface-variant">
                    Public storefront
                  </span>
                  <span className="block text-[12px] font-semibold leading-tight text-on-surface">
                    Vero360 car hire
                  </span>
                </span>
                <LuArrowUpRight
                  className="text-[15px] text-outline transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/car-hire/manage/fleet"
                className="hidden h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-[12px] font-bold text-on-secondary shadow-[0_2px_8px_rgba(255,133,27,0.28)] transition-colors hover:bg-secondary sm:inline-flex"
              >
                <LuPlus className="text-[16px]" aria-hidden />
                Add vehicle
              </Link>
              <Link
                href="/car-hire/manage/dispatch"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-container px-3.5 text-[12px] font-bold text-on-primary shadow-[0_2px_8px_rgba(0,31,63,0.18)] transition-colors hover:bg-primary sm:px-4"
              >
                <LuRoute className="text-[16px]" aria-hidden />
                <span className="hidden sm:inline">Dispatch</span>
              </Link>
              <div className="flex items-center gap-1.5 pl-1 sm:pl-2">
                <Link
                  href="/car-hire/manage/bookings"
                  title="Booking requests"
                  className="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  <LuCalendarCheck className="text-[20px]" aria-hidden />
                </Link>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                  {initialsOf(accountLabel)}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-screen pt-16">
          <div className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
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
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#000613_0%,#001f3f_52%,#964900_100%)] px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl bg-surface-container-lowest p-7 shadow-[0_24px_64px_rgba(0,6,19,0.35)] sm:p-8">
        <div className="mb-6 text-center">
          <Link href="/" className="mb-3 inline-flex" aria-label="Vero360 home">
            <Logo height={58} />
          </Link>
          <p className="font-heading text-[22px] font-extrabold leading-tight tracking-tight text-primary">
            Provider workspace sign in
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">
            Use your existing Vero360 account. This workspace is for approved car-hire owners,
            businesses, and invited staff.
          </p>
        </div>

        <div className="mb-4 flex gap-2.5 rounded-xl border border-secondary-fixed bg-secondary-fixed/40 p-3">
          <LuShieldCheck className="mt-0.5 shrink-0 text-[16px] text-secondary" aria-hidden />
          <p className="text-[11.5px] leading-relaxed text-on-secondary-fixed">
            Provider applications are made in the Vero360 app. This is not the Vero360 staff admin
            panel. Ask the operator owner to invite your Vero360 email if your account is not set up
            yet.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3.5">
          <div>
            <label
              htmlFor="provider-email"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant"
            >
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] text-on-surface outline-none transition-colors focus:border-primary-container"
            />
          </div>
          <div>
            <label
              htmlFor="provider-password"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="provider-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 pr-12 text-[14px] text-on-surface outline-none transition-colors focus:border-primary-container"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                {showPassword ? (
                  <LuEyeOff className="text-[17px]" aria-hidden />
                ) : (
                  <LuEye className="text-[17px]" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 text-[14px] font-bold text-on-primary transition-colors hover:bg-primary disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading ? <LuArrowUpRight className="text-[16px]" aria-hidden /> : null}
          </button>

          {error ? (
            <p role="alert" className="text-center text-[13px] leading-snug text-error">
              {error}
            </p>
          ) : null}
        </form>

        <p className="mt-5 text-center text-[12px]">
          <Link
            href="/car-hire"
            className="inline-flex items-center gap-1 font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Back to car hire
          </Link>
        </p>
      </div>
    </div>
  )
}
