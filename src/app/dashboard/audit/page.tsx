'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import type { AuditEvent } from '@/lib/audit-trail'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditTrailPage() {
  const { isSuperAdmin, loading: sessionLoading } = usePanelSession()
  const [items, setItems] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/audit-trail', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load audit trail')
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || !isSuperAdmin) return
    void load()
  }, [load, sessionLoading, isSuperAdmin])

  if (!sessionLoading && !isSuperAdmin) {
    return (
      <div>
        <DashboardBackLink label="Back to dashboard" />
        <DashboardEmptyState
          icon="shield"
          color="#6D28D9"
          title="Super admins only"
          hint="The audit trail is visible to super admins."
        />
      </div>
    )
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />
      <DashboardPageHeader
        sectionId="audit"
        title="Audit trail"
        description="Who created or changed panel records. Passwords and OTP codes are not stored."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      {error ? (
        <p style={{ color: '#B91C1C', fontWeight: 700, marginBottom: 12 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Loading audit trail…</p>
      ) : items.length === 0 ? (
        <DashboardEmptyState
          icon="shield"
          color="#6D28D9"
          title="No events yet"
          hint="Orders, rides, courier, marketplace, food, stay, refunds, users, and other panel changes will appear here."
        />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 16, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['When', 'Who', 'Role', 'Action', 'What happened'].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      fontSize: 12,
                      color: 'var(--text-3)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {formatWhen(item.createdAt)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{item.actorName || item.actorEmail || '—'}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.actorEmail}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{item.actorRole}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>
                    {item.action} {item.resource}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-2)' }}>
                    {item.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
