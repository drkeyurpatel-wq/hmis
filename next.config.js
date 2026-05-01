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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking — app should never be iframed
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME type sniffing (IE/old browsers)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer leakage
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS — force HTTPS for 2 years + preload
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Disable browser features we don't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Block cross-domain policy files (Flash/Acrobat)
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          // DNS prefetch for performance
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // CSP — allow self + Supabase + Sentry
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'health1-super-speciality-hospi',
  project: 'hmis',
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
