'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Search, Users, Calendar, BedDouble, CreditCard, FlaskConical, Pill,
  FileText, Settings, BarChart3, Activity, Stethoscope, Scissors, Plus,
  ArrowRight, Mic, Heart, Shield, Truck, AlertTriangle,
} from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: any;
  category: 'patient' | 'navigation' | 'action' | 'bill' | 'recent';
  href?: string;
  action?: () => void;
  keywords?: string;
}

const NAV_ITEMS: CommandItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: Activity, category: 'navigation', href: '/', keywords: 'home main' },
  { id: 'nav-pulse', label: 'Hospital Pulse', icon: Heart, category: 'navigation', href: '/pulse', keywords: 'live command center' },
  { id: 'nav-opd', label: 'OPD Queue', icon: Users, category: 'navigation', href: '/opd', keywords: 'outpatient queue token' },
  { id: 'nav-appointments', label: 'Appointments', icon: Calendar, category: 'navigation', href: '/appointments', keywords: 'book schedule slot' },
  { id: 'nav-emergency', label: 'Emergency / ER', icon: AlertTriangle, category: 'navigation', href: '/emergency', keywords: 'triage trauma mlc' },
  { id: 'nav-ipd', label: 'IPD Admissions', icon: BedDouble, category: 'navigation', href: '/ipd', keywords: 'inpatient admit' },
  { id: 'nav-emr', label: 'EMR', icon: Stethoscope, category: 'navigation', href: '/emr-v2', keywords: 'encounter medical record' },
  { id: 'nav-voice', label: 'Voice Notes', icon: Mic, category: 'navigation', href: '/voice-notes', keywords: 'speak dictate' },
  { id: 'nav-billing', label: 'Billing', icon: CreditCard, category: 'navigation', href: '/billing', keywords: 'bill invoice payment' },
  { id: 'nav-lab', label: 'Laboratory', icon: FlaskConical, category: 'navigation', href: '/lab', keywords: 'test blood cbc' },
  { id: 'nav-pharmacy', label: 'Pharmacy', icon: Pill, category: 'navigation', href: '/pharmacy', keywords: 'medicine drug dispense' },
  { id: 'nav-radiology', label: 'Radiology', icon: FileText, category: 'navigation', href: '/radiology', keywords: 'xray ct mri ultrasound' },
  { id: 'nav-ot', label: 'OT Management', icon: Scissors, category: 'navigation', href: '/ot', keywords: 'surgery operation theatre' },
  { id: 'nav-beds', label: 'Bed Management', icon: BedDouble, category: 'navigation', href: '/bed-management', keywords: 'ward room' },
  { id: 'nav-crm', label: 'CRM & Leads', icon: Users, category: 'navigation', href: '/crm', keywords: 'lead pipeline sales' },
  { id: 'nav-reports', label: 'Reports', icon: BarChart3, category: 'navigation', href: '/reports', keywords: 'mis analytics export' },
  { id: 'nav-staff', label: 'Staff & Access', icon: Users, category: 'navigation', href: '/staff', keywords: 'employee user role' },
  { id: 'nav-settings', label: 'Settings', icon: Settings, category: 'navigation', href: '/settings', keywords: 'config integration' },
  { id: 'nav-cathlab', label: 'Cath Lab', icon: Heart, category: 'navigation', href: '/cathlab', keywords: 'cag ptca stent angiography' },
  { id: 'nav-dialysis', label: 'Dialysis', icon: Activity, category: 'navigation', href: '/dialysis', keywords: 'hd session machine' },
  { id: 'nav-ambulance', label: 'Ambulance', icon: Truck, category: 'navigation', href: '/ambulance', keywords: 'transport dispatch' },
  { id: 'nav-quality', label: 'Quality / NABH', icon: Shield, category: 'navigation', href: '/quality', keywords: 'kpi indicator audit' },
  { id: 'nav-assets', label: 'Assets', icon: Settings, category: 'navigation', href: '/assets', keywords: 'equipment depreciation amc' },
  { id: 'nav-grievances', label: 'Grievances', icon: AlertTriangle, category: 'navigation', href: '/grievances', keywords: 'complaint feedback' },
  { id: 'nav-telemedicine', label: 'Telemedicine', icon: Stethoscope, category: 'navigation', href: '/telemedicine', keywords: 'video call consult' },
];

