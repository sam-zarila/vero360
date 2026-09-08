import { listAgentRegistrations } from '@/lib/agent-registrations-admin'
import { formatPhoneE164 } from '@/lib/agent-registrations'
import { parseDriversResponse, type FleetDriver } from '@/lib/drivers'
import type { PanelAdmin } from '@/lib/admins'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { nestAdminFetch } from '@/lib/nest-admin'

function phoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

function emailsMatch(a: string, b: string) {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (!x || !y) return false
  if (x === y) return true
  if (x.endsWith('@phone.vero360.app') || y.endsWith('@phone.vero360.app')) {
    return phoneDigits(x.split('@')[0] || '') === phoneDigits(y.split('@')[0] || '')
  }
  return false
}

function phonesMatch(a: string, b: string) {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  if (!da || !db) return false
  if (da === db) return true
  return da.slice(-9) === db.slice(-9)
}

export function driverMatchesAgentRegistration(
  driver: FleetDriver,
  reg: { email: string; phone: string },
) {
  if (reg.email && driver.email && emailsMatch(reg.email, driver.email)) return true
  if (reg.phone && driver.phone && phonesMatch(reg.phone, driver.phone)) return true
  if (reg.phone && driver.email?.includes('@phone.vero360.app')) {
    const digits = phoneDigits(driver.email.split('@')[0] || '')
    if (digits && phonesMatch(reg.phone, digits)) return true
  }
  return false
}

/** Agents may only act on drivers they onboarded; admins may act on any. */
export async function assertCanManageFleetDriver(
  actor: { uid: string; admin: PanelAdmin },
  driver: FleetDriver,
) {
  if (isFullAdminRole(actor.admin.role)) return
  if (!isAgentRole(actor.admin.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }

  const regs = await listAgentRegistrations({ agentUid: actor.uid })
  const mine = regs
    .filter(r => r.role === 'driver')
    .map(r => ({
      email: r.email,
      phone: r.phone ? formatPhoneE164(r.phone) : r.phone,
    }))

  const allowed = mine.some(reg => driverMatchesAgentRegistration(driver, reg))
  if (!allowed) {
    throw Object.assign(
      new Error('You can only verify drivers you registered'),
      { status: 403 },
    )
  }
}

/** Resolve the fleet driver that owns a taxi, then apply the same ownership gate. */
export async function assertCanManageFleetTaxi(
  actor: { uid: string; admin: PanelAdmin },
  taxiId: string | number,
  request?: Request,
) {
  if (isFullAdminRole(actor.admin.role)) return

  const { res, body, error } = await nestAdminFetch(
    ['admin', 'drivers?skip=0&take=500'],
    undefined,
    request,
  )
  if (!res.ok) {
    throw Object.assign(new Error(error || 'Could not load drivers'), {
      status: res.status || 502,
    })
  }

  const id = Number(taxiId)
  const driver = parseDriversResponse(body).drivers.find(d =>
    d.taxis.some(t => t.id === id),
  )
  if (!driver) {
    throw Object.assign(new Error('Taxi not found'), { status: 404 })
  }
  await assertCanManageFleetDriver(actor, driver)
}
