// instrumentation.ts
// Replaces sentry.server.config.ts and sentry.edge.config.ts
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side init (replaces sentry.server.config.ts)
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.05,
      environment: process.env.NODE_ENV,
      beforeSend(event) {
        if (event.message) {
          event.message = event.message.replace(
            /\b(H1-\d+|[A-Z]{2}\d{10,}|\d{4}\s?\d{4}\s?\d{4})\b/g,
            '[REDACTED]'
          );
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime init (replaces sentry.edge.config.ts)
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.05,
      environment: process.env.NODE_ENV,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
