/** Lilongwe geocode helpers for Vero Courier fare estimates (Nominatim + landmarks). */

export type CourierLatLng = { lat: number; lng: number; label?: string }

/** Approximate GPS box for Lilongwe metro (matches Flutter CourierCityHelper). */
export function isInLilongweBounds(lat: number, lng: number): boolean {
  return lat >= -14.22 && lat <= -13.72 && lng >= 33.5 && lng <= 34.18
}

const LILONGWE_LANDMARKS: Record<string, CourierLatLng> = {
  'area 3': { lat: -13.9833, lng: 33.7875 },
  'area 6': { lat: -13.975, lng: 33.785 },
  'area 9': { lat: -13.968, lng: 33.79 },
  'area 10': { lat: -13.962, lng: 33.787 },
  'area 12': { lat: -13.955, lng: 33.78 },
  'area 15': { lat: -13.958, lng: 33.77 },
  'area 18': { lat: -13.95, lng: 33.76 },
  'area 22': { lat: -13.945, lng: 33.775 },
  'area 25': { lat: -13.94, lng: 33.78 },
  'area 43': { lat: -14.0, lng: 33.75 },
  'area 47': { lat: -14.02, lng: 33.78 },
  'area 49': { lat: -14.03, lng: 33.785 },
  'city centre': { lat: -13.983, lng: 33.774 },
  'city center': { lat: -13.983, lng: 33.774 },
  'old town': { lat: -13.989, lng: 33.77 },
  'capital hill': { lat: -13.967, lng: 33.789 },
  kanengo: { lat: -13.92, lng: 33.74 },
  kawale: { lat: -13.99, lng: 33.8 },
  falls: { lat: -14.02, lng: 33.77 },
  crossroads: { lat: -13.97, lng: 33.78 },
  gateway: { lat: -13.96, lng: 33.79 },
  'gateway mall': { lat: -13.96, lng: 33.79 },
  bunda: { lat: -14.17, lng: 33.77 },
  'kamuzu central': { lat: -13.978, lng: 33.787 },
  'kamuzu international': { lat: -13.789, lng: 33.781 },
  airport: { lat: -13.789, lng: 33.781 },
  lilongwe: { lat: -13.9626, lng: 33.7741 },
}

export function landmarkPoint(label: string): CourierLatLng | null {
  const t = label.toLowerCase().trim()
  if (!t) return null
  const areaMatch = /\barea\s*(\d+)\b/.exec(t)
  if (areaMatch) {
    const hit = LILONGWE_LANDMARKS[`area ${areaMatch[1]}`]
    if (hit) return { ...hit, label }
  }
  for (const [key, point] of Object.entries(LILONGWE_LANDMARKS)) {
    if (key === 'lilongwe') continue
    if (t.includes(key)) return { ...point, label }
  }
  return null
}

export function mentionsOtherCity(text: string): string | null {
  const t = text.toLowerCase()
  if (/\b(blantyre|btz|blz)\b/.test(t)) return 'Blantyre'
  if (/\bzomba\b/.test(t)) return 'Zomba'
  if (/\b(mzuzu|mzz)\b/.test(t)) return 'Mzuzu'
  return null
}

export function haversineKm(a: CourierLatLng, b: CourierLatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Road distance ≈ straight-line × 1.25 when Directions is unavailable. */
export function roadDistanceKm(a: CourierLatLng, b: CourierLatLng): number {
  return haversineKm(a, b) * 1.25
}

function nominatimHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'User-Agent': 'Vero360Courier/1.0 (https://vero360.app; fare-estimate)',
  }
}

