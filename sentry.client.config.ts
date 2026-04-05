// sentry.client.config.ts
// Sentry client-side configuration for HMIS
// Initialized in the browser — captures unhandled errors, promise rejections, and performance data

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions in production

  // Session replay for debugging UI issues
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Environment
  environment: process.env.NODE_ENV,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors (user's connection)
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // Next.js navigation
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],

  // Don't send PHI/PII to Sentry
  beforeSend(event) {
    // Strip any patient data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(b => {
        if (b.data?.url && /patient|uhid|aadhaar|abha/i.test(b.data.url)) {
          b.data.url = '[REDACTED_PHI_URL]';
        }
        return b;
      });
    }
    return event;
  },
});
