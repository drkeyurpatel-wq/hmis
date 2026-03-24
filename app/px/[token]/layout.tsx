// app/px/[token]/layout.tsx
// Public patient-facing layout — no auth required

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Health1 — Patient Services',
  description: 'Order food, request assistance, share feedback',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#1B3A5C',
};

export default function PxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1B3A5C] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {/* Health1 cross logo simplified */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="8" y="0" width="12" height="28" rx="2" fill="#E8B931" />
            <rect x="0" y="8" width="28" height="12" rx="2" fill="#E8B931" />
            <rect x="9" y="1" width="10" height="26" rx="1.5" fill="#D4382C" />
            <rect x="1" y="9" width="26" height="10" rx="1.5" fill="#2A9D8F" />
            <rect x="9" y="9" width="10" height="10" fill="#1B3A5C" />
          </svg>
          <div>
            <div className="text-sm font-semibold tracking-wide">HEALTH1</div>
            <div className="text-[10px] text-white/70 -mt-0.5">Patient Services</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto pb-8">{children}</main>
    </div>
  );
}
