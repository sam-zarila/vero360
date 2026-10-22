import localFont from 'next/font/local'

/** Vendored so `next build` does not fetch Google Fonts (Netlify flake). */
export const inter = localFont({
  src: './fonts/inter-latin.woff2',
  variable: '--font-body',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
})

export const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans-latin.woff2',
  variable: '--font-display',
  weight: '200 800',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
})
