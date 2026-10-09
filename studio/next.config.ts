import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Cloud preview hosts (e.g. Arena/e2b, Firebase Studio) proxy /_next/* from
  // a different origin — allow them so HMR/dev assets aren't flagged.
  allowedDevOrigins: ['*.e2b.app', '*.cloudworkstations.dev', '*.firebase.studio'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
