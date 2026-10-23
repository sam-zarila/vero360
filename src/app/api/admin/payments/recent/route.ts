import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  adminHrefForBankSource,
  bankSourceLabel,
} from '@/lib/bank-transfer-enrich'
import { isBankTransferPending, listBankTransferPayments } from '@/lib/bank-transfer-payments'
import { isDigitalOrderPaid } from '@/lib/digital-services'
import { listDigitalServiceOrders } from '@/lib/digital-services-admin'
import { listHomepageAdverts } from '@/lib/homepage-adverts-admin'
import { isPromotionPaid } from '@/lib/marketplace-promotions'
import { listMarketplacePromotions } from '@/lib/marketplace-promotions-admin'

export const dynamic = 'force-dynamic'

/**
 * Lightweight poll for newly paid digital services + homepage ads
 * (admin badges / browser notifications).
 */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const [digitalAll, adsAll, promoAll, bankAll] = await Promise.all([
      listDigitalServiceOrders({ limit: 200 }),
      listHomepageAdverts({ limit: 200 }),
      listMarketplacePromotions(80),
      listBankTransferPayments(80),
    ])

    const digital = digitalAll
      .filter(o => o.amountMwk > 0 && isDigitalOrderPaid(o))
      .sort((a, b) => {
        const at = a.paidAt ? new Date(a.paidAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.paidAt ? new Date(b.paidAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
      .slice(0, 40)
      .map(o => ({
        id: o.id,
        kind: 'digital' as const,
        title: o.productName,
        amountMwk: o.amountMwk,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        paidAt: o.paidAt || o.createdAt,
      }))

    const homepageAds = adsAll
      .filter(
        a =>
          a.amountPaid > 0 &&
          (a.status === 'active' || Boolean(a.paidAt) || a.platformFeeCredited),
      )
      .sort((a, b) => {
        const at = a.paidAt ? new Date(a.paidAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.paidAt ? new Date(b.paidAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
      .slice(0, 40)
      .map(a => ({
        id: a.id,
        kind: 'homepage_ad' as const,
        title: a.title,
        amountMwk: a.amountPaid,
        buyerName: a.ownerName,
        buyerEmail: a.ownerEmail,
        paidAt: a.paidAt || a.createdAt,
      }))

    const promotions = promoAll
      .filter(p => p.amountMwk > 0 && isPromotionPaid(p))
      .slice(0, 40)
      .map(p => ({
        id: p.id,
        kind: 'promotion' as const,
        title: p.itemName,
        amountMwk: p.amountMwk,
        buyerName: p.merchantName,
        buyerEmail: '',
        paidAt: p.paidAt || p.createdAt,
      }))

    const pendingBank = bankAll.filter(p => isBankTransferPending(p.status))
    const bankTransfers = pendingBank.slice(0, 40).map(p => ({
      id: p.id,
      kind: 'bank_transfer' as const,
      title: p.title,
      amountMwk: p.amountMwk,
      buyerName: p.buyerName,
      buyerEmail: p.buyerEmail,
      paidAt: p.createdAt,
      source: p.source,
      href: '/dashboard/bank-transfers',
      sourceLabel: bankSourceLabel(p.source),
    }))

    return NextResponse.json({
      success: true,
      digital,
      homepageAds,
      promotions,
      bankTransfers,
      digitalIds: digital.map(d => d.id),
      homepageAdIds: homepageAds.map(a => a.id),
      promotionIds: promotions.map(p => p.id),
      bankTransferIds: bankTransfers.map(p => p.id),
      digitalCount: digital.length,
      homepageAdCount: homepageAds.length,
      promotionCount: promotions.length,
      bankTransferCount: bankTransfers.length,
      latestDigital: digital[0] || null,
      latestHomepageAd: homepageAds[0] || null,
      latestPromotion: promotions[0] || null,
      latestBankTransfer: bankTransfers[0] || null,
    })
  } catch (err) {
    console.error('Admin payments recent GET:', err)
    return NextResponse.json({ error: 'Could not load recent payments' }, { status: 502 })
  }
}
