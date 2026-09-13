import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  getPromotePackagesConfig,
  savePromotePackagesConfig,
  type PromotePackageConfig,
} from '@/lib/promote-packages-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const config = await getPromotePackagesConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin promote-packages pricing GET:', err)
    return NextResponse.json({ error: 'Failed to load promote prices' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      packages?: PromotePackageConfig[]
    } | null

    if (!body || !Array.isArray(body.packages)) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await savePromotePackagesConfig({
      packages: body.packages,
      updatedByEmail: admin.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: 'Promote package prices saved. Merchants see them on next open/refresh.',
    })
  } catch (err) {
    console.error('Admin promote-packages pricing PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save promote prices' },
      { status: 500 },
    )
  }
}
