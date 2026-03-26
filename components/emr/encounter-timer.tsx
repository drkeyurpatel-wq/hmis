// components/emr/encounter-timer.tsx
// Shows elapsed consultation time since patient was loaded
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface EncounterTimerProps {
  /** Timestamp when patient was selected (Date.now()) */
  startTime: number | null;
  className?: string;
}

export default function EncounterTimer({ startTime, className = '' }: EncounterTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    // Update every second
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime]);

  if (!startTime) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;

  // Color: green < 10m, amber 10-20m, red > 20m
  const color = mins >= 20 ? 'text-h1-red' : mins >= 10 ? 'text-h1-yellow' : 'text-h1-text-muted';

  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${color} ${className}`}
      title="Consultation duration">
      <Clock className="w-3 h-3" />
      {display}
    </span>
  );
}
