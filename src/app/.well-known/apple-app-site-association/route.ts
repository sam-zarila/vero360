import { appleAppId } from '@/lib/app-links'

export function GET() {
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: appleAppId(),
          paths: [
            '/accommodation/*',
            '/stay/*',
            '/stays/*',
            '/marketplace/*',
            '/shop/*',
            '/merchant/*',
            '/food/*',
          ],
        },
      ],
    },
  }

  return new Response(JSON.stringify(body), {
    headers: {
      // Apple requires application/json (no charset) for AASA.
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
