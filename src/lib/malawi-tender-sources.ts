import 'server-only'

export type MalawiTenderSource = 'malawitenders' | 'maneps' | 'ppda'

export type MalawiTenderDraft = {
  source: MalawiTenderSource
  externalId: string
  title: string
  description: string
  buyer: string | null
  reference: string | null
  location: string | null
  publishedAt: string | null
  closingAt: string | null
  tenderUrl: string
  documentUrl: string | null
}

export type MalawiTenderSourceResult = {
  source: MalawiTenderSource
  ok: boolean
  fetched: number
  error?: string
}

const UA =
  'Vero360TendersBot/1.0 (+https://vero360.app; Malawi tender sync for Vero360 admin)'

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8211;/gi, '–')
    .replace(/&#038;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json',
      'User-Agent': UA,
    },
    cache: 'no-store',
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

function parseFlexibleDate(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const d = new Date(cleaned)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  // 31 Aug 2026 / 26 Aug 2026
  const m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/)
  if (m) {
    const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const d = new Date(cleaned)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function hashId(source: string, key: string) {
  let h = 0
  const s = `${source}:${key}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `${source}-${h.toString(16)}`
}

/** malawitenders.com — HTML listing at /tenders.php */
export async function fetchMalawiTenders(limit = 50): Promise<MalawiTenderDraft[]> {
  const html = await fetchText('https://www.malawitenders.com/tenders.php')
  const blocks = html.match(/<div class="tender-card">[\s\S]*?<\/div>\s*<\/div>/gi) || []
  const out: MalawiTenderDraft[] = []

  for (const block of blocks) {
    if (out.length >= limit) break
    const linkMatch = block.match(
      /href="(https:\/\/www\.malawitenders\.com\/tender\/[^"]+)"/i,
    )
    const titleMatch = block.match(
      /<p class="tender-card-heading">([\s\S]*?)<\/p>/i,
    )
    if (!linkMatch || !titleMatch) continue

    const tenderUrl = linkMatch[1].trim()
    const title = decodeEntities(stripHtml(titleMatch[1]))
    if (!title) continue

    const refMatch = block.match(/MWT Ref No\.:?\s*&nbsp;&nbsp;([^<]+)/i)
    const deadlineMatch = block.match(/Deadline:?\s*&nbsp;&nbsp;([^<]+)/i)
    const reference = refMatch ? decodeEntities(stripHtml(refMatch[1])) : null
    const closingAt = deadlineMatch ? parseFlexibleDate(stripHtml(deadlineMatch[1])) : null
    const slug = tenderUrl.split('/').pop()?.replace(/\.php$/i, '') || tenderUrl

    out.push({
      source: 'malawitenders',
      externalId: hashId('malawitenders', slug),
      title: title.slice(0, 240),
      description: title,
      buyer: null,
      reference,
      location: 'Malawi',
      publishedAt: null,
      closingAt,
      tenderUrl,
      documentUrl: null,
    })
  }

  if (out.length === 0) {
    // Fallback: bare tender links
    const links = [
      ...html.matchAll(
        /href="(https:\/\/www\.malawitenders\.com\/tender\/[^"]+)"[^>]*>\s*<p class="tender-card-heading">([\s\S]*?)<\/p>/gi,
      ),
    ]
    for (const m of links.slice(0, limit)) {
      const tenderUrl = m[1]
      const title = decodeEntities(stripHtml(m[2]))
      const slug = tenderUrl.split('/').pop()?.replace(/\.php$/i, '') || tenderUrl
      out.push({
        source: 'malawitenders',
        externalId: hashId('malawitenders', slug),
        title: title.slice(0, 240),
        description: title,
        buyer: null,
        reference: null,
        location: 'Malawi',
        publishedAt: null,
        closingAt: null,
        tenderUrl,
        documentUrl: null,
      })
    }
  }

  return out
}

/** ppda.mw/tenders — open tenders HTML table */
export async function fetchPpdaTenders(limit = 60): Promise<MalawiTenderDraft[]> {
  const html = await fetchText('https://ppda.mw/tenders')
  const rows = [...html.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td[\s\S]*?href="([^"]+)"/gi)]

  return rows.slice(0, limit).flatMap(m => {
    const title = decodeEntities(stripHtml(m[1]))
    const buyer = decodeEntities(stripHtml(m[2])) || null
    const reference = decodeEntities(stripHtml(m[3])) || null
    const publishedAt = parseFlexibleDate(stripHtml(m[4]))
    const closingAt = parseFlexibleDate(stripHtml(m[5]))
    let documentUrl = m[6].trim()
    if (documentUrl.startsWith('/')) documentUrl = `https://ppda.mw${documentUrl}`
    documentUrl = documentUrl.replace(/&amp;/g, '&')
    if (!title) return []

    const key = reference || documentUrl || title
    return [
      {
        source: 'ppda' as const,
        externalId: hashId('ppda', key),
        title: title.slice(0, 240),
        description: [title, buyer, reference].filter(Boolean).join(' — '),
        buyer,
        reference,
        location: 'Malawi',
        publishedAt,
        closingAt,
        tenderUrl: documentUrl || 'https://ppda.mw/tenders',
        documentUrl: documentUrl || null,
      },
    ]
  })
}

