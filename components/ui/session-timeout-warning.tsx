// components/ui/session-timeout-warning.tsx
// Shows a non-dismissable warning banner when session is about to expire.
// User activity (click/key/touch) resets the timer automatically.

'use client';

import { useSessionTimeout } from '@/lib/auth/use-session-timeout';
import { Clock, MousePointer } from 'lucide-react';

export function SessionTimeoutWarning() {
  const { showWarning, remainingSeconds } = useSessionTimeout();

  if (!showWarning) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-h1-yellow/95 text-h1-navy px-4 py-2.5 flex items-center justify-center gap-3 shadow-lg animate-h1-fade-in">
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span className="text-h1-body font-medium">
        Session expires in {mins}:{String(secs).padStart(2, '0')}
      </span>
      <span className="text-h1-small flex items-center gap-1 opacity-80">
        <MousePointer className="w-3 h-3" />
        Move mouse or press any key to stay logged in
      </span>
    </div>
  );
}
