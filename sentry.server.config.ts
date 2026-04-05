// sentry.server.config.ts
// Sentry server-side configuration for HMIS
// Runs in Node.js — captures API route errors, SSR failures

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — lower rate for server
  tracesSampleRate: 0.05, // 5% of server transactions

  // Environment
  environment: process.env.NODE_ENV,

  // Don't send PHI/PII to Sentry
  beforeSend(event) {
    // Strip patient-related data from error messages
    if (event.message) {
      event.message = event.message.replace(
        /\b(H1-\d+|[A-Z]{2}\d{10,}|\d{4}\s?\d{4}\s?\d{4})\b/g,
        '[REDACTED]'
      );
    }
    return event;
  },
});
