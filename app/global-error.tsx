'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: '16px',
          fontFamily: 'system-ui, sans-serif', padding: '24px',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: '#fef2f2', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '28px',
          }}>
            !
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', maxWidth: '400px', margin: 0 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px', backgroundColor: '#0d9488', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px' }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
