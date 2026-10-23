'use client'

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'

type BankConfig = {
  enabled: boolean
  bankName: string
  accountName: string
  accountNumber: string
  branch: string
  updatedAt: string | null
}

const empty: BankConfig = {
  enabled: true,
  bankName: 'National Bank of Malawi',
  accountName: 'VERO360 LIMITED',
  accountNumber: '1015027734',
  branch: 'City Centre',
  updatedAt: null,
}

const field: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export function BankTransferPanel() {
  const [config, setConfig] = useState<BankConfig>(empty)
  const [bankName, setBankName] = useState(empty.bankName)
  const [accountName, setAccountName] = useState(empty.accountName)
  const [accountNumber, setAccountNumber] = useState(empty.accountNumber)
  const [branch, setBranch] = useState(empty.branch)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const apply = useCallback((next: BankConfig) => {
    setConfig(next)
    setBankName(next.bankName)
    setAccountName(next.accountName)
    setAccountNumber(next.accountNumber)
    setBranch(next.branch)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/finance/bank-transfer', {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load bank details')
      apply((data.config || empty) as BankConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bank details')
    } finally {
      setLoading(false)
    }
  }, [apply])

  useEffect(() => {
    void load()
  }, [load])

  async function save(patch: Partial<BankConfig> & { enabled?: boolean }) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/finance/bank-transfer', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: patch.enabled ?? config.enabled,
          bankName: patch.bankName ?? bankName,
          accountName: patch.accountName ?? accountName,
          accountNumber: patch.accountNumber ?? accountNumber,
          branch: patch.branch ?? branch,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      apply((data.config || empty) as BankConfig)
      setNotice(data.message || 'Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void save({
      bankName,
      accountName,
      accountNumber,
      branch,
    })
  }

  return (
    <section
      style={{
        marginBottom: 20,
        padding: 18,
        borderRadius: 16,
        border: config.enabled ? '1px solid #BBF7D0' : '1px solid #FECACA',
        background: config.enabled ? '#F0FDF4' : '#FEF2F2',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#111827' }}>
            Bank transfer checkout
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#4B5563', lineHeight: 1.5 }}>
            These National Bank details show on the bank-transfer checkout page and on
            Digital Services. Switch them off to hide the option in the app and on the web.
          </p>
          {config.updatedAt ? (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6B7280' }}>
              Last changed {new Date(config.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void save({ enabled: !config.enabled })}
          style={{
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            fontWeight: 900,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: config.enabled ? '#DC2626' : '#16A34A',
            color: '#fff',
            minWidth: 220,
          }}
        >
          {busy
            ? 'Updating…'
            : config.enabled
              ? 'Turn bank transfer OFF'
              : 'Turn bank transfer ON'}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: config.enabled ? '#166534' : '#991B1B' }}>
        Bank transfer: {config.enabled ? 'ON' : 'OFF'}
      </div>

      {error ? (
        <p style={{ color: '#B91C1C', fontWeight: 700, margin: '10px 0 0' }}>{error}</p>
      ) : null}
      {notice ? (
        <p style={{ color: '#047857', fontWeight: 700, margin: '10px 0 0' }}>{notice}</p>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Bank
          <input style={{ ...field, marginTop: 4 }} value={bankName} onChange={e => setBankName(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Account name
          <input style={{ ...field, marginTop: 4 }} value={accountName} onChange={e => setAccountName(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Account number
          <input style={{ ...field, marginTop: 4 }} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Branch
          <input style={{ ...field, marginTop: 4 }} value={branch} onChange={e => setBranch(e.target.value)} />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button
            type="submit"
            disabled={busy || loading}
            style={{
              border: '1px solid #D1D5DB',
              background: '#fff',
              borderRadius: 10,
              padding: '10px 16px',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Save details
          </button>
        </div>
      </form>
    </section>
  )
}
