/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // All 115 TypeScript errors fixed — March 29, 2026
    // ignoreBuildErrors: false (default)
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'bmuupgrzbfmddjwcqlss.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
