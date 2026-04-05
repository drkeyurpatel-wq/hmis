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
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true, // Suppress source map upload logs during build
  org: 'health1-super-speciality-hospi',
  project: 'hmis',

  // Upload source maps for better stack traces (requires SENTRY_AUTH_TOKEN env var)
  widenClientFileUpload: true,
  hideSourceMaps: true,

  // Automatically instrument API routes and server components
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,

  // Tree-shake Sentry logger in production
  disableLogger: true,
});
