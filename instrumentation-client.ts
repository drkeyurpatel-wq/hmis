// instrumentation-client.ts
// Replaces sentry.client.config.ts
// See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  ignoreErrors: [
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],
  beforeSend(event) {
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
