// app/(dashboard)/emr/page.tsx
// SP3: Single-page EMR with voice dictation + AI Scribe beta
// Replaces emr-v2 (8-step wizard) with two-panel single-page layout
import { Suspense } from 'react';
import EMRPage from '@/components/emr/emr-page';

export default function EMRRoute() {
  return (
    <Suspense fallback={<EMRSkeleton />}>
      <EMRPage />
    </Suspense>
  );
}

function EMRSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-2 p-4 animate-h1-shimmer">
      {/* Banner skeleton */}
      <div className="h-14 bg-h1-navy/5 rounded-h1" />
      {/* Main content skeleton */}
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-16 bg-h1-navy/5 rounded-h1" />
          <div className="h-32 bg-h1-navy/5 rounded-h1" />
          <div className="h-32 bg-h1-navy/5 rounded-h1" />
          <div className="h-24 bg-h1-navy/5 rounded-h1" />
        </div>
        <div className="hidden lg:block w-[42%] space-y-2">
          <div className="h-48 bg-h1-navy/5 rounded-h1" />
          <div className="h-32 bg-h1-navy/5 rounded-h1" />
          <div className="h-24 bg-h1-navy/5 rounded-h1" />
        </div>
      </div>
      {/* Action bar skeleton */}
      <div className="h-12 bg-h1-navy/5 rounded-h1" />
    </div>
  );
}
