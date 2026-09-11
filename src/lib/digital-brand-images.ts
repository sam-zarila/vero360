import { formatMwk } from '@/lib/vero-api'

/** Shared brand image map for digital services (catalog + detail). */
export const DIGITAL_BRAND_IMAGES: Record<string, string> = {
  spotify: '/brands/spotify.svg',
  apple_music: '/brands/apple_music.svg',
  netflix: '/brands/netflix.svg',
  chatgpt_plus: '/brands/chatgpt.svg',
  visa_gc: '/brands/visa.svg',
  paypal_gc: '/brands/paypal.svg',
  mastercard_gc: '/brands/mastercard.svg',
  amazon_gc: '/brands/amazon.svg',
  itunes: '/brands/apple_gift.svg',
  steam_gc: '/brands/steam.svg',
  google_play: '/brands/google_play.svg',
  playstation: '/brands/playstation.svg',
  xbox: '/brands/xbox.svg',
  eneba: '/brands/eneba.svg',
}

export function digitalBrandImage(key: string): string | null {
  return DIGITAL_BRAND_IMAGES[key] || null
}

export function formatDigitalPriceLabel(opts: {
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  usdToMwkRate: number
  isSubscription: boolean
}): {
  priceLabel: string | null
  amountsLabel: string | null
  rateLabel: string | null
} {
  const rate = Math.max(1, opts.usdToMwkRate || 4700)
  if (opts.isSubscription && opts.fixedMwkPrice && opts.fixedMwkPrice > 0) {
    return {
      priceLabel: formatMwk(opts.fixedMwkPrice),
      amountsLabel: '1-month subscription',
      rateLabel: null,
    }
  }
  const amounts = (opts.usdAmounts || []).filter(n => n > 0)
  if (!amounts.length) {
    if (opts.fixedMwkPrice && opts.fixedMwkPrice > 0) {
      return {
        priceLabel: formatMwk(opts.fixedMwkPrice),
        amountsLabel: null,
        rateLabel: null,
      }
    }
    return { priceLabel: null, amountsLabel: null, rateLabel: null }
  }
  const fromMwk = Math.round(amounts[0] * rate)
  return {
    priceLabel: `From ${formatMwk(fromMwk)}`,
    amountsLabel: `USD options: ${amounts.map(a => `$${a}`).join(', ')}`,
    rateLabel: `Approx. MWK at ${formatMwk(rate)} per USD`,
  }
}
