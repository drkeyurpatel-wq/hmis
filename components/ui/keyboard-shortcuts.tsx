// components/ui/keyboard-shortcuts.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS: { key: string; alt?: boolean; ctrl?: boolean; shift?: boolean; label: string; path?: string; action?: string }[] = [
  { key: 'n', alt: true, label: 'New Patient', path: '/patients' },
  { key: 'b', alt: true, label: 'Billing', path: '/billing' },
  { key: 'o', alt: true, label: 'OPD', path: '/opd' },
  { key: 'i', alt: true, label: 'IPD', path: '/ipd' },
  { key: 'l', alt: true, label: 'Lab', path: '/lab' },
  { key: 'r', alt: true, label: 'Radiology', path: '/radiology' },
  { key: 'p', alt: true, label: 'Pharmacy', path: '/pharmacy' },
  { key: 'a', alt: true, label: 'Appointments', path: '/appointments' },
  { key: 'e', alt: true, label: 'EMR', path: '/emr-v2' },
  { key: 'd', alt: true, label: 'Dashboard', path: '/' },
  { key: 's', alt: true, label: 'Settings', path: '/settings' },
  { key: 'k', alt: true, label: 'Nursing Station', path: '/nursing-station' },
  { key: 'q', alt: true, label: 'Quality', path: '/quality' },
  { key: '/', ctrl: true, label: 'Show Shortcuts', action: 'toggle_help' },
];

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    for (const sc of SHORTCUTS) {
      const altMatch = sc.alt ? e.altKey : !e.altKey;
      const ctrlMatch = sc.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = sc.shift ? e.shiftKey : true;

      if (e.key.toLowerCase() === sc.key && altMatch && ctrlMatch && shiftMatch) {
        e.preventDefault();
        if (sc.path) router.push(sc.path);
        if (sc.action === 'toggle_help') setShowHelp(prev => !prev);
        return;
      }
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, shortcuts: SHORTCUTS };
}

export function ShortcutHelpModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(sc => (
            <div key={sc.key + (sc.alt ? 'a' : '') + (sc.ctrl ? 'c' : '')} className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-700">{sc.label}</span>
              <kbd className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-mono text-gray-600">
                {sc.ctrl ? 'Ctrl + ' : ''}{sc.alt ? 'Alt + ' : ''}{sc.shift ? 'Shift + ' : ''}{sc.key.toUpperCase()}
              </kbd>
            </div>
          ))}
        </div>
        <div className="text-[9px] text-gray-400 mt-3 text-center">Press Ctrl+/ to toggle this panel</div>
      </div>
    </div>
  );
}
