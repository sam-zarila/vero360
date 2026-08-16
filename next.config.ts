import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/storage',
    '@google-cloud/firestore',
    'jose',
    'jwks-rsa',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'www.gstatic.com' },
      { protocol: 'http', hostname: '67.211.220.69', port: '3000' },
      { protocol: 'https', hostname: '67.211.220.69' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'vero360.app' },
      { protocol: 'https', hostname: '**.firebasestorage.app' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/merchant/:id',
        destination: '/dashboard/merchant/:id',
        permanent: false,
      },
      {
        source: '/bussiness%20certificate',
        destination: '/business-certificate',
        permanent: true,
      },
      {
        source: '/bussiness certificate',
        destination: '/business-certificate',
        permanent: true,
      },
      {
        source: '/bussiness-certificate',
        destination: '/business-certificate',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
