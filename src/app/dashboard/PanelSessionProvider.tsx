'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'
import type { AdminRole, PanelAdmin } from '@/lib/admins'

type PanelSession = {
  loading: boolean
  bootstrap: boolean
  me: PanelAdmin | null
  role: AdminRole | null
  isSuperAdmin: boolean
  isAdmin: boolean
  isMarketer: boolean
  isAgent: boolean
  isFullAdmin: boolean
  authenticated: boolean
  refresh: () => Promise<void>
}

const PanelSessionContext = createContext<PanelSession>({
  loading: true,
  bootstrap: false,
  me: null,
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  isMarketer: false,
  isAgent: false,
  isFullAdmin: false,
  authenticated: false,
  refresh: async () => {},
})

export function PanelSessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [bootstrap, setBootstrap] = useState(false)
  const [me, setMe] = useState<PanelAdmin | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, () => setAuthReady(true))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const headers = auth.currentUser
        ? await panelAuthHeaders()
        : { Accept: 'application/json' }
      const res = auth.currentUser
        ? await adminFetch('/api/admin/admins/me', { headers, cache: 'no-store' })
        : await fetch('/api/admin/admins/me', { headers, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      setBootstrap(Boolean(data?.needsBootstrap))
      if (res.ok && data?.authenticated && data?.me) {
        setMe(data.me as PanelAdmin)
      } else {
        setMe(null)
      }
    } catch {
      setBootstrap(false)
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    void refresh()
  }, [authReady, refresh])

  const value = useMemo<PanelSession>(() => {
    const role = me?.role ?? null
    return {
      loading,
      bootstrap,
      me,
      role,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'admin',
      isMarketer: role === 'marketer',
      isAgent: role === 'agent',
      isFullAdmin: role === 'super_admin' || role === 'admin',
      authenticated: !!me,
      refresh,
    }
  }, [loading, bootstrap, me, refresh])

  return (
    <PanelSessionContext.Provider value={value}>{children}</PanelSessionContext.Provider>
  )
}

export function usePanelSession() {
  return useContext(PanelSessionContext)
}

/** Paths only super admins may open. */
export const SUPER_ADMIN_ONLY_PATHS = [
  '/dashboard/finance',
  '/dashboard/wallet',
  '/dashboard/admins',
  '/dashboard/rewards',
  '/dashboard/audit',
] as const

export const MARKETER_HOME = '/dashboard/marketing/tasks'

export const MARKETER_ALLOWED_PATHS = [
  '/dashboard/marketing',
  '/dashboard/marketing/tasks',
  '/dashboard/marketing/progress',
  '/dashboard/marketing/kpi',
  '/dashboard/marketing-tasks',
  '/dashboard/settings',
] as const

export const AGENT_HOME = '/dashboard/agent'

export const AGENT_ALLOWED_PATHS = [
  '/dashboard/agent',
  '/dashboard/settings',
] as const

export function isSuperAdminOnlyPath(pathname: string) {
  return SUPER_ADMIN_ONLY_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export function isMarketerAllowedPath(pathname: string) {
  return MARKETER_ALLOWED_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export function isAgentAllowedPath(pathname: string) {
  return AGENT_ALLOWED_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )
}
