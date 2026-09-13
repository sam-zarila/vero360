'use client'

import { useEffect, useRef } from 'react'
import { ANDROID_PACKAGE_ID, androidIntentHref } from '@/lib/app-links'

type Props = {
  /** Custom scheme, e.g. vero360://marketplace/abc */
  appHref: string
  /** Canonical https listing URL (fallback when app is missing). */
  webUrl: string
}

/**
 * On mobile, try to hand off to the native app.
 * - Android: Intent URL with browser_fallback_url → website if not installed.
 * - iOS: custom scheme attempt; if the app is missing, user stays on this page.
 *
 * Verified App Links / Universal Links still open the app directly when the OS
 * can verify them; this bridge covers Facebook in-app browser + unverified cases.
 */
export default function OpenAppBridge({ appHref, webUrl }: Props) {
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current) return
    if (typeof window === 'undefined') return

    const ua = navigator.userAgent || ''
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    if (!isAndroid && !isIOS) return

    // Skip desktop-ish tablets in landscape if needed — keep simple: phones only.
    if (window.matchMedia('(min-width: 900px)').matches) return

    tried.current = true

    const pathFromScheme = (() => {
      try {
        const u = new URL(appHref)
        // vero360://marketplace/id → marketplace/id
        const host = u.host || ''
        const rest = u.pathname.replace(/^\/+/, '')
        return [host, rest].filter(Boolean).join('/')
      } catch {
        return appHref.replace(/^vero360:\/\//i, '').replace(/^\/+/, '')
      }
    })()

    if (isAndroid) {
      const intent = androidIntentHref(pathFromScheme, webUrl)
      // Prefer Intent (package-scoped). If Facebook blocks it, custom scheme is backup.
      window.location.href = intent
      return
    }

    // iOS: attempt custom scheme. Universal Links should already have opened the
    // app when verified; this helps when Facebook opens the https page in WebView.
    const start = Date.now()
    const visibilityHandler = () => {
      if (document.hidden) {
        // App likely took over — stop listening.
        document.removeEventListener('visibilitychange', visibilityHandler)
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    window.location.href = appHref

    // If still here after ~1.2s, user likely has no app — remain on website.
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', visibilityHandler)
      if (!document.hidden && Date.now() - start < 2000) {
        // Stay on web — no redirect to store (user asked: no app → website).
      }
    }, 1200)
  }, [appHref, webUrl])

  // Hidden marker for debugging / future analytics.
  return (
    <span
      data-open-app-bridge={ANDROID_PACKAGE_ID}
      data-app-href={appHref}
      style={{ display: 'none' }}
      aria-hidden
    />
  )
}
