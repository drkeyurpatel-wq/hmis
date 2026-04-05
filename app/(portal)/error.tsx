'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function PortalError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-2xl font-bold text-red-500">!</div>
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="text-sm text-gray-500 text-center max-w-md">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
      >
        Try again
      </button>
      {error.digest && (
        <p className="text-[10px] text-gray-400 mt-2">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
