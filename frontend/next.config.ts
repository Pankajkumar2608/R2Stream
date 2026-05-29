import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'https://musync-api.pankajjaat2608.workers.dev/:path*',
      },
    ];
  },
};

export default nextConfig;
