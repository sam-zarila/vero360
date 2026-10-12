/** Client-safe Vero Coin rules + types (no firebase-admin). */

/** Mirror of Flutter `VeroRewardsService` cash-out rules. */
export const MWK_PER_COIN = 50
/** Cash-out opens at this MWK value. The gate is money, not a coin count. */
export const MIN_CASH_OUT_MWK = 1000
export const MWK_PER_REDEEM = MIN_CASH_OUT_MWK
/** Coins that equal [MIN_CASH_OUT_MWK]. Informational only. */
export const COINS_PER_REDEEM = Math.ceil(MIN_CASH_OUT_MWK / MWK_PER_COIN)
/** Jackpot ceiling (coins) — MWK 5,000 / MWK 50. */
export const MAX_SPIN_COINS = 100
export const MAX_SPIN_MWK = MAX_SPIN_COINS * MWK_PER_COIN // 5,000

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
  /** Coins that can be cashed out now (full balance once it is worth MWK 1,000). */
  withdrawableCoins: number
  /** MWK user can redeem now. */
  withdrawableMwk: number
  /** Coins still under the MWK 1,000 minimum. */
  pendingCoins: number
  /** Notional liability if every coin were valued at MWK 50. */
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
  /** Cash-out ready now (MWK), for balances worth at least MWK 1,000. */
  totalWithdrawableMwk: number
  /** Coins still under the MWK 1,000 minimum. */
  totalPendingCoins: number
  /** All outstanding coins × MWK 50 (liability ceiling). */
  totalNotionalMwk: number
  /** Sum of lastRedeemMwk on docs (partial — prefer paidOutMwk). */
  totalLastRedeemMwk: number
  /** Credited to wallets from Vero Coin cash-outs (ledger). */
  paidOutMwk: number
  paidOutCount: number
}
