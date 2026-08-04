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
import { panelAuthHeaders } from '@/lib/panel-client-auth'
import type { AdminRole, PanelAdmin } from '@/lib/admins'

type PanelSession = {
  loading: boolean
  me: PanelAdmin | null
  role: AdminRole | null
  isSuperAdmin: boolean
  isAdmin: boolean
  authenticated: boolean
  refresh: () => Promise<void>
}

const PanelSessionContext = createContext<PanelSession>({
  loading: true,
  me: null,
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  authenticated: false,
  refresh: async () => {},
})

export function PanelSessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<PanelAdmin | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, () => setAuthReady(true))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (!auth.currentUser) {
        setMe(null)
        return
      }
      const headers = await panelAuthHeaders()
      const res = await fetch('/api/admin/admins/me', { headers, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.authenticated && data?.me) {
        setMe(data.me as PanelAdmin)
      } else {
        setMe(null)
      }
    } catch {
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
      me,
      role,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'admin',
      authenticated: !!me,
      refresh,
    }
  }, [loading, me, refresh])

  return (
    <PanelSessionContext.Provider value={value}>{children}</PanelSessionContext.Provider>
  )
}

export function usePanelSession() {
  return useContext(PanelSessionContext)
}

/** Paths only super admins may open. */
export const SUPER_ADMIN_ONLY_PATHS = ['/dashboard/finance', '/dashboard/admins'] as const

export function isSuperAdminOnlyPath(pathname: string) {
  return SUPER_ADMIN_ONLY_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )
}
