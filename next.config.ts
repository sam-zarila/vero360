import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'www.gstatic.com' },
      { protocol: 'http', hostname: '67.211.220.69', port: '3000' },
      { protocol: 'https', hostname: '67.211.220.69' },
    ],
  },
  async redirects() {
    return [
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
