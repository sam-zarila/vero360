import 'server-only'

export type MalawiJobDraft = {
  source: 'onlinejobmw' | 'jobsearchmalawi' | 'mwayi'
  externalId: string
  position: string
  description: string
  jobLink: string
  company: string | null
  location: string | null
  isRemote: boolean
  photoUrl: string | null
}

export type MalawiSourceResult = {
  source: MalawiJobDraft['source']
  ok: boolean
  fetched: number
  error?: string
}

const UA =
  'Vero360JobsBot/1.0 (+https://vero360.app; Malawi job sync for Vero360 admin)'

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;/gi, "'")
    .replace(/&#8211;/gi, '–')
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
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

function companyFromTitle(title: string): string | null {
  const parts = title.split(/@| at /i)
  if (parts.length < 2) return null
  const company = parts[parts.length - 1].trim()
  return company && company.length < 120 ? company : null
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: '*/*', 'User-Agent': UA },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return (await res.json()) as T
}

type WpRendered = { rendered?: string }

/** onlinejobmw.com — WordPress `vacancies` CPT */
export async function fetchOnlineJobMw(limit = 40): Promise<MalawiJobDraft[]> {
  type Row = { id: number; link?: string; title?: WpRendered; slug?: string }

  const rows = await fetchJson<Row[]>(
    `https://onlinejobmw.com/wp-json/wp/v2/vacancies?per_page=${Math.min(limit, 50)}&page=1&orderby=date&order=desc`,
  )

  const out: MalawiJobDraft[] = []
  for (const row of rows.slice(0, limit)) {
    const title = decodeEntities(
      stripHtml(row.title?.rendered || '') || row.slug || 'Vacancy',
    )
    const link = (row.link || '').trim()
    if (!link) continue

    let description = title
    try {
      const html = await fetchText(link)
      const article =
        html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
        html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[\s\S]*?<\/div>/i)?.[0] ||
        ''
      const text = stripHtml(article)
      if (text.length > 80) description = text.slice(0, 4000)
    } catch {
      // title-only fallback
    }

    out.push({
      source: 'onlinejobmw',
      externalId: `onlinejobmw-${row.id}`,
      position: title.slice(0, 160),
      description,
      jobLink: link,
      company: companyFromTitle(title),
      location: 'Malawi',
      isRemote: /remote/i.test(title),
      photoUrl: null,
    })
  }
  return out
}

/** jobsearchmalawi.com — WP Job Manager listings */
export async function fetchJobSearchMalawi(limit = 40): Promise<MalawiJobDraft[]> {
  type Row = {
    id: number
    link?: string
    title?: WpRendered
    content?: WpRendered
    meta?: Record<string, unknown>
  }

  const rows = await fetchJson<Row[]>(
    `https://jobsearchmalawi.com/wp-json/wp/v2/job-listings?per_page=${Math.min(limit, 50)}&page=1&orderby=date&order=desc`,
  )

  return rows.slice(0, limit).flatMap(row => {
    const title = decodeEntities(stripHtml(row.title?.rendered || '') || 'Job listing')
    const link = (row.link || '').trim()
    if (!link) return []
    const meta = row.meta || {}
    const company = String(meta._company_name || '').trim() || null
    const location = String(meta._job_location || '').trim() || 'Malawi'
    const remote = meta._remote_position === 1 || meta._remote_position === '1'
    const description =
      stripHtml(row.content?.rendered || '') ||
      [title, company, location].filter(Boolean).join(' — ')

    return [
      {
        source: 'jobsearchmalawi',
        externalId: `jobsearchmalawi-${row.id}`,
        position: title.slice(0, 160),
        description: description.slice(0, 4000),
        jobLink: link,
        company,
        location,
        isRemote: Boolean(remote),
        photoUrl: null,
      },
    ]
  })
}

/** mwayi.mw — same public endpoint their website uses */
export async function fetchMwayi(limit = 60): Promise<MalawiJobDraft[]> {
  type Row = {
    job_ID?: number | string
    job_Title?: string
    job_Location?: string
    job_Content?: string
    job_Link?: string
    job_Type?: string
    organization_Title?: string
    organization_ID?: number | string
    organization_Logo?: string
  }

  const form = new URLSearchParams()
  form.set('claim', 'jobs')

  const body = await fetchJson<{ data?: Row[] }>('https://mwayi.mw/update/job.update.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const rows = Array.isArray(body.data) ? body.data : []

  return rows.slice(0, limit).flatMap(row => {
    const id = row.job_ID
    if (id == null) return []
    const title = decodeEntities(stripHtml(row.job_Title || '') || 'Mwayi job')
    const link = String(row.job_Link || '').trim() || `https://mwayi.mw/jobs?id=${id}`
    const description =
      stripHtml(row.job_Content || '') ||
      [title, row.organization_Title, row.job_Location].filter(Boolean).join(' — ')
    const photoUrl =
      row.organization_ID && row.organization_Logo
        ? `https://console.mwayi.mw/files/organizations/${row.organization_ID}/${row.organization_Logo}`
        : null

    return [
      {
        source: 'mwayi',
        externalId: `mwayi-${id}`,
        position: title.slice(0, 160),
        description: description.slice(0, 4000),
        jobLink: link.startsWith('http') ? link : `https://mwayi.mw/${link.replace(/^\/+/, '')}`,
        company: String(row.organization_Title || '').trim() || null,
        location: String(row.job_Location || '').trim() || 'Malawi',
        isRemote: /remote/i.test(`${row.job_Type || ''} ${title}`),
        photoUrl,
      },
    ]
  })
}

export async function fetchAllMalawiJobs(opts?: {
  perSource?: number
}): Promise<{ jobs: MalawiJobDraft[]; results: MalawiSourceResult[] }> {
  const perSource = opts?.perSource ?? 40
  const results: MalawiSourceResult[] = []
  const jobs: MalawiJobDraft[] = []

  const runners: Array<{
    source: MalawiJobDraft['source']
    run: () => Promise<MalawiJobDraft[]>
  }> = [
    { source: 'onlinejobmw', run: () => fetchOnlineJobMw(perSource) },
    { source: 'jobsearchmalawi', run: () => fetchJobSearchMalawi(perSource) },
    { source: 'mwayi', run: () => fetchMwayi(Math.max(perSource, 60)) },
  ]

  await Promise.all(
    runners.map(async ({ source, run }) => {
      try {
        const batch = await run()
        jobs.push(...batch)
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
  const unique = jobs.filter(j => {
    const key = `${j.jobLink.toLowerCase()}|${j.position.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { jobs: unique, results }
}
