'use client';
import React from 'react';
import Link from 'next/link';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">H1</span>
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 leading-none">Health1</p>
              <p className="text-[9px] text-teal-600 font-semibold uppercase tracking-wider">Patient Portal</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
      {/* Footer */}
      <footer className="text-center py-4 text-[10px] text-gray-400">Health1 Super Speciality Hospital, Shilaj</footer>
    </div>
  );
}
