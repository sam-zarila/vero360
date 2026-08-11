'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  driverStatusLabel,
  driverStatusTone,
  formatDateTime,
  type FleetDriver,
} from '@/lib/drivers'
import { panelAuthHeaders } from '@/lib/panel-client-auth'
import { useConfirm } from '../../ConfirmDialog'
import { ApplicationReviewPanel } from '../ApplicationReviewPanel'

export default function DriverDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const confirm = useConfirm()
  const [driver, setDriver] = useState<FleetDriver | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [acting, setActing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState<null | 'driver' | number>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await fetch(`/api/admin/drivers/${id}`, {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load driver')
      setDriver(data.driver)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load driver')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function postJson(url: string, body?: unknown) {
    const headers = await panelAuthHeaders(true)
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Action failed')
    return data
  }

  async function verifyDriver() {
    const ok = await confirm({
      title: 'Verify driver?',
      message: 'Approve this driver’s identity documents.',
      confirmLabel: 'Verify',
    })
    if (!ok) return
    setActing(true)
    setNotice('')
    try {
      await postJson(`/api/admin/drivers/${id}/verify`)
      setNotice('Driver verified.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed')
    } finally {
      setActing(false)
    }
  }

  async function rejectDriver() {
    if (!rejectReason.trim()) return
    setActing(true)
    setNotice('')
    try {
      await postJson(`/api/admin/drivers/${id}/reject`, {
        reason: rejectReason.trim(),
      })
      setRejectOpen(null)
      setRejectReason('')
      setNotice('Driver application rejected.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  async function approveVehicle(taxiId: number) {
    const ok = await confirm({
      title: 'Approve vehicle?',
      message: 'Mark this vehicle proposal as ACTIVE.',
      confirmLabel: 'Approve',
    })
    if (!ok) return
    setActing(true)
    setNotice('')
    try {
      await postJson(`/api/admin/taxis/${taxiId}/approve-proposal`)
      setNotice('Vehicle approved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setActing(false)
    }
  }

  async function rejectVehicle() {
    if (typeof rejectOpen !== 'number' || !rejectReason.trim()) return
    setActing(true)
    setNotice('')
    try {
      await postJson(`/api/admin/taxis/${rejectOpen}/reject-proposal`, {
        reason: rejectReason.trim(),
      })
      setRejectOpen(null)
      setRejectReason('')
      setNotice('Vehicle proposal rejected.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  async function suspendDriver() {
    const ok = await confirm({
      title: 'Suspend driver?',
      message: 'They will not be able to go online.',
      confirmLabel: 'Suspend',
      danger: true,
    })
    if (!ok) return
    setActing(true)
    try {
      await postJson(`/api/admin/drivers/${id}/suspend`)
      setNotice('Driver suspended.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suspend failed')
    } finally {
      setActing(false)
    }
  }

  async function activateDriver() {
    const ok = await confirm({
      title: 'Activate driver?',
      message: 'Restore this driver to verified/active.',
      confirmLabel: 'Activate',
    })
    if (!ok) return
    setActing(true)
    try {
      await postJson(`/api/admin/drivers/${id}/activate`)
      setNotice('Driver activated.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activate failed')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--muted)' }}>Loading driver…</p>
  }

  if (!driver) {
    return (
      <div>
        <p style={{ color: '#B91C1C' }}>{error || 'Driver not found'}</p>
        <Link href="/dashboard/vero-ride">← Back to drivers</Link>
      </div>
    )
  }

  const tone = driverStatusTone(driver.status)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <Link
          href="/dashboard/vero-ride"
          style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}
        >
          ← Drivers
        </Link>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginTop: 8,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                fontFamily: 'var(--font-display), sans-serif',
              }}
            >
              {driver.name}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
              {driver.email || '—'} · {driver.phone || '—'} · Submitted{' '}
              {formatDateTime(driver.submittedAt || driver.createdAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: tone.bg,
                color: tone.color,
                border: `1px solid ${tone.border}`,
              }}
            >
              {driverStatusLabel(driver.status)}
            </span>
            {driver.status === 'SUSPENDED' ? (
              <button
                type="button"
                disabled={acting}
                onClick={activateDriver}
                style={headerBtn()}
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                disabled={acting}
                onClick={suspendDriver}
                style={headerBtn(true)}
              >
                Suspend
              </button>
            )}
          </div>
        </div>
      </div>

      {notice ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#ECFDF5',
            color: '#047857',
            border: '1px solid #A7F3D0',
          }}
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#B91C1C',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      ) : null}

      <ApplicationReviewPanel
        driver={driver}
        acting={acting}
        onVerifyDriver={verifyDriver}
        onRejectDriver={() => {
          setRejectReason('')
          setRejectOpen('driver')
        }}
        onApproveVehicle={approveVehicle}
        onRejectVehicle={taxiId => {
          setRejectReason('')
          setRejectOpen(taxiId)
        }}
        onPreview={setPreviewUrl}
      />

      {rejectOpen != null ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => !acting && setRejectOpen(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 14,
              padding: 20,
              width: 'min(480px, 100%)',
              border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              {rejectOpen === 'driver' ? 'Reject driver' : 'Reject vehicle'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              The driver will see this reason in the app.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Reason…"
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: 10,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                disabled={acting}
                onClick={() => setRejectOpen(null)}
                style={headerBtn()}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting || !rejectReason.trim()}
                onClick={() =>
                  rejectOpen === 'driver' ? rejectDriver() : rejectVehicle()
                }
                style={headerBtn(true)}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => setPreviewUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Document preview"
            style={{
              maxWidth: 'min(960px, 100%)',
              maxHeight: '90vh',
              borderRadius: 12,
              background: '#fff',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function headerBtn(danger = false): CSSProperties {
  return {
    border: `1px solid ${danger ? '#FECACA' : 'var(--border)'}`,
    background: danger ? '#FEF2F2' : 'var(--surface)',
    color: danger ? '#B91C1C' : 'var(--text)',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  }
}
