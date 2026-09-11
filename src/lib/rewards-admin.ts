import { getAdminDb } from '@/lib/firebase-admin'
import { USERS_COLLECTION } from '@/lib/users'
import { WALLET_TX_COLLECTION } from '@/lib/finance'

export const VERO_REWARDS_COLLECTION = 'vero_rewards'

/** Mirror of Flutter `VeroRewardsService` cash-out rules. */
export const COINS_PER_REDEEM = 5
export const MWK_PER_COIN = 100
export const MWK_PER_REDEEM = COINS_PER_REDEEM * MWK_PER_COIN // 1,000

export type RewardsUserRow = {
  uid: string
  name: string
  email: string
  phone: string
  coins: number
  points: number
  availableSpins: number
  visitPointsThisWeek: number
  visitCountToday: number
  /** Coins that can be cashed out now (multiples of 5). */
  withdrawableCoins: number
  /** MWK user can redeem now. */
  withdrawableMwk: number
  /** Coins waiting for the next full 5-coin batch. */
  pendingCoins: number
  /** Notional liability if every coin were valued at MWK 100. */
  notionalMwk: number
  lastRedeemAt: string | null
  lastRedeemMwk: number
  lastRedeemCoins: number
  lastSpinAt: string | null
  lastSpinPrizeId: string
  updatedAt: string | null
  createdAt: string | null
}

export type RewardsSummary = {
  userCount: number
  usersWithCoins: number
  totalCoins: number
  totalPoints: number
  totalSpinsAvailable: number
  /** Full cash-out batches ready now (MWK). */
  totalWithdrawableMwk: number
  /** Coins not yet in a redeemable batch of 5. */
  totalPendingCoins: number
  /** All outstanding coins × MWK 100 (liability ceiling). */
  totalNotionalMwk: number
  /** Sum of lastRedeemMwk on docs (partial — prefer paidOutMwk). */
  totalLastRedeemMwk: number
  /** Credited to wallets from Vero Coin cash-outs (ledger). */
  paidOutMwk: number
  paidOutCount: number
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null) {
    const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number }
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate().toISOString()
      } catch {
        /* fall through */
      }
    }
    const sec = typeof v.seconds === 'number' ? v.seconds : v._seconds
    if (typeof sec === 'number') return new Date(sec * 1000).toISOString()
  }
  return null
}

export function deriveCoinBuckets(coinsRaw: number) {
  const coins = Math.max(0, Math.floor(coinsRaw))
  const batches = Math.floor(coins / COINS_PER_REDEEM)
  const withdrawableCoins = batches * COINS_PER_REDEEM
  return {
    coins,
    withdrawableCoins,
    withdrawableMwk: batches * MWK_PER_REDEEM,
    pendingCoins: coins % COINS_PER_REDEEM,
    notionalMwk: coins * MWK_PER_COIN,
  }
}

export function parseRewardsDoc(
  uid: string,
  data: Record<string, unknown>,
  profile?: { name?: string; email?: string; phone?: string },
): RewardsUserRow {
  const coins = Math.max(0, Math.floor(num(data.coins)))
  const buckets = deriveCoinBuckets(coins)
  return {
    uid,
    name: profile?.name || str(data.name) || '—',
    email: profile?.email || str(data.email) || '—',
    phone: profile?.phone || str(data.phone) || '—',
    coins: buckets.coins,
    points: Math.max(0, Math.floor(num(data.points))),
    availableSpins: Math.max(0, Math.floor(num(data.availableSpins))),
    visitPointsThisWeek: Math.max(0, Math.floor(num(data.visitPointsThisWeek))),
    visitCountToday: Math.max(0, Math.floor(num(data.visitCountToday))),
    withdrawableCoins: buckets.withdrawableCoins,
    withdrawableMwk: buckets.withdrawableMwk,
    pendingCoins: buckets.pendingCoins,
    notionalMwk: buckets.notionalMwk,
    lastRedeemAt: tsToIso(data.lastRedeemAt),
    lastRedeemMwk: Math.max(0, num(data.lastRedeemMwk)),
    lastRedeemCoins: Math.max(0, Math.floor(num(data.lastRedeemCoins))),
    lastSpinAt: tsToIso(data.lastSpinAt),
    lastSpinPrizeId: str(data.lastSpinPrizeId) || '—',
    updatedAt: tsToIso(data.updatedAt),
    createdAt: tsToIso(data.createdAt),
  }
}

