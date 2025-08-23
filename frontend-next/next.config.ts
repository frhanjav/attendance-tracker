import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: false,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    experimental: {
        optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    },
    // @ts-ignore - turbopack.root is not yet in the NextConfig type but is valid
    turbopack: {
        root: process.cwd(),
    },
    trailingSlash: false,
    output: 'standalone',
};

export default nextConfig;
