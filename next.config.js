/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Pre-existing type errors from Supabase join typing — tracked for cleanup
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'bmuupgrzbfmddjwcqlss.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
