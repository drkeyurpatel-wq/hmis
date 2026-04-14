const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Billing v2 files use @ts-nocheck — proper types in Sprint 3
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
