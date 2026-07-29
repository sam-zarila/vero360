import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'www.gstatic.com' },
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
