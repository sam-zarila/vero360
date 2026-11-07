'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { VeroIcon } from '@/app/components/landing/icons'
import { adminFetch } from '@/lib/panel-client-auth'
import { useAdminAlerts } from './AdminAlertsProvider'

type InboxItem = {
  id: string
  title: string
  href: string
  at: string
  read: boolean
}

const INBOX_KEY = 'vero_admin_activity_inbox'

function readInbox(): InboxItem[] {
  try {
    const raw = localStorage.getItem(INBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(row => row && typeof row === 'object' && typeof row.title === 'string')
      .map(row => ({
        id: String(row.id || ''),
        title: String(row.title),
        href: String(row.href || '/dashboard'),
        at: String(row.at || ''),
        read: row.read === true,
      }))
      .filter(row => row.id && row.title)
      .slice(0, 40)
  } catch {
    return []
  }
}

function writeInbox(items: InboxItem[]) {
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, 40)))
  } catch {
    // ignore
  }
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === new Date().toDateString()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export default function AdminNotifications() {
  const {
    courier,
    drivers,
    rides,
    orders,
    food,
    stay,
    users,
    merchantReports,
    payments,
    carHire,
  } = useAdminAlerts()
  const [items, setItems] = useState<InboxItem[]>([])
  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const seenToasts = useRef(new Set<string>())

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported')
      return
    }
    void navigator.serviceWorker.getRegistration('/admin-alerts-sw.js').then(async reg => {
      const sub = await reg?.pushManager.getSubscription()
      setPushState(sub ? 'on' : 'off')
    }).catch(() => setPushState('off'))
  }, [])

  const enableDeviceAlerts = async () => {
    setPushError('')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('unsupported')
      setPushError('This browser cannot receive alerts when you are signed out.')
      return
    }
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushError('Allow notifications for this site, then try again.')
        return
      }
      const registration = await navigator.serviceWorker.register('/admin-alerts-sw.js')
      const keyRes = await adminFetch('/api/admin/push-subscription', { cache: 'no-store' })
      const keyData = (await keyRes.json()) as { publicKey?: string; error?: string }
      if (!keyRes.ok || !keyData.publicKey) {
        throw new Error(keyData.error || 'Could not prepare device alerts')
      }
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }))
      const save = await adminFetch('/api/admin/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      const saved = (await save.json()) as { error?: string }
      if (!save.ok) throw new Error(saved.error || 'Could not save this device')
      setPushState('on')
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not turn on device alerts')
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    setItems(readInbox())
  }, [])

  useEffect(() => {
    writeInbox(items)
  }, [items])

  useEffect(() => {
    const sources: Array<{ toast: string | null; href: string }> = [
      { toast: orders.toast, href: '/dashboard/orders' },
      { toast: food.toast, href: '/dashboard/food' },
      { toast: courier.toast, href: '/dashboard/vero-courier' },
      { toast: rides.toast, href: '/dashboard/vero-ride/trips' },
      { toast: stay.toast, href: '/dashboard/stay' },
      { toast: drivers.toast, href: '/dashboard/vero-ride' },
      { toast: carHire.toast, href: '/dashboard/car-hire' },
      { toast: users.toast, href: '/dashboard/users' },
      { toast: merchantReports.toast, href: '/dashboard/merchant-reports' },
      { toast: payments.toast, href: payments.toastHref || '/dashboard/digital-services' },
    ]
    const fresh = sources.filter(
      s => s.toast && !seenToasts.current.has(s.toast),
    )
    if (!fresh.length) return
    for (const s of fresh) {
      if (s.toast) seenToasts.current.add(s.toast)
    }
    setItems(prev => {
      const next = [...fresh].reverse().map(s => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: s.toast as string,
        href: s.href,
        at: new Date().toISOString(),
        read: false,
      }))
      const titles = new Set(next.map(n => n.title))
      return [...next, ...prev.filter(p => !titles.has(p.title))].slice(0, 40)
    })
  }, [
    orders.toast,
    food.toast,
    courier.toast,
    rides.toast,
    stay.toast,
    drivers.toast,
    carHire.toast,
    users.toast,
    merchantReports.toast,
    payments.toast,
    payments.toastHref,
  ])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = useMemo(() => items.filter(i => !i.read).length, [items])

  const markAllRead = () => {
    setItems(prev => prev.map(i => ({ ...i, read: true })))
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={unread ? `${unread} new notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: '#fff',
          color: 'var(--text)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <VeroIcon name="bell" size={18} strokeWidth={2.2} />
        {unread > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 100,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 340,
            maxWidth: 'min(340px, calc(100vw - 32px))',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 80,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800 }}>Notifications</div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#C2410C',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark read
              </button>
            ) : null}
          </div>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: '#FFF7ED' }}>
            {pushState === 'on' ? (
              <p style={{ margin: 0, fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
                This device will alert you when a new order or payment comes in, even if you are signed out.
              </p>
            ) : pushState === 'unsupported' ? (
              <p style={{ margin: 0, fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
                This browser cannot show alerts after you leave the dashboard. Use Chrome or Edge on this computer.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={() => void enableDeviceAlerts()}
                  style={{
                    border: 'none',
                    background: '#EA580C',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {pushBusy ? 'Turning on…' : 'Alert this device when I am away'}
                </button>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
                  You will get a notification for new orders and payments without staying signed in.
                </p>
              </>
            )}
            {pushError ? (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#991B1B' }}>{pushError}</p>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p style={{ padding: 16, margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              New orders, food, rides, stays, courier jobs, car hire, and payments show here. Anything that arrived while you were away appears the next time you open the dashboard.
            </p>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {items.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    setOpen(false)
                    setItems(prev => prev.map(row => (row.id === item.id ? { ...row, read: true } : row)))
                  }}
                  style={{
                    display: 'block',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                    background: item.read ? '#fff' : '#FFF7ED',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, lineHeight: 1.45 }}>
                    {item.title}
                  </div>
                  {item.at ? (
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                      {timeLabel(item.at)}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
