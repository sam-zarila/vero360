'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminAlerts } from '../AdminAlertsProvider'
import {
  authProviderLabel,
  countUsers,
  formatDateTime,
  roleLabel,
  roleTone,
  type UserRole,
} from '@/lib/users'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

type Tab = 'all' | UserRole

export default function UsersAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const {
    users: liveUsers,
    loading,
    error: liveError,
    markUsersSeen,
    refresh,
  } = useAdminAlerts().users
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    markUsersSeen()
  }, [markUsersSeen, liveUsers.length])

  const counts = useMemo(() => countUsers(liveUsers), [liveUsers])
  const suspendedCount = useMemo(
    () => liveUsers.filter(u => u.accountStatus === 'suspended').length,
    [liveUsers],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return liveUsers.filter(user => {
      if (tab !== 'all' && user.role !== tab) return false
      if (!q) return true
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone.toLowerCase().includes(q) ||
        (user.businessName || '').toLowerCase().includes(q)
      )
    })
  }, [liveUsers, query, tab])

  const runAction = async (id: string, action: 'suspend' | 'activate' | 'delete') => {
    const label =
      action === 'suspend' ? 'Suspend' : action === 'activate' ? 'Activate' : 'Delete'
    const user = liveUsers.find(u => u.id === id)
    const name = user?.name || user?.email || id

    if (action === 'delete') {
      if (
        !(await confirmDelete(
          name,
          'Permanently deletes this account from Firebase Auth and Firestore. This cannot be undone.',
        ))
      ) {
        return
      }
    } else if (action === 'suspend') {
      if (
        !(await confirm({
          title: 'Suspend?',
          message: `Suspend “${name}”?\n\nThey will not be able to sign in.`,
          confirmLabel: 'Yes, suspend',
          cancelLabel: 'No',
          danger: true,
        }))
      ) {
        return
      }
    }

    setBusyId(id)
    setActionError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: action === 'delete' ? undefined : { 'Content-Type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `${label} failed`)
      setNotice(data.message || `${label} succeeded`)
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `${label} failed`)
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'customer', label: 'Customers', count: counts.customer },
    { id: 'merchant', label: 'Merchants', count: counts.merchant },
    { id: 'driver', label: 'Drivers', count: counts.driver },
  ]

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: 900,
              letterSpacing: '-0.4px',
              marginBottom: 6,
            }}
          >
            Users
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0, maxWidth: 560 }}>
            Manage app accounts — search by name or email, then suspend or delete.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 14px',
            borderRadius: 100,
            border: '1px solid var(--border)',
            background: '#fff',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          Refresh
        </button>
      </div>

      <div
        className="user-count-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <CountCard label="Total users" value={counts.all} />
        <CountCard label="Customers" value={counts.customer} />
        <CountCard label="Merchants" value={counts.merchant} />
        <CountCard label="Drivers" value={counts.driver} />
        <CountCard label="Suspended" value={suspendedCount} />
      </div>

      {(liveError || actionError || notice) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: liveError || actionError ? '#FEF2F2' : '#ECFDF5',
            color: liveError || actionError ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {liveError || actionError || notice}
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={{ flex: '1 1 280px', position: 'relative', display: 'block' }}>
          <span className="sr-only">Search users by name or email</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or email…"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '11px 14px 11px 40px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-4)',
              fontSize: 15,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
        </label>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-2)',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 100,
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-50)' : '#fff',
                color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          minHeight: 420,
        }}
      >
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading users…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            {query.trim()
              ? `No users found for “${query.trim()}”.`
              : 'No users in this filter.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(user => {
              const tone = roleTone(user.role)
              const busy = busyId === user.id
              const suspended = user.accountStatus === 'suspended'
              return (
                <article
                  key={user.id}
                  className="user-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: suspended ? '1px solid #FECACA' : '1px solid var(--border)',
                    background: suspended ? '#FEF2F2' : 'var(--surface)',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{user.name}</h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {roleLabel(user.role)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: suspended ? '#FEE2E2' : '#ECFDF5',
                          color: suspended ? '#B91C1C' : '#047857',
                          border: suspended ? '1px solid #FECACA' : '1px solid #A7F3D0',
                        }}
                      >
                        {suspended ? 'Suspended' : 'Active'}
                      </span>
                      {user.status ? (
                        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>
                          {user.status}
                        </span>
                      ) : null}
                      {user.authProvider && user.authProvider !== 'unknown' ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 100,
                            background: '#F3F4F6',
                            color: '#4B5563',
                            border: '1px solid #E5E7EB',
                          }}
                        >
                          {authProviderLabel(user.authProvider)}
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta label="Email" value={user.email || '—'} />
                      <Meta label="Phone" value={user.phone || '—'} />
                      {user.businessName ? <Meta label="Business" value={user.businessName} /> : null}
                      <Meta label="Joined" value={formatDateTime(user.createdAt)} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minWidth: 120,
                    }}
                  >
                    {suspended ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(user.id, 'activate')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid #A7F3D0',
                          background: '#ECFDF5',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#047857',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        Activate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(user.id, 'suspend')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid #FDE68A',
                          background: '#FFFBEB',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#B45309',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(user.id, 'delete')}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#991B1B',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 900px) {
          .user-count-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .user-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.5px',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )
}
