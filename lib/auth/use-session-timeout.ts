// lib/auth/use-session-timeout.ts
// Auto-logout after 30 minutes of inactivity.
// Tracks mouse, keyboard, and touch events as activity signals.
// Shows warning toast at 25 minutes, logs out at 30.

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { sb } from '@/lib/supabase/browser';

const TIMEOUT_MS = 30 * 60 * 1000;        // 30 minutes
const WARNING_MS = 25 * 60 * 1000;        // Warning at 25 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

interface SessionTimeoutState {
  showWarning: boolean;
  remainingSeconds: number;
}

export function useSessionTimeout(enabled = true): SessionTimeoutState {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300); // 5 min default

  const logout = useCallback(async () => {
    try {
      await sb()?.auth.signOut();
    } catch {
      // Best effort
    }
    window.location.href = '/auth/login?reason=timeout';
  }, []);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Warning at 25 min
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      // Start countdown
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = Math.max(0, Math.ceil((TIMEOUT_MS - elapsed) / 1000));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, WARNING_MS);

    // Logout at 30 min
    timerRef.current = setTimeout(logout, TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (!enabled) return;

    resetTimers();

    const handler = () => resetTimers();
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, handler, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, resetTimers]);

  return { showWarning, remainingSeconds };
}
