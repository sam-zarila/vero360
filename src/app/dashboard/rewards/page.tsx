'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import {
  COINS_PER_REDEEM,
  MWK_PER_COIN,
  type RewardsSummary,
  type RewardsUserRow,
} from '@/lib/rewards-rules'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { AdminPasswordGate } from '@/app/dashboard/AdminPasswordGate'

const EMPTY_SUMMARY: RewardsSummary = {
  userCount: 0,
  usersWithCoins: 0,
  totalCoins: 0,
  totalPoints: 0,
  totalSpinsAvailable: 0,
  totalWithdrawableMwk: 0,
  totalPendingCoins: 0,
  totalNotionalMwk: 0,
  totalLastRedeemMwk: 0,
  paidOutMwk: 0,
  paidOutCount: 0,
}

export default function RewardsAdminPage() {
  return (
    <AdminPasswordGate
      title="Vero Coins"
      description="Enter your admin panel password to open Vero Coins / rewards. Use the same password you sign in with at /panel."
    >
      <RewardsAdminInner />
    </AdminPasswordGate>
  )
}

function RewardsAdminInner() {
  const [rows, setRows] = useState<RewardsUserRow[]>([])
  const [summary, setSummary] = useState<RewardsSummary>(EMPTY_SUMMARY)
  const [rulesNote, setRulesNote] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'with_coins' | 'withdrawable'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cashOutEnabled, setCashOutEnabled] = useState(true)
  const [earningEnabled, setEarningEnabled] = useState(true)
  const [configBusy, setConfigBusy] = useState(false)
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [res, cfgRes] = await Promise.all([
        adminFetch('/api/admin/rewards', { cache: 'no-store' }),
        adminFetch('/api/admin/rewards/config', { cache: 'no-store' }),
      ])
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load Vero Coins')
      setRows(data.rows || [])
      setSummary(data.summary || EMPTY_SUMMARY)
      setRulesNote(typeof data.rules?.note === 'string' ? data.rules.note : '')

      const cfgData = await cfgRes.json().catch(() => ({}))
      if (cfgRes.ok && cfgData.config) {
        setCashOutEnabled(cfgData.config.cashOutEnabled !== false)
        setEarningEnabled(cfgData.config.earningEnabled !== false)
        setConfigUpdatedAt(cfgData.config.updatedAt || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Vero Coins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveFinanceSwitch(patch: {
    cashOutEnabled?: boolean
    earningEnabled?: boolean
  }) {
    setConfigBusy(true)
    setError('')
    setNotice('')
    const prevCash = cashOutEnabled
    const prevEarn = earningEnabled
    if (patch.cashOutEnabled !== undefined) setCashOutEnabled(patch.cashOutEnabled)
    if (patch.earningEnabled !== undefined) setEarningEnabled(patch.earningEnabled)
    try {
      const res = await adminFetch('/api/admin/rewards/config', {
        method: 'PUT',
        body: JSON.stringify({
          cashOutEnabled: patch.cashOutEnabled ?? cashOutEnabled,
          earningEnabled: patch.earningEnabled ?? earningEnabled,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update switch')
      if (data.config) {
        setCashOutEnabled(data.config.cashOutEnabled !== false)
        setEarningEnabled(data.config.earningEnabled !== false)
        setConfigUpdatedAt(data.config.updatedAt || null)
      }
      setNotice(data.message || 'Saved.')
    } catch (err) {
      setCashOutEnabled(prevCash)
      setEarningEnabled(prevEarn)
      setError(err instanceof Error ? err.message : 'Could not update switch')
    } finally {
      setConfigBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (filter === 'with_coins' && r.coins <= 0) return false
      if (filter === 'withdrawable' && r.withdrawableMwk <= 0) return false
      if (!q) return true
      return (
        r.uid.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      )
    })
  }, [rows, query, filter])

  const cards = [
    {
      label: 'Outstanding coins',
      value: summary.totalCoins.toLocaleString(),
      sub: `${summary.usersWithCoins} users with balance · ${formatMwk(summary.totalNotionalMwk)} notional`,
    },
    {
      label: 'Withdrawable now',
      value: formatMwk(summary.totalWithdrawableMwk),
      sub: `Full ${COINS_PER_REDEEM}-coin batches ready to cash out`,
    },
    {
      label: 'Pending (not redeemable yet)',
      value: `${summary.totalPendingCoins.toLocaleString()} coins`,
      sub: `Remainder under ${COINS_PER_REDEEM} · ${formatMwk(summary.totalPendingCoins * MWK_PER_COIN)}`,
    },
    {
      label: 'Already paid to wallets',
      value: formatMwk(summary.paidOutMwk),
      sub: `${summary.paidOutCount} Vero Coin cash-out txs`,
    },
    {
      label: 'Lifetime points earned',
      value: summary.totalPoints.toLocaleString(),
      sub: '1 point = 1 coin when awarded',
    },
    {
      label: 'Spins queued',
      value: summary.totalSpinsAvailable.toLocaleString(),
      sub: `${summary.userCount} reward profiles`,
    },
  ]

  return (
    <div style={{ maxWidth: 1200 }}>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="rewards"
        description="Track points and coins users earn in the app — outstanding liability, pending vs withdrawable, and wallet cash-outs."
        actions={
          <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
        }
      />

      {rulesNote ? (
        <p
          style={{
            margin: '0 0 16px',
            padding: '10px 14px',
            borderRadius: 10,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
            color: '#9A3412',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {rulesNote}
        </p>
      ) : null}

      <div
        style={{
          marginBottom: 18,
          padding: 18,
          borderRadius: 16,
          border: cashOutEnabled ? '1px solid #BBF7D0' : '1px solid #FECACA',
          background: cashOutEnabled ? '#F0FDF4' : '#FEF2F2',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#111827' }}>
              Finance / cash-out switch
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#4B5563', lineHeight: 1.5 }}>
              Temporarily pause Vero Coin cash-outs when the app is paying out too much.
              Users keep their coins but cannot redeem to wallet until you turn it back on.
            </p>
            {configUpdatedAt ? (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6B7280' }}>
                Last changed {new Date(configUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={configBusy || loading}
            onClick={() => void saveFinanceSwitch({ cashOutEnabled: !cashOutEnabled })}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '14px 18px',
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: cashOutEnabled ? '#DC2626' : '#16A34A',
              color: '#fff',
              minWidth: 220,
            }}
          >
            {configBusy
              ? 'Updating…'
              : cashOutEnabled
                ? 'Pause cash-outs now'
                : 'Turn cash-outs back ON'}
          </button>
        </div>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: cashOutEnabled ? '#166534' : '#991B1B',
            }}
          >
            Cash-outs: {cashOutEnabled ? 'ON' : 'PAUSED'}
          </span>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: '#374151',
            }}
          >
            <input
              type="checkbox"
              checked={earningEnabled}
              disabled={configBusy}
              onChange={e => void saveFinanceSwitch({ earningEnabled: e.target.checked })}
            />
            Allow earning / spins
          </label>
        </div>
      </div>

      {notice ? (
        <p style={{ color: '#047857', fontWeight: 700, marginBottom: 12 }}>{notice}</p>
      ) : null}

      {error ? (
        <p style={{ color: '#B91C1C', marginBottom: 12 }}>{error}</p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {cards.map(c => (
          <div
            key={c.label}
            style={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 22,
                fontWeight: 800,
                color: '#111827',
                letterSpacing: -0.3,
              }}
            >
              {loading ? '…' : c.value}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#6B7280' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <DashboardSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, phone, uid…"
        />
        <select
          value={filter}
          onChange={e =>
            setFilter(e.target.value as 'all' | 'with_coins' | 'withdrawable')
          }
          style={{
            height: 40,
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            padding: '0 12px',
            background: '#fff',
            fontSize: 13,
          }}
        >
          <option value="all">All profiles</option>
          <option value="with_coins">With coins</option>
          <option value="withdrawable">Withdrawable now</option>
        </select>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          {filtered.length} shown
        </span>
      </div>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
              <th style={th}>User</th>
              <th style={th}>Coins</th>
              <th style={th}>Points</th>
              <th style={th}>Withdrawable</th>
              <th style={th}>Pending</th>
              <th style={th}>Notional</th>
              <th style={th}>Spins</th>
              <th style={th}>Last cash-out</th>
              <th style={th}>Last spin</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, color: '#6B7280' }}>
                  Loading reward profiles…
                </td>
              </tr>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, color: '#6B7280' }}>
                  No Vero Coin profiles match.
                </td>
              </tr>
            ) : null}
            {filtered.map(r => (
              <tr key={r.uid} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{r.name}</div>
                  <div style={{ color: '#6B7280', fontSize: 12 }}>{r.email}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 11 }}>{r.uid}</div>
                </td>
                <td style={td}>
                  <strong>{r.coins}</strong>
                </td>
                <td style={td}>{r.points}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#15803D' }}>
                    {formatMwk(r.withdrawableMwk)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    {r.withdrawableCoins} coins
                  </div>
                </td>
                <td style={td}>
                  {r.pendingCoins}{' '}
                  <span style={{ color: '#9CA3AF' }}>
                    ({formatMwk(r.pendingCoins * MWK_PER_COIN)})
                  </span>
                </td>
                <td style={td}>{formatMwk(r.notionalMwk)}</td>
                <td style={td}>{r.availableSpins}</td>
                <td style={td}>
                  <div>{formatDateTime(r.lastRedeemAt)}</div>
                  {r.lastRedeemMwk > 0 ? (
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      {formatMwk(r.lastRedeemMwk)} · {r.lastRedeemCoins} coins
                    </div>
                  ) : null}
                </td>
                <td style={td}>
                  <div>{formatDateTime(r.lastSpinAt)}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{r.lastSpinPrizeId}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: 0.35,
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '12px',
  verticalAlign: 'top',
  color: '#374151',
}