export async function reverseGeocodeLilongwe(
  lat: number,
  lng: number,
): Promise<CourierLatLng> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates')
  }
  if (!isInLilongweBounds(lat, lng)) {
    throw new Error('Vero Courier is Lilongwe only. Your current location is outside Lilongwe.')
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '18')
    url.searchParams.set('addressdetails', '1')
    const res = await fetch(url.toString(), {
      headers: nominatimHeaders(),
      cache: 'no-store',
    })
    if (res.ok) {
      const data = (await res.json()) as {
        display_name?: string
        name?: string
        address?: Record<string, string>
      }
      const address = data.address || {}
      const other = mentionsOtherCity(
        `${data.display_name || ''} ${Object.values(address).join(' ')}`,
      )
      if (other) {
        throw new Error(`Vero Courier is Lilongwe only — not ${other}.`)
      }
      const street =
        [address.road, address.pedestrian, address.footway].filter(Boolean).join(' ') || ''
      const suburb =
        address.suburb || address.neighbourhood || address.quarter || address.village || ''
      const city = address.city || address.town || address.municipality || ''
      const parts = [street, suburb, city || 'Lilongwe'].filter(Boolean)
      const label =
        parts.length > 0
          ? Array.from(new Set(parts)).join(', ')
          : String(data.display_name || data.name || '').trim() ||
            `Lilongwe (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      return { lat, lng, label }
    }
  } catch (err) {
    if (err instanceof Error && /Lilongwe only/i.test(err.message)) throw err
  }

  return { lat, lng, label: `Lilongwe (${lat.toFixed(4)}, ${lng.toFixed(4)})` }
}

export async function forwardGeocodeLilongwe(label: string): Promise<CourierLatLng> {
  const q = label.trim()
  if (q.length < 3) throw new Error('Enter a clearer Lilongwe place name.')

  const other = mentionsOtherCity(q)
  if (other) {
    throw new Error(`Vero Courier is Lilongwe only — not ${other}. We are expanding soon.`)
  }

  const landmark = landmarkPoint(q)
  if (landmark) return { ...landmark, label: q }

  const query = q.toLowerCase().includes('malawi') ? q : `${q}, Lilongwe, Malawi`
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'mw')
    const res = await fetch(url.toString(), {
      headers: nominatimHeaders(),
      cache: 'no-store',
    })
    if (res.ok) {
      const rows = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
      const first = rows[0]
      const lat = Number(first?.lat)
      const lng = Number(first?.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        if (!isInLilongweBounds(lat, lng)) {
          throw new Error('That place looks outside Lilongwe. Vero Courier is Lilongwe only for now.')
        }
        const otherHit = mentionsOtherCity(String(first?.display_name || ''))
        if (otherHit) {
          throw new Error(`Vero Courier is Lilongwe only — not ${otherHit}.`)
        }
        return { lat, lng, label: q }
      }
    }
  } catch (err) {
    if (err instanceof Error && /Lilongwe only|outside Lilongwe/i.test(err.message)) throw err
  }

  // Soft fallback so Area-style labels still quote when Nominatim is slow.
  if (landmarkPoint(q) || /\barea\s*\d+\b/i.test(q) || /lilongwe/i.test(q)) {
    return { lat: -13.9626, lng: 33.7741, label: q }
  }
  throw new Error('Could not locate that place in Lilongwe. Try an Area name or landmark.')
}

/** Ignore null / "" / garbage — `Number(null)` is 0 and must not become GPS (0,0). */
export function parseOptionalCoord(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'string' && !raw.trim()) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

export async function resolveCourierPoint(opts: {
  label?: string
  lat?: number | null
  lng?: number | null
}): Promise<CourierLatLng> {
  const lat = parseOptionalCoord(opts.lat)
  const lng = parseOptionalCoord(opts.lng)
  if (lat != null && lng != null) {
    if (!isInLilongweBounds(lat, lng)) {
      throw new Error(
        'Vero Courier is Lilongwe only. Your current location is outside Lilongwe.',
      )
    }
    const label = (opts.label || '').trim()
    return label ? { lat, lng, label } : reverseGeocodeLilongwe(lat, lng)
  }
  return forwardGeocodeLilongwe(String(opts.label || ''))
}
