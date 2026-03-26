'use client';

import { useEffect, useState } from 'react';

interface LoadingStateProps {
  variant?: 'table' | 'form' | 'card' | 'custom';
  rows?: number;
  columns?: number;
  delay?: number;
  children?: React.ReactNode;
}

/**
 * LoadingState — Skeleton shimmer that matches content shape.
 * Shows after a 200ms delay to avoid flash on fast loads.
 * 
 * Usage:
 *   <LoadingState variant="table" rows={5} />
 *   <LoadingState variant="form" rows={4} />
 *   <LoadingState variant="card" rows={3} columns={3} />
 */
export function LoadingState({
  variant = 'table',
  rows = 5,
  columns = 3,
  delay = 200,
  children,
}: LoadingStateProps) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  if (variant === 'custom' && children) return <>{children}</>;

  return (
    <div className="w-full animate-h1-fade-in" role="status" aria-label="Loading">
      <span className="sr-only">Loading...</span>
      {variant === 'table' && <TableSkeleton rows={rows} />}
      {variant === 'form' && <FormSkeleton rows={rows} />}
      {variant === 'card' && <CardSkeleton rows={rows} columns={columns} />}
    </div>
  );
}

function ShimmerBar({ className = '' }: { className?: string }) {
  return <div className={`h1-skeleton ${className}`} />;
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3">
        <ShimmerBar className="h-4 w-24" />
        <ShimmerBar className="h-4 w-32" />
        <ShimmerBar className="h-4 w-20" />
        <ShimmerBar className="h-4 w-28 hidden md:block" />
        <ShimmerBar className="h-4 w-16 hidden lg:block" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-3 border-t border-h1-border"
        >
          <ShimmerBar className="h-4 w-20" />
          <ShimmerBar className="h-4 w-36" />
          <ShimmerBar className="h-4 w-16" />
          <ShimmerBar className="h-4 w-24 hidden md:block" />
          <ShimmerBar className="h-4 w-12 hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-h1-lg">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerBar className="h-3 w-24" />
          <ShimmerBar className="h-10 w-full rounded-h1" />
        </div>
      ))}
      {/* Submit button skeleton */}
      <ShimmerBar className="h-10 w-32 rounded-h1" />
    </div>
  );
}

function CardSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="grid gap-h1-md" style={{ gridTemplateColumns: `repeat(${Math.min(columns, 4)}, 1fr)` }}>
      {Array.from({ length: rows * columns }).map((_, i) => (
        <div key={i} className="h1-card p-h1-md space-y-3">
          <ShimmerBar className="h-4 w-3/4" />
          <ShimmerBar className="h-8 w-1/2" />
          <ShimmerBar className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
