'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Logo from '@/app/components/landing/Logo'

function PaymentReturnInner() {
  const params = useSearchParams()
  const txRef = params.get('tx_ref') || ''
  const orderId = params.get('order_id') || ''
  const depositId = params.get('deposit_id') || ''
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'error'>(
    'checking',
  )
  const [message, setMessage] = useState('Confirming your payment…')

  useEffect(() => {
    let cancelled = false
    let tries = 0

    async function check() {
      if (!txRef && !depositId) {
        setStatus('error')
        setMessage('Missing payment reference.')
        return
      }
      try {
        const qs = new URLSearchParams()
        if (depositId) qs.set('deposit_id', depositId)
        if (txRef) qs.set('tx_ref', txRef)
        if (orderId) qs.set('order_id', orderId)
<<<<<<< HEAD
        const path = depositId
          ? `/api/public/payments/pawapay/deposit?depositId=${encodeURIComponent(depositId)}&${qs.toString()}`
          : `/api/public/payments/paychangu/callback?${qs.toString()}`
        const res = await fetch(path, { cache: 'no-store' })
=======
        const res = await fetch(
          `/api/public/payments/pawapay/status?${qs.toString()}`,
          { cache: 'no-store' },
        )
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.paid) {
          setStatus('paid')
          setMessage(
            'Payment received. Our team will fulfil your digital order shortly. Check your email for updates.',
          )
          return
        }
        if (data.status === 'failed') {
          setStatus('error')
          setMessage(
            data.failure ||
              data.error ||
              'The prompt was not approved. Go back and try again.',
          )
          return
        }
        tries += 1
        if (tries >= 8) {
          setStatus('pending')
          setMessage(
<<<<<<< HEAD
            'We’re still waiting for payment confirmation. If you approved the prompt, keep this reference and contact support.',
=======
            'We’re still waiting for PawaPay confirmation. If you approved the prompt, keep this reference and contact support. Your order will update automatically.',
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
          )
          return
        }
        setTimeout(check, 2500)
      } catch {
        if (cancelled) return
        tries += 1
        if (tries >= 8) {
          setStatus('error')
          setMessage('Could not verify payment right now. Contact support with your reference.')
          return
        }
        setTimeout(check, 2500)
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [txRef, orderId, depositId])

  const tone =
    status === 'paid'
      ? { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' }
      : status === 'error'
        ? { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' }
        : { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <div
          style={{
            marginTop: 28,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
            boxShadow: 'var(--shadow)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.4px' }}>
            {status === 'paid'
              ? 'Payment successful'
              : status === 'checking'
                ? 'Confirming payment'
                : 'Payment status'}
          </h1>
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 14,
              background: tone.bg,
              color: tone.color,
              border: `1px solid ${tone.border}`,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
          {txRef ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 14 }}>
              Reference: <strong>{txRef}</strong>
            </p>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <Link
              href="/browse/digital-services"
              style={{
                textAlign: 'center',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #EA580C, #F97316)',
                color: '#fff',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Browse more digital services
            </Link>
            <Link
              href="/"
              style={{
                textAlign: 'center',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                color: '#111827',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function DigitalPaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40, textAlign: 'center' }}>Loading…</main>
      }
    >
      <PaymentReturnInner />
    </Suspense>
  )
}
