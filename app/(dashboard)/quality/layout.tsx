// @ts-nocheck
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const qualityNav = [
  { href: '/quality', label: 'Command Centre', icon: '🏥' },
  { href: '/quality/nabh', label: 'NABH Tracker', icon: '📋' },
  { href: '/quality/incidents', label: 'Incidents', icon: '⚠️' },
  { href: '/quality/ipc', label: 'IPC Dashboard', icon: '🦠' },
  { href: '/quality/audits', label: 'Clinical Audits', icon: '🔍' },
  { href: '/quality/ipsg', label: 'Patient Safety', icon: '🛡️' },
  { href: '/quality/mortality', label: 'Mortality Review', icon: '📊' },
  { href: '/quality/medication', label: 'Medication Safety', icon: '💊' },
  { href: '/quality/credentials', label: 'Credentialing', icon: '🎓' },
  { href: '/quality/documents', label: 'Document Control', icon: '📄' },
  { href: '/quality/drills', label: 'FMS Compliance', icon: '🔥' },
  { href: '/quality/mock-survey', label: 'Mock Survey', icon: '🎯' },
];

export default function QualityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full">
      <nav className="w-56 border-r bg-gray-50 dark:bg-gray-900 p-3 space-y-1 overflow-y-auto shrink-0">
        <div className="px-2 py-2 mb-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Quality & NABH</h2>
          <p className="text-xs text-gray-500">6th Edition Excellence</p>
        </div>
        {qualityNav.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
              pathname === item.href
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 font-medium'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
