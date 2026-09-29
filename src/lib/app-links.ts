/** Android package / iOS bundle id for Vero360. */
export const ANDROID_PACKAGE_ID = 'com.vero265.app'
export const IOS_BUNDLE_ID = 'com.vero265.app'

/** Upload keystore SHA-256 (colon form). Play App Signing SHA can be added via env. */
export const ANDROID_UPLOAD_SHA256 =
  '68:95:4D:53:4D:4E:1A:9A:21:C4:D7:2A:D9:66:E3:BF:7F:E2:36:76:41:01:3F:04:AE:CA:1F:E7:C4:1B:C8:AF'

export function androidSha256Fingerprints(): string[] {
  const extra = (process.env.ANDROID_APP_LINK_SHA256 || '')
    .split(/[,;\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
  const upload = ANDROID_UPLOAD_SHA256.toUpperCase()
  return [...new Set([upload, ...extra])]
}

/** Apple Developer Team ID (10 chars). Required for Universal Links. */
export function appleTeamId(): string {
  return (
    process.env.APPLE_TEAM_ID?.trim() ||
    process.env.NEXT_PUBLIC_APPLE_TEAM_ID?.trim() ||
    ''
  )
}

export function appleAppId(): string {
  const team = appleTeamId()
  return team ? `${team}.${IOS_BUNDLE_ID}` : `TEAMID.${IOS_BUNDLE_ID}`
}

/** Numeric App Store id when known (Smart Banner + Facebook al:ios:app_store_id). */
export function appleAppStoreId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_IOS_APP_STORE_ID?.trim()
  if (fromEnv) return fromEnv
  const url = process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || ''
  const m = url.match(/id(\d+)/i)
  return m?.[1] || ''
}

export function customSchemeHref(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `vero360://${clean}`
}

/**
 * Android Intent URL: opens the app if installed, otherwise falls back to [webUrl].
 * Works better than custom schemes inside many Android browsers / Facebook WebViews.
 */
export function androidIntentHref(appPath: string, webUrl: string): string {
  const path = appPath.replace(/^\/+/, '')
  const fallback = encodeURIComponent(webUrl)
  return (
    `intent://${path}#Intent;` +
    `scheme=vero360;` +
    `package=${ANDROID_PACKAGE_ID};` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  )
}