export function summarizeRewards(
  rows: RewardsUserRow[],
  payout: { paidOutMwk: number; paidOutCount: number },
): RewardsSummary {
  let totalCoins = 0
  let totalPoints = 0
  let totalSpinsAvailable = 0
  let totalWithdrawableMwk = 0
  let totalPendingCoins = 0
  let totalNotionalMwk = 0
  let totalLastRedeemMwk = 0
  let usersWithCoins = 0

  for (const r of rows) {
    totalCoins += r.coins
    totalPoints += r.points
    totalSpinsAvailable += r.availableSpins
    totalWithdrawableMwk += r.withdrawableMwk
    totalPendingCoins += r.pendingCoins
    totalNotionalMwk += r.notionalMwk
    totalLastRedeemMwk += r.lastRedeemMwk
    if (r.coins > 0) usersWithCoins += 1
  }

  return {
    userCount: rows.length,
    usersWithCoins,
    totalCoins,
    totalPoints,
    totalSpinsAvailable,
    totalWithdrawableMwk,
    totalPendingCoins,
    totalNotionalMwk,
    totalLastRedeemMwk,
    paidOutMwk: payout.paidOutMwk,
    paidOutCount: payout.paidOutCount,
  }
}

async function loadUserProfiles(uids: string[]) {
  const db = getAdminDb()
  const map = new Map<string, { name: string; email: string; phone: string }>()
  const unique = [...new Set(uids.filter(Boolean))]

  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30)
    await Promise.all(
      chunk.map(async uid => {
        try {
          const snap = await db.collection(USERS_COLLECTION).doc(uid).get()
          if (!snap.exists) return
          const d = snap.data() as Record<string, unknown>
          const name =
            str(d.name) ||
            str(d.displayName) ||
            str(d.fullName) ||
            str(d.businessName) ||
            '—'
          const email = str(d.email) || '—'
          const phone = str(d.phone) || str(d.phoneNumber) || '—'
          map.set(uid, { name, email, phone })
        } catch {
          /* skip */
        }
      }),
    )
  }
  return map
}

async function loadVeroCoinPayouts() {
  const db = getAdminDb()
  let paidOutMwk = 0
  let paidOutCount = 0
  try {
    const snap = await db.collection(WALLET_TX_COLLECTION).limit(2500).get()
    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, unknown>
      const ref = str(d.reference)
      const desc = str(d.description) || str(d.desc)
      const isVeroCoin =
        ref.toUpperCase().startsWith('VERO_COIN') ||
        desc.toLowerCase().includes('vero coin')
      if (!isVeroCoin) continue
      const amount = Math.abs(num(d.amount))
      if (amount <= 0) continue
      paidOutMwk += amount
      paidOutCount += 1
    }
  } catch (err) {
    console.warn('[rewards-admin] wallet_transactions scan failed:', err)
  }
  return { paidOutMwk, paidOutCount }
}

export async function listRewardsAdmin(limit = 2000) {
  const db = getAdminDb()
  const snap = await db.collection(VERO_REWARDS_COLLECTION).limit(limit).get()
  const uids = snap.docs.map(d => d.id)
  const [profiles, payout] = await Promise.all([
    loadUserProfiles(uids),
    loadVeroCoinPayouts(),
  ])

  const rows = snap.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>
    const profile = profiles.get(doc.id)
    return parseRewardsDoc(doc.id, data, profile)
  })

  rows.sort((a, b) => {
    if (b.coins !== a.coins) return b.coins - a.coins
    if (b.points !== a.points) return b.points - a.points
    return a.uid.localeCompare(b.uid)
  })

  return {
    rows,
    summary: summarizeRewards(rows, payout),
  }
}
