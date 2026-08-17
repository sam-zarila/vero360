export function GET() {
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'TEAMID.com.vero265.app',
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
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
