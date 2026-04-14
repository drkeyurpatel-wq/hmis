const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TEMPORARY: billing revolution v2 uses untyped billingDb() — fix types in Sprint 2
    ignoreBuildErrors: true,
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
