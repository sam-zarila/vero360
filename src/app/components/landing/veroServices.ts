import type { VeroIconName } from './icons'
import { isAppStoreLaunched } from '@/lib/app-launch'

export const exploreServices: { icon: VeroIconName; name: string; desc: string }[] = [
  { icon: 'car', name: 'Vero Ride', desc: 'Cars, SUVs & bikes on demand' },
  { icon: 'plane', name: 'Airport Pickup', desc: 'Scheduled airport transfers' },
  { icon: 'truck', name: 'Vero Courier', desc: 'Same-day parcel delivery' },
  { icon: 'bike', name: 'Vero Bike', desc: 'Quick rides on two wheels' },
  { icon: 'food', name: 'Food', desc: 'Order from nearby restaurants' },
  { icon: 'bed', name: 'Accommodation', desc: 'Hotels, lodges & short stays' },
  { icon: 'sparkles', name: 'Digital Services', desc: 'Subs, gift cards & gaming' },
]

/** Matches Android applicationId in Vero360App. */
export const ANDROID_PACKAGE_ID = 'com.vero265.app'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`

/**
 * iOS install / open link while App Store listing is pending.
 * Opens the hosted web app so users can install from Safari / Add to Home Screen.
 */
export const IOS_WEB_APP_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IOS_WEB_APP_URL?.trim()) ||
  'https://vero360app-ca423.web.app/app/'

/**
 * App Store download link.
 * Prefer NEXT_PUBLIC_APP_STORE_URL when the live listing id is known.
 * Until then iOS CTAs open the hosted web app install page.
 */
export const APP_STORE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_STORE_URL?.trim()) ||
  IOS_WEB_APP_URL

export const appStoreLinks = {
  ios: isAppStoreLaunched() ? APP_STORE_URL : '',
  android: isAppStoreLaunched() ? PLAY_STORE_URL : '',
}

export const storeBadgeImages = {
  appStore:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/App_Store_%28iOS%29.svg/500px-App_Store_%28iOS%29.svg.png',
  googlePlay:
    'https://www.gstatic.com/marketing-cms/assets/images/15/b9/77649f194169be94fc4631a785bc/play-symbol.webp=n-w963-h543-fcrop64=1,380c0000c841ffff-rw',
}
