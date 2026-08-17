export function GET() {
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.vero265.app',
        sha256_cert_fingerprints: [
          'REPLACE_WITH_PLAY_APP_SIGNING_SHA256',
        ],
      },
    },
  ]

  return Response.json(body, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
