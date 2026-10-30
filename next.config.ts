import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
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
      { protocol: 'https', hostname: 'api-yiyudxvfrxex.vero360.app' },
      { protocol: 'https', hostname: 'www.gstatic.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'vero360.app' },
      { protocol: 'https', hostname: '**.firebasestorage.app' },
    ],
  },
  async redirects() {
    return [
      { source: '/merchant/:id', destination: '/shop/:id', permanent: false },
      { source: '/bussiness%20certificate', destination: '/business-certificate', permanent: true },
      { source: '/bussiness certificate', destination: '/business-certificate', permanent: true },
      { source: '/bussiness-certificate', destination: '/business-certificate', permanent: true },
    ];
  },
};

export default nextConfig;