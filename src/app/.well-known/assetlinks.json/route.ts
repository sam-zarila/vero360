import {
  ANDROID_PACKAGE_ID,
  androidSha256Fingerprints,
} from '@/lib/app-links'

export function GET() {
  const fingerprints = androidSha256Fingerprints()
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]

  return Response.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  })
}