const ACTION_ITEMS: CommandItem[] = [
  { id: 'act-new-opd', label: 'Register New OPD Visit', icon: Plus, category: 'action', href: '/opd', keywords: 'create token' },
  { id: 'act-new-patient', label: 'Register New Patient', icon: Plus, category: 'action', href: '/patients/register', keywords: 'create add' },
  { id: 'act-new-bill', label: 'Create New Bill', icon: Plus, category: 'action', href: '/billing', keywords: 'invoice charge' },
  { id: 'act-new-admission', label: 'New IPD Admission', icon: Plus, category: 'action', href: '/ipd', keywords: 'admit inpatient' },
  { id: 'act-er-register', label: 'ER Registration', icon: AlertTriangle, category: 'action', href: '/emergency', keywords: 'emergency triage' },
  { id: 'act-voice', label: 'Start Voice Note', icon: Mic, category: 'action', href: '/voice-notes', keywords: 'speak dictate' },
  { id: 'act-teleconsult', label: 'Schedule Teleconsult', icon: Stethoscope, category: 'action', href: '/telemedicine', keywords: 'video call' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [patients, setPatients] = useState<CommandItem[]>([]);
  const [bills, setBills] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Search patients + bills from DB
  useEffect(() => {
    if (query.length < 2 || !sb()) { setPatients([]); setBills([]); return; }
    const t = setTimeout(async () => {
      const [patRes, billRes] = await Promise.all([
        sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
          .or(`uhid.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_primary.ilike.%${query}%`)
          .eq('is_active', true).limit(5),
        sb().from('hmis_bills').select('id, bill_number, net_amount, patient:hmis_patients!inner(first_name, last_name)')
          .or(`bill_number.ilike.%${query}%`).limit(3),
      ]);
      setPatients((patRes.data || []).map((p: any) => ({
        id: `pat-${p.id}`, label: `${p.first_name} ${p.last_name}`,
        description: `${p.uhid} · ${p.age_years || '?'}/${p.gender?.charAt(0) || '?'} · ${p.phone_primary || ''}`,
        icon: Users, category: 'patient' as const, href: `/patients/${p.id}`,
      })));
      setBills((billRes.data || []).map((b: any) => ({
        id: `bill-${b.id}`, label: `Bill ${b.bill_number}`,
        description: `${b.patient?.first_name} ${b.patient?.last_name} · ₹${Math.round(b.net_amount).toLocaleString('en-IN')}`,
        icon: CreditCard, category: 'bill' as const, href: `/billing`,
      })));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Combine and filter results
  useEffect(() => {
    if (!query) { setResults([...ACTION_ITEMS.slice(0, 5), ...NAV_ITEMS.slice(0, 8)]); setSelectedIndex(0); return; }
    const q = query.toLowerCase();
    const navMatches = NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q) || n.keywords?.includes(q));
    const actMatches = ACTION_ITEMS.filter(a => a.label.toLowerCase().includes(q) || a.keywords?.includes(q));
    setResults([...patients, ...bills, ...actMatches, ...navMatches].slice(0, 12));
    setSelectedIndex(0);
  }, [query, patients, bills]);

  // Keyboard navigation
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIndex]) { execute(results[selectedIndex]); }
  };

  const execute = (item: CommandItem) => {
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
    setOpen(false); setQuery('');
  };

  const categoryLabel = (c: string) => ({ patient: 'Patients', navigation: 'Navigate', action: 'Quick Actions', bill: 'Bills', recent: 'Recent' }[c] || c);
  const categoryIcon = (c: string) => ({ patient: Users, navigation: ArrowRight, action: Plus, bill: CreditCard, recent: Activity }[c] || Search);

  if (!open) return null;

  // Group by category
  const grouped: Record<string, CommandItem[]> = {};
  results.forEach(r => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r); });
  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => { setOpen(false); setQuery(''); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
            className="flex-1 text-sm outline-none placeholder:text-gray-400" placeholder="Search patients, pages, actions..." autoComplete="off" />
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] text-gray-400 font-mono border">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-5 pt-3 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">{categoryLabel(category)}</div>
              {items.map(item => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => execute(item)} onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-teal-100' : 'bg-gray-100'}`}>
                      <Icon size={15} className={isSelected ? 'text-teal-700' : 'text-gray-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isSelected ? 'text-teal-800' : 'text-gray-800'}`}>{item.label}</div>
                      {item.description && <div className="text-[10px] text-gray-400 truncate">{item.description}</div>}
                    </div>
                    {isSelected && <ArrowRight size={14} className="text-teal-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
          {results.length === 0 && query.length >= 2 && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No results for "{query}"</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t bg-gray-50/50 flex items-center gap-4 text-[9px] text-gray-400">
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded font-mono text-[8px]">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded font-mono text-[8px]">↵</kbd> select</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded font-mono text-[8px]">esc</kbd> close</span>
          <span className="ml-auto">Health1 HMIS</span>
        </div>
      </div>
    </div>
  );
}
