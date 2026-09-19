import { listPublicSellBanners } from '@/lib/sell-banners-admin'
import SellBannerClient, { type SellBannerSlide } from './SellBannerClient'

const FALLBACK: SellBannerSlide = {
  id: 'fallback',
  title: 'Start selling on Vero360',
  body:
    'Create a merchant account in the Vero360 app, list your products or services, and reach customers across Malawi.',
  ctaLabel: 'Sell now',
  imageUrl: null,
  audience: 'marketplace',
}

/** Public sell banners from admin (`sell_banners`) — slides like the mobile app. */
export default async function SellBannerSection() {
  const banners = await listPublicSellBanners(12)
  const slides: SellBannerSlide[] =
    banners.length > 0
      ? banners.map(b => ({
          id: b.id,
          title: b.title,
          body: b.body,
          ctaLabel: b.ctaLabel,
          imageUrl: b.imageUrl,
          audience: b.audience,
        }))
      : [FALLBACK]

  return (
    <section
      id="sell"
      style={{
        padding: '28px 24px',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <SellBannerClient banners={slides} />
    </section>
  )
}
