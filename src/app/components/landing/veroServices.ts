import type { VeroIconName } from './icons'
import { isAppStoreLaunched } from '@/lib/app-launch'

export const exploreServices: { icon: VeroIconName; name: string; desc: string }[] = [
  { icon: 'car', name: 'Vero Ride', desc: 'Cars, SUVs & bikes on demand' },
  { icon: 'plane', name: 'Airport Pickup', desc: 'Scheduled airport transfers' },
  { icon: 'truck', name: 'Vero Courier', desc: 'Same-day parcel delivery' },
  { icon: 'bike', name: 'Vero Bike', desc: 'Quick rides on two wheels' },
  { icon: 'food', name: 'Food', desc: 'Order from nearby restaurants' },
  { icon: 'bed', name: 'Accommodation', desc: 'Hotels, lodges & short stays' },
]

/** Matches Android applicationId in Vero360App. */
export const ANDROID_PACKAGE_ID = 'com.vero265.app'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`

/**
 * App Store URL — leave empty until the iOS listing is live.
 * Empty/hash hides the App Store button so we never show “not available”.
 */
export const APP_STORE_URL = ''

export const appStoreLinks = {
  ios: isAppStoreLaunched() && APP_STORE_URL ? APP_STORE_URL : '',
  android: isAppStoreLaunched() ? PLAY_STORE_URL : '',
}

export const storeBadgeImages = {
  appStore:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/App_Store_%28iOS%29.svg/500px-App_Store_%28iOS%29.svg.png',
  googlePlay:
    'https://www.gstatic.com/marketing-cms/assets/images/15/b9/77649f194169be94fc4631a785bc/play-symbol.webp=n-w963-h543-fcrop64=1,380c0000c841ffff-rw',
}
