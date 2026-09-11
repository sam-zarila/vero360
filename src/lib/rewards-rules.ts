/** Client-safe Vero Coin rules + types (no firebase-admin). */

/** Mirror of Flutter `VeroRewardsService` cash-out rules. */
export const COINS_PER_REDEEM = 10
export const MWK_PER_COIN = 50
export const MWK_PER_REDEEM = COINS_PER_REDEEM * MWK_PER_COIN // 500
/** Jackpot ceiling (coins) — MWK 10,000 / MWK 50. */
export const MAX_SPIN_COINS = 200
export const MAX_SPIN_MWK = MAX_SPIN_COINS * MWK_PER_COIN // 10,000

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
  /** Coins that can be cashed out now (multiples of 10). */
  withdrawableCoins: number
  /** MWK user can redeem now. */
  withdrawableMwk: number
  /** Coins waiting for the next full 10-coin batch. */
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
  /** Full cash-out batches ready now (MWK). */
  totalWithdrawableMwk: number
  /** Coins not yet in a redeemable batch of 10. */
  totalPendingCoins: number
  /** All outstanding coins × MWK 50 (liability ceiling). */
  totalNotionalMwk: number
  /** Sum of lastRedeemMwk on docs (partial — prefer paidOutMwk). */
  totalLastRedeemMwk: number
  /** Credited to wallets from Vero Coin cash-outs (ledger). */
  paidOutMwk: number
  paidOutCount: number
}
