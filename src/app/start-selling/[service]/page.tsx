import { notFound } from 'next/navigation'
import { SignupGuidePage } from '@/app/components/landing/SignupGuidePage'
import { isSellBannerAudience, parseSellBannerAudience } from '@/lib/sell-banners'

type Props = { params: Promise<{ service: string }> }

export default async function StartSellingServicePage({ params }: Props) {
  const { service } = await params
  const key = service.trim().toLowerCase()
  if (key === 'driver') {
    notFound()
  }
  if (!isSellBannerAudience(key) && key !== 'restaurant' && key !== 'restaurants' && key !== 'stay') {
    notFound()
  }
  const audience = parseSellBannerAudience(key)
  if (audience === 'driver') notFound()
  return <SignupGuidePage audience={audience} />
}
