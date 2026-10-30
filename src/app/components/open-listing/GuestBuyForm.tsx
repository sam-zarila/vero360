'use client'

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import ImagePickField from '@/app/components/open-listing/ImagePickField'
import { formatMwk } from '@/lib/vero-api'

const label: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
}

const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}

const btn: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center',
  textDecoration: 'none',
  borderRadius: 14,
  padding: '14px 16px',
  fontWeight: 800,
  marginTop: 10,
  border: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontFamily: 'inherit',
}

type BankInfo = {
  enabled: boolean
  bankName?: string
  accountName?: string
  accountNumber?: string
  branch?: string
}

export default function GuestBuyForm({
  checkoutUrl,
  payload,
  amountMwk,
  submitLabel,
  successMessage,
  extraFields,
  disabled,
}: {
  checkoutUrl: string
  payload: Record<string, unknown>
  amountMwk: number
  submitLabel: string
  successMessage: string
  extraFields?: ReactNode
  disabled?: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [network, setNetwork] = useState<'airtel' | 'tnm'>('airtel')
  const [payMethod, setPayMethod] = useState<'momo' | 'bank'>('momo')
  const [bank, setBank] = useState<BankInfo | null>(null)
  const [bankOrder, setBankOrder] = useState<{ txRef: string; amountMwk: number } | null>(
    null,
  )
  const [proofUrl, setProofUrl] = useState('')
  const [proofBusy, setProofBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [depositId, setDepositId] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/bank-transfer', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setBank(data && data.enabled ? data : { enabled: false })
      })
      .catch(() => {
        if (!cancelled) setBank({ enabled: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    const local = digits.startsWith('265') ? `0${digits.slice(3)}` : digits
    if (local.startsWith('09')) setNetwork('airtel')
    else if (local.startsWith('08')) setNetwork('tnm')
  }, [phone])

  useEffect(() => {
    if (!waiting || !depositId || paid) return
    let cancelled = false
    let timer = 0

    async function check() {
      try {
        const res = await fetch(
          `/api/public/payments/pawapay/status?deposit_id=${encodeURIComponent(depositId)}`,
          { cache: 'no-store' },
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.paid) {
          setPaid(true)
          setWaiting(false)
          setSubmitting(false)
          const track = String(data.trackingNumber || '').trim()
          if (track) setTrackingNumber(track)
          return
        }
        if (data.status === 'failed') {
          setWaiting(false)
          setSubmitting(false)
          setError(
            data.failure || data.error || 'The prompt was not approved. Try again.',
          )
          return
        }
      } catch {
        if (cancelled) return
      }
      timer = window.setTimeout(check, 3000)
    }

    timer = window.setTimeout(check, 2500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [waiting, depositId, paid])

  async function uploadProof(file: File | undefined) {
    if (!file) return
    setProofBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/public/digital-services/kyc-upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = String(data.imageUrl || '').trim()
      if (!url) throw new Error('Upload failed')
      setProofUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setProofBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (waiting || paid || bankOrder || disabled) return
    setError('')
    if (!(amountMwk > 0)) {
      setError('This item cannot be purchased right now.')
      return
    }
    if (payMethod === 'bank' && !proofUrl) {
      setError('Upload a photo of your transfer slip so we can confirm the payment.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim(),
          network,
          method: payMethod === 'bank' ? 'bank_transfer' : 'momo',
          proofUrl: payMethod === 'bank' ? proofUrl : '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not start payment')
      const track = String(data.trackingNumber || '').trim()
      if (track) setTrackingNumber(track)
      if (payMethod === 'bank' || data.method === 'bank_transfer') {
        setBankOrder({
          txRef: String(data.txRef || '').trim(),
          amountMwk: Number(data.amountMwk) || amountMwk,
        })
        setSubmitting(false)
        return
      }
      const id = String(data.depositId || '').trim()
      if (!id) throw new Error('PawaPay did not start the payment.')
      setDepositId(id)
      setWaiting(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSubmitting(false)
    }
  }

  const locked = waiting || paid || Boolean(bankOrder)

  return (
    <form onSubmit={onSubmit}>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412' }}>You pay</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#9A3412', marginTop: 2 }}>
          {formatMwk(amountMwk)}
        </div>
        <div style={{ fontSize: 13, color: '#9A3412', marginTop: 4 }}>
          Guest checkout — no Vero360 account needed
        </div>
      </div>

      {extraFields}

      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="guest-name">
          Full name
        </label>
        <input
          id="guest-name"
          style={input}
          required
          minLength={2}
          autoComplete="name"
          placeholder="As on your mobile money account"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={locked}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="guest-phone">
          Malawi mobile number
        </label>
        <input
          id="guest-phone"
          style={input}
          required
          disabled={locked}
          inputMode="tel"
          autoComplete="tel"
          placeholder="099 or 088 number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
      </div>
      {bank?.enabled ? (
        <div style={{ marginBottom: 12 }}>
          <span style={label}>Pay with</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(
              [
                ['momo', 'Airtel / TNM'],
                ['bank', 'Bank transfer'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                disabled={locked}
                onClick={() => setPayMethod(id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: payMethod === id ? '2px solid #EA580C' : '1px solid var(--border)',
                  background: payMethod === id ? '#FFF7ED' : '#fff',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: locked ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {payMethod === 'momo' ? (
        <div style={{ marginBottom: 12 }}>
          <span style={label}>Network</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(
              [
                ['airtel', 'Airtel Money (099)'],
                ['tnm', 'TNM Mpamba (088)'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                disabled={locked}
                onClick={() => setNetwork(id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: network === id ? '2px solid #EA580C' : '1px solid var(--border)',
                  background: network === id ? '#FFF7ED' : '#fff',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: locked ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="guest-email">
          Email
        </label>
        <input
          id="guest-email"
          style={input}
          required
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={locked}
        />
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
          We send your receipt and order updates here. No account required.
        </p>
      </div>

      {payMethod === 'bank' && bank?.enabled ? (
        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: '#9A3412', marginBottom: 8 }}>
            Transfer to this account
          </div>
          <BankLine label="Bank" value={bank.bankName || ''} />
          <BankLine label="Account name" value={bank.accountName || ''} />
          <BankLine label="Account number" value={bank.accountNumber || ''} />
          <BankLine label="Branch" value={bank.branch || ''} />
          {bankOrder?.txRef ? <BankLine label="Payment reference" value={bankOrder.txRef} /> : null}
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
            Send the exact amount {formatMwk(bankOrder?.amountMwk || amountMwk)}. Use the payment
            reference as the deposit description so we can match it.
          </p>
          {!bankOrder ? (
            <div style={{ marginTop: 12 }}>
              <ImagePickField
                label="Transfer slip / proof of payment"
                ready={Boolean(proofUrl)}
                busy={proofBusy}
                onFile={file => void uploadProof(file)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {paid ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#ECFDF5',
            color: '#065F46',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          {successMessage}
          {trackingNumber ? ` Tracking ${trackingNumber}.` : ''}
        </div>
      ) : null}

      {bankOrder && !paid ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#ECFDF5',
            color: '#065F46',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          Transfer received for review. Keep reference {bankOrder.txRef}. We will confirm and fulfil
          shortly.
          {trackingNumber ? ` Tracking ${trackingNumber}.` : ''}
        </div>
      ) : null}

      {waiting ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FFF7ED',
            color: '#9A3412',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          A prompt was sent to your phone. Approve it with your PIN.
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 10,
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}

      {!paid && !bankOrder ? (
        <button
          type="submit"
          disabled={submitting || waiting || disabled || !(amountMwk > 0)}
          style={{
            ...btn,
            background: '#EA580C',
            color: '#fff',
            opacity: submitting || waiting || disabled ? 0.7 : 1,
          }}
        >
          {submitting || waiting ? 'Please wait…' : submitLabel}
        </button>
      ) : null}
    </form>
  )
}

function BankLine({ label: name, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        marginTop: 4,
      }}
    >
      <span style={{ color: '#9A3412' }}>{name}</span>
      <span style={{ fontWeight: 700, color: '#7C2D12', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export const guestFieldLabel: CSSProperties = label
export const guestFieldInput: CSSProperties = input
