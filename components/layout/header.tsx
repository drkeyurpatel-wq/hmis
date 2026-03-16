// components/layout/header.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export function GlobalHeader() {
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingCounts, setPendingCounts] = useState({ rx: 0, lab: 0, preauth: 0 });

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') { setShowResults(false); inputRef.current?.blur(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Load pending counts for notification bell
  useEffect(() => {
    if (!sb()) return;
    async function loadCounts() {
      const today = new Date().toISOString().split('T')[0];
      const [rx, lab, pa] = await Promise.all([
        sb().from('hmis_pharmacy_dispensing').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        sb().from('hmis_emr_encounters').select('id', { count: 'exact', head: true }).not('investigations', 'eq', '[]').gte('encounter_date', today),
        sb().from('hmis_pre_auth_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setPendingCounts({ rx: rx.count || 0, lab: lab.count || 0, preauth: pa.count || 0 });
    }
    loadCounts();
    const interval = setInterval(loadCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchQ.length < 2 || !sb()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${searchQ}%,first_name.ilike.%${searchQ}%,last_name.ilike.%${searchQ}%,phone_primary.ilike.%${searchQ}%`)
        .eq('is_active', true).limit(8);
      setResults(data || []);
      setShowResults(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Click outside to close
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 py-2.5" ref={ref}>
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        {/* Global Search */}
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search patient by name, UHID, or phone..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors"
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {results.map(p => (
                <Link
                  key={p.id}
                  href={`/patients/${p.id}`}
                  onClick={() => { setShowResults(false); setSearchQ(''); }}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 border-b last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-gray-400">{p.uhid} | {p.age_years}/{p.gender?.charAt(0).toUpperCase()} | {p.phone_primary}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={`/emr-v2?patient=${p.id}`} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100">EMR</Link>
                    <Link href={`/patients/${p.id}`} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded hover:bg-gray-100">Profile</Link>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {searchQ.length >= 2 && results.length === 0 && showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-4 text-center">
              <p className="text-sm text-gray-400">No patients found</p>
              <Link href="/patients" className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block">Register new patient</Link>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="flex items-center gap-3">
          {pendingCounts.rx > 0 && <Link href="/pharmacy" className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-lg hover:bg-yellow-100 transition-colors">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />{pendingCounts.rx} Rx</Link>}
          {pendingCounts.lab > 0 && <Link href="/lab" className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100 transition-colors">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />{pendingCounts.lab} Lab</Link>}
          {pendingCounts.preauth > 0 && <Link href="/insurance" className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-lg hover:bg-purple-100 transition-colors">
            <span className="w-2 h-2 bg-purple-500 rounded-full" />{pendingCounts.preauth} PA</Link>}
        </div>

        {/* Keyboard hint */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border text-[10px]">Ctrl+K</kbd>
          <span>Search</span>
        </div>
      </div>
    </div>
  );
}
