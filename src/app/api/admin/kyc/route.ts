import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import { countKyc, kycVolume, parseKycVerification } from '@/lib/kyc-admin'
import { USERS_COLLECTION } from '@/lib/users'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const db = getAdminDb()
    const snap = await db.collection(USERS_COLLECTION).get()
    const verifications = snap.docs
      .map(docSnap => parseKycVerification(docSnap.id, docSnap.data() as Record<string, unknown>))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => {
        const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        if (bt !== at) return bt - at
        return a.id.localeCompare(b.id)
      })

    return NextResponse.json({
      success: true,
      verifications,
      counts: countKyc(verifications),
      volume: kycVolume(verifications),
    })
  } catch (err) {
    console.error('Admin KYC GET error:', err)
    const message = err instanceof Error ? err.message : 'Could not load KYC verifications'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
