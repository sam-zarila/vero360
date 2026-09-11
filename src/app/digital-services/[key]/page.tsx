import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DigitalServiceView, {
  formatDigitalPriceLabel,
} from '@/app/components/open-listing/DigitalServiceView'
import { getDigitalServicesConfig } from '@/lib/digital-services-config'
import { digitalBrandImage } from '@/lib/digital-brand-images'

type Props = { params: Promise<{ key: string }> }

function categoryLabel(category: string): string {
  const c = category.trim().toLowerCase()
  if (c === 'streaming' || c === 'subscription') return 'Subscription'
  if (c === 'gaming') return 'Gaming'
  if (c === 'gift_cards') return 'Gift card'
  return 'Digital'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params
  const config = await getDigitalServicesConfig()
  const product = config.products.find(p => p.key === key && p.active !== false)
  if (!product) return { title: 'Digital Service · Vero360' }
  return {
    title: `${product.name} · Buy · Vero360`,
    description: product.subtitle || `Buy ${product.name} on Vero360`,
  }
}

export default async function DigitalServiceDetailPage({ params }: Props) {
  const { key } = await params
  const config = await getDigitalServicesConfig()
  const product = config.products.find(p => p.key === key && p.active !== false)
  if (!product) notFound()

  const fixed =
    typeof product.fixedMwkPrice === 'number' && product.fixedMwkPrice > 0
      ? Math.round(product.fixedMwkPrice)
      : null
  const isFixedPrice = fixed != null
  const labels = formatDigitalPriceLabel({
    fixedMwkPrice: fixed,
    usdAmounts: product.usdAmounts,
    usdToMwkRate: config.usdToMwkRate,
    isSubscription: isFixedPrice,
  })

  return (
    <DigitalServiceView
      product={{
        key: product.key,
        name: product.name,
        subtitle: product.subtitle || null,
        categoryLabel: categoryLabel(product.category),
        brandTag: product.brandTag || null,
        image: digitalBrandImage(product.key),
        priceLabel: labels.priceLabel,
        amountsLabel: labels.amountsLabel,
        rateLabel: labels.rateLabel,
        fixedMwkPrice: fixed,
        usdAmounts: product.usdAmounts || [],
        usdToMwkRate: config.usdToMwkRate,
        isFixedPrice,
      }}
    />
  )
}
