// app/px/[token]/layout.tsx
// Public patient-facing layout — no auth required

import { Metadata } from 'next';
import Image from 'next/image';

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
          <Image src="/images/health1-logo.svg" alt="Health1" width={56} height={28} className="h-7 w-auto brightness-0 invert" />
          <div className="text-[10px] text-white/70">Patient Services</div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto pb-8">{children}</main>
    </div>
  );
}
