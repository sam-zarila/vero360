/** Client-safe URL helpers — no firebase-admin imports. */

/** Same public path the Flutter app shares: /merchant/{id} → admin preview */
export function merchantStorePath(merchantId: string): string {
  const id = merchantId.trim()
  if (!id) return '/dashboard/merchant-reports'
  return `/dashboard/merchant/${encodeURIComponent(id)}`
}

export function merchantStoreAbsoluteUrl(
  merchantId: string,
  origin = 'https://vero360.app',
): string {
  const path = merchantStorePath(merchantId)
  return `${origin.replace(/\/$/, '')}${path}`
}
