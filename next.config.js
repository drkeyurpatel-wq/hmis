const { withSentryConfig } = require('@sentry/nextjs');

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
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'health1-super-speciality-hospi',
  project: 'hmis',
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