/**
 * maneps.mw/procurement-notice
 * Public list UI is client-rendered; try known tendering API, then HTML fallback.
 */
export async function fetchManepsTenders(limit = 40): Promise<MalawiTenderDraft[]> {
  const errors: string[] = []

  // Attempt public-ish tendering endpoints (may require auth on some environments)
  const candidates = [
    'https://www.maneps.mw/tendering/api/tenders?q=%7B%22take%22%3A40%2C%22skip%22%3A0%7D',
    'https://maneps.mw/tendering/api/tenders?q=%7B%22take%22%3A40%2C%22skip%22%3A0%7D',
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        cache: 'no-store',
      })
      if (res.status === 401 || res.status === 403) {
        errors.push(`${url} → HTTP ${res.status} (login required)`)
        continue
      }
      if (!res.ok) {
        errors.push(`${url} → HTTP ${res.status}`)
        continue
      }
      const body = (await res.json()) as unknown
      const list = Array.isArray(body)
        ? body
        : body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)
          ? (body as { items: unknown[] }).items
          : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
            ? (body as { data: unknown[] }).data
            : []

      const out: MalawiTenderDraft[] = []
      for (const raw of list.slice(0, limit)) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as Record<string, unknown>
        const title = stripHtml(
          String(row.name || row.title || row.procurementTitle || ''),
        )
        const id = String(
          row.id || row.procurementReferenceNumber || row.referenceNumber || title,
        )
        if (!title || !id) continue
        const ref = String(row.procurementReferenceNumber || row.referenceNumber || '') || null
        const buyer = String(row.organizationName || row.buyer || '') || null
        const closingAt = parseFlexibleDate(
          String(row.closingDate || row.submissionDeadline || ''),
        )
        const publishedAt = parseFlexibleDate(String(row.publishedDate || row.publishDate || ''))
        out.push({
          source: 'maneps',
          externalId: hashId('maneps', id),
          title: title.slice(0, 240),
          description: stripHtml(String(row.description || title)),
          buyer,
          reference: ref,
          location: String(row.region || row.district || 'Malawi') || 'Malawi',
          publishedAt,
          closingAt,
          tenderUrl: `https://www.maneps.mw/procurement-notice/${encodeURIComponent(id)}`,
          documentUrl: null,
        })
      }
      if (out.length) return out
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'MANEPS fetch failed')
    }
  }

  // HTML fallback — page is mostly CSR, but keep the attempt for future SSR changes
  try {
    const html = await fetchText('https://www.maneps.mw/procurement-notice')
    const links = [
      ...html.matchAll(/href="(\/procurement-notice\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
    ]
    if (links.length) {
      return links.slice(0, limit).map(m => {
        const path = m[1]
        const title = decodeEntities(stripHtml(m[2])) || path
        return {
          source: 'maneps' as const,
          externalId: hashId('maneps', path),
          title: title.slice(0, 240),
          description: title,
          buyer: null,
          reference: null,
          location: 'Malawi',
          publishedAt: null,
          closingAt: null,
          tenderUrl: `https://www.maneps.mw${path}`,
          documentUrl: null,
        }
      })
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'MANEPS HTML fallback failed')
  }

  throw new Error(
    errors[0] ||
      'MANEPS procurement notices require interactive login; use MalawiTenders / PPDA for public listings.',
  )
}

export async function fetchAllMalawiTenders(opts?: {
  perSource?: number
}): Promise<{ tenders: MalawiTenderDraft[]; results: MalawiTenderSourceResult[] }> {
  const perSource = opts?.perSource ?? 50
  const results: MalawiTenderSourceResult[] = []
  const tenders: MalawiTenderDraft[] = []

  const runners: Array<{
    source: MalawiTenderDraft['source']
    run: () => Promise<MalawiTenderDraft[]>
  }> = [
    { source: 'malawitenders', run: () => fetchMalawiTenders(perSource) },
    { source: 'ppda', run: () => fetchPpdaTenders(perSource) },
    { source: 'maneps', run: () => fetchManepsTenders(Math.min(perSource, 40)) },
  ]

  await Promise.all(
    runners.map(async ({ source, run }) => {
      try {
        const batch = await run()
        tenders.push(...batch)
        results.push({ source, ok: true, fetched: batch.length })
      } catch (err) {
        results.push({
          source,
          ok: false,
          fetched: 0,
          error: err instanceof Error ? err.message : 'Fetch failed',
        })
      }
    }),
  )

  const seen = new Set<string>()
  const unique = tenders.filter(t => {
    const key = `${t.tenderUrl.toLowerCase()}|${t.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { tenders: unique, results }
}
