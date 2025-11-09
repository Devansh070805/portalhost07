import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Your existing config
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // This tells Next.js to not bundle 'pdfkit' on the server.
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

export default nextConfig;