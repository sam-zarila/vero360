import { NextResponse } from 'next/server'
import { parsePromoList, type Promo } from '@/lib/promo'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

function userDisplayName(user: Record<string, unknown>) {
  return [
    user.businessName,
    user.merchantName,
    user.merchantBusinessName,
    user.displayName,
    user.name,
    user.fullName,
    user.username,
  ]
    .map(v => v?.toString().trim())
    .find(v => !!v && v.length > 0) ?? null
}

function userKeys(user: Record<string, unknown>) {
  return [
    user.firebaseUid,
    user.uid,
    user.merchantUid,
    user.sellerUserId,
    user.id,
    user.userId,
    user.merchantId,
  ]
    .map(v => v?.toString().trim())
    .filter((v): v is string => !!v)
}

async function enrichMerchantNames(promos: Promo[], auth: string | null) {
  if (promos.length === 0) return promos

  const byKey = new Map<string, { name?: string; email?: string }>()

  try {
    const res = await fetch(veroEndpoint('latestarrivals'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.ok) {
      const body = await readJsonSafe(res)
      const raw = Array.isArray(body)
        ? body
        : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
          ? (body as { data: unknown[] }).data
          : []

      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const merchant = (item as { merchant?: Record<string, unknown> }).merchant
        if (!merchant || typeof merchant !== 'object') continue
        const name = userDisplayName(merchant)
        const email = merchant.email?.toString().trim() || undefined
        if (!name && !email) continue
        for (const key of userKeys(merchant)) {
          const prev = byKey.get(key) || {}
          byKey.set(key, {
            name: prev.name || name || undefined,
            email: prev.email || email,
          })
        }
      }
    }
  } catch {
    // ignore
  }

  if (auth) {
    try {
      const res = await fetch(`${veroEndpoint('users')}?role=merchant`, {
        headers: { Accept: 'application/json', Authorization: auth },
        cache: 'no-store',
      })
      if (res.ok) {
        const body = await readJsonSafe(res)
        const raw = Array.isArray(body)
          ? body
          : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
            ? (body as { data: unknown[] }).data
            : []

        for (const item of raw) {
          if (!item || typeof item !== 'object') continue
          const user = item as Record<string, unknown>
          const name = userDisplayName(user)
          const email = user.email?.toString().trim() || undefined
          if (!name && !email) continue
          for (const key of userKeys(user)) {
            const prev = byKey.get(key) || {}
            byKey.set(key, {
              name: prev.name || name || undefined,
              email: prev.email || email,
            })
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return promos.map(promo => {
    const keys = [String(promo.merchantFirebaseUid || ''), String(promo.merchantId || '')].filter(Boolean)
    const match = keys.map(k => byKey.get(k)).find(Boolean)
    return {
      ...promo,
      merchantName: promo.merchantName || match?.name || null,
      merchantEmail: promo.merchantEmail || match?.email || null,
    }
  })
}

export async function GET(request: Request) {
  const auth = getVeroAuthHeader(request)
  const url = new URL(request.url)
  const scope = url.searchParams.get('scope') || 'all'

  try {
    const liveRes = await fetch(veroEndpoint('promos'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const liveBody = await readJsonSafe(liveRes)
    if (!liveRes.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(liveBody, 'Failed to load promotions') },
        { status: liveRes.status },
      )
    }

    const byId = new Map<number, Promo>()
    for (const p of parsePromoList(liveBody)) byId.set(p.id, p)

    if (auth) {
      const meRes = await fetch(veroEndpoint('promos', 'me'), {
        headers: {
          Accept: 'application/json',
          Authorization: auth,
        },
        cache: 'no-store',
      })
      if (meRes.ok) {
        const meBody = await readJsonSafe(meRes)
        for (const p of parsePromoList(meBody)) byId.set(p.id, p)
      }
    }

    let promos = await enrichMerchantNames(Array.from(byId.values()), auth)
    promos = promos.sort((a, b) => b.id - a.id)

    const all = promos
    if (scope === 'live') promos = promos.filter(p => p.isActive)
    if (scope === 'inactive') promos = promos.filter(p => !p.isActive)

    return NextResponse.json({
      success: true,
      promos,
      counts: {
        all: all.length,
        live: all.filter(p => p.isActive).length,
        inactive: all.filter(p => !p.isActive).length,
      },
    })
  } catch (err) {
    console.error('Admin promos GET error:', err)
    return NextResponse.json({ error: 'Could not reach promo API' }, { status: 502 })
  }
}
