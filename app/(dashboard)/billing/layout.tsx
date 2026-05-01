// ═══════════════════════════════════════════════════════════════════════
// HEALTH1 HMIS — BILLING MODULE LAYOUT
// src/app/(dashboard)/billing/layout.tsx
// ═══════════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing | Health1 HMIS',
  description: 'Health1 Hospital Billing Management System',
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  );
}
