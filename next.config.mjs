import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Handle Node.js modules properly for client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        buffer: false,
        stream: false,
      };
    }
    
    // Exclude problematic packages from client-side bundling
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push('image-size');
    }
    
    return config;
  },
};

export default withMDX(config);
