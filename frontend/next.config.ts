import type { NextConfig } from 'next';
import path from 'node:path';
// Keep the hosted static export. Docker builds opt in to a Node.js server.
const standalone = process.env.NEXT_OUTPUT === 'standalone';
const backend = (process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const development = process.env.NODE_ENV === 'development';
const nextConfig: NextConfig = {
  output: standalone ? 'standalone' : development ? undefined : 'export',
  devIndicators: false,
  trailingSlash: !standalone,
  images: { unoptimized: true },
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  ...((standalone || development) ? {
    // Rewrites are fixed at build time; this is an internal, server-only address.
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
    },
  } : {}),
};
export default nextConfig;
