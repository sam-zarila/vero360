import { proxyVeroMedia } from '@/lib/media-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return proxyVeroMedia(request)
}
