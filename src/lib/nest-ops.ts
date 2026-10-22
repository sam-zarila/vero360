import { nestAdminFetch } from '@/lib/nest-admin'

/**
 * Panel → Nest proxy for car-hire ops routes.
 *
 * Auth is the same as every other Nest admin call: the signed-in panel
 * Firebase token (after requirePanelAdmin) or VERO_ADMIN_API_KEY.
 * CAR_HIRE_OPS_KEY stays on vero-backend only. Nest's CarHireOpsGuard
 * accepts admin credentials and attaches the backend key itself.
 */
export async function nestOpsFetch(
  segments: Array<string | number>,
  init: RequestInit | undefined,
  panelRequest: Request,
) {
  return nestAdminFetch(segments, init, panelRequest)
}
