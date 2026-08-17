import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // חבילות ה-workspace נשלחות כ-TS גולמי (בלי build step) — צריך טרנספילציה על ידי Next.js.
  transpilePackages: [
    '@shape-sound/core',
    '@shape-sound/audio',
    '@shape-sound/genres',
    '@shape-sound/storage',
    '@shape-sound/shared',
    '@shape-sound/ui',
  ],
};

export default nextConfig;
