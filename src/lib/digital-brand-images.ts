/** Shared brand image map for digital services (catalog + detail). */
export const DIGITAL_BRAND_IMAGES: Record<string, string> = {
  spotify: '/brands/spotify.jpg',
  apple_music: '/brands/apple_music.png',
  netflix: '/brands/netflix.png',
  chatgpt_plus: '/brands/chatgpt.png',
  visa_gc: '/brands/visa.svg',
  paypal_gc: '/brands/paypal.svg',
  mastercard_gc: '/brands/mastercard.svg',
  amazon_gc: '/brands/amazon.svg',
  itunes: '/brands/apple_gift.svg',
  steam_gc: '/brands/steam.svg',
  google_play: '/brands/google_play.svg',
  playstation: '/brands/playstation.svg',
  xbox: '/brands/xbox.svg',
  eneba: '/brands/eneba.svg',
}

export function digitalBrandImage(key: string): string | null {
  return DIGITAL_BRAND_IMAGES[key] || null
}
