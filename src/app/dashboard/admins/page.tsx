'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'
import {
  adminRoleLabel,
  adminRoleTone,
  adminStatusTone,
  formatDateTime,
  type AdminRole,
  type PanelAdmin,
} from '@/lib/admins'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

type Counts = {
  all: number
  super_admin: number
  admin: number
  active: number
  suspended: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  super_admin: 0,
  admin: 0,
  active: 0,
  suspended: 0,
}

export default function AdminsPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [admins, setAdmins] = useState<PanelAdmin[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [me, setMe] = useState<PanelAdmin | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | 'create' | null>(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | AdminRole | 'suspended'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')

  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [bootstrap, setBootstrap] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, () => setAuthReady(true))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/admins', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load admins')
      setAdmins(data.admins || [])
      setCounts(data.counts || EMPTY_COUNTS)
      setMe(data.me || null)
      setCanManage(Boolean(data.canManage))
      setNeedsSignIn(Boolean(data.needsSignIn))
      setBootstrap(Boolean(data.bootstrap) || (data.admins || []).length === 0)
      if ((data.admins || []).length === 0) setFormOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    void load()
  }, [authReady, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return admins.filter(a => {
      if (tab === 'super_admin' && a.role !== 'super_admin') return false
      if (tab === 'admin' && a.role !== 'admin') return false
      if (tab === 'suspended' && a.status !== 'suspended') return false
      if (!q) return true
      return (
        a.email.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      )
    })
  }, [admins, tab, query])

  const createAdmin = async (e: FormEvent) => {
    e.preventDefault()
    setBusyId('create')
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders(true)
      const res = await adminFetch('/api/admin/admins', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
          role: counts.all === 0 ? 'super_admin' : role,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')

      // Apply response immediately so bootstrap doesn't look "empty" after create.
      if (data.admin) {
        setAdmins(prev => {
          const next = prev.filter(a => a.id !== data.admin.id)
          next.push(data.admin)
          return next
        })
        setCounts(c => ({
          ...c,
          all: Math.max(c.all, 1),
          super_admin:
            data.admin.role === 'super_admin'
              ? Math.max(c.super_admin, 1)
              : c.super_admin,
          admin: data.admin.role === 'admin' ? Math.max(c.admin, 1) : c.admin,
          active: Math.max(c.active, 1),
        }))
        setBootstrap(false)
        setCanManage(false)
        setNeedsSignIn(true)
      }

      setNotice(
        data.message ||
          'Admin created. Sign in at /panel with this email and password.',
      )
      setEmail('')
      setPassword('')
      setDisplayName('')
      setRole('admin')
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusyId(null)
    }
  }

  const runAction = async (
    admin: PanelAdmin,
    action: 'suspend' | 'activate' | 'delete' | 'set_role',
    nextRole?: AdminRole,
  ) => {
    let confirmPassword = ''
    if (action === 'delete') {
      if (
        !(await confirmDelete(
          admin.email,
          'Removes panel access and the Firebase Auth account.',
        ))
      ) {
        return
      }
      const typed = window.prompt(
        'Enter YOUR current password to confirm this delete:',
      )
      if (typed == null) return
      confirmPassword = typed
      if (!confirmPassword) {
        setError('Your current password is required to delete an admin.')
        return
      }
    } else if (action === 'suspend') {
      if (
        !(await confirm({
          title: 'Suspend?',
          message: `Suspend ${admin.email}?\n\nThey will not be able to sign in.`,
          confirmLabel: 'Yes, suspend',
          cancelLabel: 'No',
          danger: true,
        }))
      ) {
        return
      }
    }

    setBusyId(admin.id)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders(true)
      if (action === 'delete') {
        const res = await adminFetch(`/api/admin/admins/${admin.id}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ password: confirmPassword }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        setNotice(data.message || 'Deleted')
      } else {
        const res = await adminFetch(`/api/admin/admins/${admin.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(
            action === 'set_role'
              ? { action: 'set_role', role: nextRole }
              : { action },
          ),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Update failed')
        setNotice(data.message || 'Updated')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: typeof tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'super_admin', label: 'Super admins', count: counts.super_admin },
    { id: 'admin', label: 'Admins', count: counts.admin },
    { id: 'suspended', label: 'Suspended', count: counts.suspended },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link href="/dashboard" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
        ← Dashboard
      </Link>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 14,
          margin: '10px 0 18px',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700 }}>Admins</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
            Classify panel users as <strong>super admin</strong> or <strong>admin</strong>.
            You can have many super admins. Super admins manage accounts; normal admins
            cannot see Finance or Admins.
          </p>
          {me ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6B7280' }}>
              Signed in as {me.email} ({adminRoleLabel(me.role)})
            </p>
          ) : bootstrap ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#B45309' }}>
              No admins yet — create the first <strong>super admin</strong> below, then sign in at{' '}
              <Link href="/panel">/panel</Link>.
            </p>
          ) : needsSignIn ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#047857' }}>
              Super admin exists. <Link href="/panel">Sign in at /panel</Link> to manage accounts.
            </p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#B45309' }}>
              Sign in at <Link href="/panel">/panel</Link> as a super admin to manage accounts.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={btnGhost}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => setFormOpen(o => !o)}
              style={btnPrimary}
            >
              {formOpen ? 'Close form' : '+ Create admin'}
            </button>
          ) : needsSignIn ? (
            <Link href="/panel" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
              Sign in at /panel
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {formOpen && canManage ? (
        <form onSubmit={createAdmin} style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
            {bootstrap ? 'Create first super admin' : 'Create admin'}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Email *">
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@vero360.app"
                style={input}
                autoComplete="off"
              />
            </Field>
            <Field label="Password *">
              <input
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                style={input}
                minLength={6}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Display name">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Optional"
                style={input}
              />
            </Field>
            {!bootstrap ? (
              <Field label="Role">
                <select
                  value={role}
                  onChange={e =>
                    setRole(e.target.value === 'super_admin' ? 'super_admin' : 'admin')
                  }
                  style={input}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </Field>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={busyId === 'create'}
            style={{ ...btnPrimary, marginTop: 14 }}
          >
            {busyId === 'create' ? 'Creating…' : bootstrap ? 'Create super admin' : 'Create admin'}
          </button>
        </form>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...chip,
              background: tab === t.id ? '#0F766E' : '#F3F4F6',
              color: tab === t.id ? '#fff' : '#374151',
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search email or name…"
        style={{ ...input, maxWidth: 360, marginBottom: 16 }}
      />

      {loading && admins.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Loading admins…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
          No admins found.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(a => {
            const roleTone = adminRoleTone(a.role)
            const statusTone = adminStatusTone(a.status)
            const busy = busyId === a.id
            const isMe = me?.id === a.id
            return (
              <div key={a.id} style={card}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {a.displayName}
                      {isMe ? (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#6B7280' }}>(you)</span>
                      ) : null}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>{a.email}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>
                      Created {formatDateTime(a.createdAt)}
                      {a.lastLoginAt ? ` · Last login ${formatDateTime(a.lastLoginAt)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <Pill bg={roleTone.bg} color={roleTone.color} border={roleTone.border}>
                      {adminRoleLabel(a.role)}
                    </Pill>
                    <Pill bg={statusTone.bg} color={statusTone.color} border={statusTone.border}>
                      {statusTone.label}
                    </Pill>
                  </div>
                </div>

                {canManage ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {a.status === 'active' ? (
                      <button
                        type="button"
                        disabled={busy || isMe}
                        onClick={() => void runAction(a, 'suspend')}
                        style={btnGhost}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(a, 'activate')}
                        style={btnGhost}
                      >
                        Activate
                      </button>
                    )}
                    {a.role === 'admin' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(a, 'set_role', 'super_admin')}
                        style={btnGhost}
                      >
                        Make super admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || isMe}
                        onClick={() => void runAction(a, 'set_role', 'admin')}
                        style={btnGhost}
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || isMe}
                      onClick={() => void runAction(a, 'delete')}
                      style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FECACA' }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
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

function Pill({
  children,
  bg,
  color,
  border,
}: {
  children: ReactNode
  bg: string
  color: string
  border: string
}) {
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </span>
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

const chip: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
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

const btnGhost: CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#fff',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
