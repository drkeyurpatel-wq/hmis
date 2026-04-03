'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase/browser';
import {
  Search, Users, Calendar, BedDouble, CreditCard, FlaskConical, Pill,
  FileText, Settings, BarChart3, Activity, Stethoscope, Scissors, Plus,
  ArrowRight, Shield, AlertTriangle, Heart, Truck, Mic, Droplets,
  Dumbbell, Eye, UserPlus, SprayCan, Wrench, Star, ClipboardList,
  TestTube, ArrowUpRight, Video, ShoppingCart,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import type { CentreType } from '@/types/database';

type Mode = CentreType;

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: any;
  category: 'patient' | 'navigation' | 'action' | 'bill' | 'recent';
  href?: string;
  action?: () => void;
  keywords?: string;
  modes?: Mode[];  // undefined = show in all modes
}

const NAV_ITEMS: CommandItem[] = [
  // Both modes
  { id: 'nav-dashboard', label: 'Dashboard', icon: Activity, category: 'navigation', href: '/', keywords: 'home main' },
  { id: 'nav-opd', label: 'OPD Queue', icon: Users, category: 'navigation', href: '/opd', keywords: 'outpatient queue token' },
  { id: 'nav-billing', label: 'Billing', icon: CreditCard, category: 'navigation', href: '/billing', keywords: 'bill invoice payment' },
  { id: 'nav-reports', label: 'Reports', icon: BarChart3, category: 'navigation', href: '/reports', keywords: 'mis analytics export' },
  { id: 'nav-settings', label: 'Settings', icon: Settings, category: 'navigation', href: '/settings', keywords: 'config integration' },

  // Clinic-only
  { id: 'nav-clinic-pos', label: 'Pharmacy POS', icon: ShoppingCart, category: 'navigation', href: '/clinic/pharmacy-pos', keywords: 'sale medicine tablet counter', modes: ['clinic'] },
  { id: 'nav-clinic-lab', label: 'Lab Collection', icon: TestTube, category: 'navigation', href: '/clinic/lab-collection', keywords: 'sample blood barcode batch', modes: ['clinic'] },
  { id: 'nav-clinic-ref', label: 'Refer to Hospital', icon: ArrowUpRight, category: 'navigation', href: '/clinic/referral', keywords: 'refer hub specialist', modes: ['clinic'] },
  { id: 'nav-clinic-tele', label: 'Teleconsult', icon: Video, category: 'navigation', href: '/clinic/teleconsult', keywords: 'video call specialist', modes: ['clinic'] },

  // Hospital-only
  { id: 'nav-pulse', label: 'Hospital Pulse', icon: Heart, category: 'navigation', href: '/pulse', keywords: 'live command center', modes: ['hospital'] },
  { id: 'nav-command', label: 'Command Centre', icon: Activity, category: 'navigation', href: '/command-centre', keywords: 'ops overview', modes: ['hospital'] },
  { id: 'nav-appointments', label: 'Appointments', icon: Calendar, category: 'navigation', href: '/appointments', keywords: 'book schedule slot', modes: ['hospital'] },
  { id: 'nav-emergency', label: 'Emergency / ER', icon: AlertTriangle, category: 'navigation', href: '/emergency', keywords: 'triage trauma mlc', modes: ['hospital'] },
  { id: 'nav-ipd', label: 'IPD Admissions', icon: BedDouble, category: 'navigation', href: '/ipd', keywords: 'inpatient admit', modes: ['hospital'] },
  { id: 'nav-emr', label: 'EMR', icon: Stethoscope, category: 'navigation', href: '/emr-v2', keywords: 'encounter medical record', modes: ['hospital'] },
  { id: 'nav-voice', label: 'Voice Notes', icon: Mic, category: 'navigation', href: '/voice-notes', keywords: 'speak dictate', modes: ['hospital'] },
  { id: 'nav-pnl', label: 'P&L', icon: BarChart3, category: 'navigation', href: '/pnl', keywords: 'profit loss revenue', modes: ['hospital'] },
  { id: 'nav-lab', label: 'Laboratory', icon: FlaskConical, category: 'navigation', href: '/lab', keywords: 'test blood cbc', modes: ['hospital'] },
  { id: 'nav-pharmacy', label: 'Pharmacy', icon: Pill, category: 'navigation', href: '/pharmacy', keywords: 'medicine drug dispense', modes: ['hospital'] },
  { id: 'nav-radiology', label: 'Radiology', icon: FileText, category: 'navigation', href: '/radiology', keywords: 'xray ct mri ultrasound', modes: ['hospital'] },
  { id: 'nav-ot', label: 'OT Management', icon: Scissors, category: 'navigation', href: '/ot', keywords: 'surgery operation theatre', modes: ['hospital'] },
  { id: 'nav-cathlab', label: 'Cath Lab', icon: Heart, category: 'navigation', href: '/cathlab', keywords: 'cag ptca stent angiography', modes: ['hospital'] },
  { id: 'nav-endoscopy', label: 'Endoscopy', icon: Eye, category: 'navigation', href: '/endoscopy', keywords: 'gi scope colonoscopy', modes: ['hospital'] },
  { id: 'nav-dialysis', label: 'Dialysis', icon: Droplets, category: 'navigation', href: '/dialysis', keywords: 'hd session machine', modes: ['hospital'] },
  { id: 'nav-physio', label: 'Physiotherapy', icon: Dumbbell, category: 'navigation', href: '/physiotherapy', keywords: 'rehab exercise', modes: ['hospital'] },
  { id: 'nav-beds', label: 'Bed Management', icon: BedDouble, category: 'navigation', href: '/bed-management', keywords: 'ward room', modes: ['hospital'] },
  { id: 'nav-blood', label: 'Blood Bank', icon: Droplets, category: 'navigation', href: '/blood-bank', keywords: 'donation crossmatch', modes: ['hospital'] },
  { id: 'nav-insurance', label: 'Insurance', icon: Shield, category: 'navigation', href: '/insurance', keywords: 'cashless tpa preauth', modes: ['hospital'] },
  { id: 'nav-leakage', label: 'Revenue Leakage', icon: AlertTriangle, category: 'navigation', href: '/revenue-leakage', keywords: 'unbilled missed charge', modes: ['hospital'] },
  { id: 'nav-cssd', label: 'CSSD', icon: Shield, category: 'navigation', href: '/cssd', keywords: 'sterilization autoclave', modes: ['hospital'] },
  { id: 'nav-housekeeping', label: 'Housekeeping', icon: SprayCan, category: 'navigation', href: '/housekeeping', keywords: 'cleaning schedule', modes: ['hospital'] },
  { id: 'nav-equipment', label: 'Equipment', icon: Wrench, category: 'navigation', href: '/biomedical', keywords: 'maintenance amc calibration', modes: ['hospital'] },
  { id: 'nav-duty', label: 'Duty Roster', icon: ClipboardList, category: 'navigation', href: '/duty-roster', keywords: 'shift schedule rota', modes: ['hospital'] },
  { id: 'nav-vpms', label: 'Procurement', icon: Truck, category: 'navigation', href: '/vpms', keywords: 'vendor purchase indent', modes: ['hospital'] },
  { id: 'nav-crm', label: 'CRM & Leads', icon: Users, category: 'navigation', href: '/crm', keywords: 'lead pipeline sales', modes: ['hospital'] },
  { id: 'nav-referrals', label: 'Referrals', icon: UserPlus, category: 'navigation', href: '/referrals', keywords: 'refer doctor hospital', modes: ['hospital'] },
  { id: 'nav-ref-queue', label: 'Clinic Referrals Queue', icon: ArrowUpRight, category: 'navigation', href: '/referrals/clinic-queue', keywords: 'clinic spoke referral', modes: ['hospital'] },
  { id: 'nav-sample-recv', label: 'Sample Receiving', icon: TestTube, category: 'navigation', href: '/lab/sample-receiving', keywords: 'clinic sample batch receive', modes: ['hospital'] },
  { id: 'nav-quality', label: 'Quality / NABH', icon: Shield, category: 'navigation', href: '/quality', keywords: 'kpi indicator audit', modes: ['hospital'] },
  { id: 'nav-px', label: 'Patient Experience', icon: Star, category: 'navigation', href: '/px-coordinator', keywords: 'feedback satisfaction', modes: ['hospital'] },
  { id: 'nav-staff', label: 'Staff & Access', icon: Users, category: 'navigation', href: '/staff', keywords: 'employee user role', modes: ['hospital'] },
  { id: 'nav-equip-life', label: 'Equipment Lifecycle', icon: Settings, category: 'navigation', href: '/equipment-lifecycle', keywords: 'amc calibration maintenance', modes: ['hospital'] },
  { id: 'nav-linen', label: 'Linen', icon: Settings, category: 'navigation', href: '/linen', keywords: 'laundry exchange', modes: ['hospital'] },
  { id: 'nav-infection', label: 'Infection Control', icon: Shield, category: 'navigation', href: '/infection-control', keywords: 'hai surveillance hygiene', modes: ['hospital'] },
  { id: 'nav-dietary', label: 'Dietary', icon: Settings, category: 'navigation', href: '/dietary', keywords: 'food kitchen diet meal', modes: ['hospital'] },
  { id: 'nav-ambulance', label: 'Ambulance', icon: AlertTriangle, category: 'navigation', href: '/ambulance', keywords: 'transport dispatch vehicle', modes: ['hospital'] },
  { id: 'nav-mortuary', label: 'Mortuary', icon: Settings, category: 'navigation', href: '/mortuary', keywords: 'body deceased', modes: ['hospital'] },
  { id: 'nav-visitors', label: 'Visitors', icon: Users, category: 'navigation', href: '/visitors', keywords: 'visitor pass gate', modes: ['hospital'] },
  { id: 'nav-grievances', label: 'Grievances', icon: AlertTriangle, category: 'navigation', href: '/grievances', keywords: 'complaint feedback', modes: ['hospital'] },
  { id: 'nav-documents', label: 'Documents', icon: FileText, category: 'navigation', href: '/documents', keywords: 'sop policy protocol', modes: ['hospital'] },
  { id: 'nav-assets', label: 'Assets', icon: Settings, category: 'navigation', href: '/assets', keywords: 'inventory fixed asset depreciation', modes: ['hospital'] },
  { id: 'nav-consent', label: 'Digital Consent', icon: FileText, category: 'navigation', href: '/digital-consent', keywords: 'consent form signature', modes: ['hospital'] },
  { id: 'nav-surgical', label: 'Surgical Planning', icon: Scissors, category: 'navigation', href: '/surgical-planning', keywords: 'pre-op checklist readiness', modes: ['hospital'] },
  { id: 'nav-homecare', label: 'Homecare', icon: Users, category: 'navigation', href: '/homecare', keywords: 'home visit wound care', modes: ['hospital'] },
  { id: 'nav-tele', label: 'Telemedicine', icon: Stethoscope, category: 'navigation', href: '/telemedicine', keywords: 'video call teleconsult', modes: ['hospital'] },
  { id: 'nav-handover', label: 'Shift Handover', icon: FileText, category: 'navigation', href: '/handover', keywords: 'shift change nurse report', modes: ['hospital'] },
  { id: 'nav-onboarding', label: 'Centre Setup', icon: Settings, category: 'navigation', href: '/onboarding', keywords: 'new centre hospital setup', modes: ['hospital'] },
  { id: 'nav-packages', label: 'Packages', icon: CreditCard, category: 'navigation', href: '/packages', keywords: 'bundle package rate', modes: ['hospital'] },
  { id: 'nav-emr-mobile', label: 'EMR Mobile', icon: Stethoscope, category: 'navigation', href: '/emr-mobile', keywords: 'mobile bedside tablet', modes: ['hospital'] },
  { id: 'nav-accounting', label: 'Accounting', icon: BarChart3, category: 'navigation', href: '/accounting', keywords: 'journal ledger chart accounts', modes: ['hospital'] },
  { id: 'nav-bed-turnover', label: 'Bed Turnover', icon: BedDouble, category: 'navigation', href: '/bed-turnover', keywords: 'turnover housekeeping ready', modes: ['hospital'] },
];

const ACTION_ITEMS: CommandItem[] = [
  // Both modes
  { id: 'act-new-opd', label: 'Register New OPD Visit', icon: Plus, category: 'action', href: '/opd', keywords: 'create token' },
  { id: 'act-new-patient', label: 'Register New Patient', icon: Plus, category: 'action', href: '/patients/register', keywords: 'create add' },
  { id: 'act-new-bill', label: 'Create New Bill', icon: Plus, category: 'action', href: '/billing', keywords: 'invoice charge' },
  // Hospital-only
  { id: 'act-new-admission', label: 'New IPD Admission', icon: Plus, category: 'action', href: '/ipd', keywords: 'admit inpatient', modes: ['hospital'] },
  { id: 'act-er-register', label: 'ER Registration', icon: AlertTriangle, category: 'action', href: '/emergency', keywords: 'emergency triage', modes: ['hospital'] },
  { id: 'act-voice', label: 'Start Voice Note', icon: Mic, category: 'action', href: '/voice-notes', keywords: 'speak dictate', modes: ['hospital'] },
  // Clinic-only
  { id: 'act-pharmacy-sale', label: 'New Pharmacy Sale', icon: ShoppingCart, category: 'action', href: '/clinic/pharmacy-pos', keywords: 'sell medicine pos', modes: ['clinic'] },
  { id: 'act-lab-collect', label: 'Collect Lab Sample', icon: TestTube, category: 'action', href: '/clinic/lab-collection', keywords: 'sample blood', modes: ['clinic'] },
  { id: 'act-refer', label: 'Refer to Hospital', icon: ArrowUpRight, category: 'action', href: '/clinic/referral', keywords: 'refer hub specialist', modes: ['clinic'] },
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
  const { isClinicMode } = useAuthStore();
  const currentMode: Mode = isClinicMode ? 'clinic' : 'hospital';

  // Filter items by current mode (undefined modes = show in all)
  const modeFilter = useCallback((item: CommandItem) =>
    !item.modes || item.modes.includes(currentMode), [currentMode]);
  const filteredNav = NAV_ITEMS.filter(modeFilter);
  const filteredActions = ACTION_ITEMS.filter(modeFilter);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Search patients + bills + beds + admissions + labs from DB
  useEffect(() => {
    if (query.length < 2 || !sb()) { setPatients([]); setBills([]); return; }
    const q = query.toLowerCase();
    const t = setTimeout(async () => {
      // Smart intent detection
      const intents: CommandItem[] = [];
      if (q.includes('icu') && (q.includes('free') || q.includes('available') || q.includes('bed'))) {
        intents.push({ id: 'intent-icu-beds', label: 'ICU — Available Beds', description: 'View free ICU beds on Ward Board', icon: BedDouble, category: 'action', href: '/ward-board' });
      }
      if (q.includes('discharge') && (q.includes('today') || q.includes('pending'))) {
        intents.push({ id: 'intent-disch', label: 'Pending Discharges', description: 'Patients with discharge initiated', icon: BedDouble, category: 'action', href: '/ipd' });
      }
      if (q.startsWith('admit ') || q.startsWith('new admission')) {
        intents.push({ id: 'intent-admit', label: 'New IPD Admission', description: 'Start admission wizard', icon: Plus, category: 'action', href: '/ipd' });
      }
      if (q.startsWith('new ') && (q.includes('opd') || q.includes('visit') || q.includes('token'))) {
        intents.push({ id: 'intent-opd', label: 'Create OPD Visit', description: 'Register walk-in or appointment', icon: Plus, category: 'action', href: '/opd' });
      }
      if (q.startsWith('new patient') || q.startsWith('register')) {
        intents.push({ id: 'intent-reg', label: 'Register New Patient', description: 'Create UHID', icon: Plus, category: 'action', href: '/patients/register' });
      }
      if (q.includes('schedule') && (q.includes('dr') || q.includes('doctor'))) {
        intents.push({ id: 'intent-sched', label: 'Doctor Schedules', description: 'View/edit OPD schedules', icon: Calendar, category: 'action', href: '/appointments' });
      }
      if (q.includes('bill') && q.includes('new')) {
        intents.push({ id: 'intent-bill', label: 'Create New Bill', description: 'Start billing', icon: CreditCard, category: 'action', href: '/billing' });
      }
      if (q.includes('revenue') || q.includes('leakage') || q.includes('unbilled')) {
        intents.push({ id: 'intent-leak', label: 'Revenue Leakage Scanner', description: 'Find unbilled charges', icon: AlertTriangle, category: 'action', href: '/revenue-leakage' });
      }

      // Parallel DB searches
      const searchToken = query.trim();
      const [patRes, billRes, admRes, labRes] = await Promise.all([
        sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
          .or(`uhid.ilike.%${searchToken}%,first_name.ilike.%${searchToken}%,last_name.ilike.%${searchToken}%,phone_primary.ilike.%${searchToken}%`)
          .eq('is_active', true).limit(5),
        sb().from('hmis_bills').select('id, bill_number, net_amount, patient:hmis_patients!inner(first_name, last_name)')
          .or(`bill_number.ilike.%${searchToken}%`).limit(3),
        sb().from('hmis_admissions').select('id, ipd_number, status, patient:hmis_patients!inner(id, first_name, last_name, uhid)')
          .or(`ipd_number.ilike.%${searchToken}%`)
          .in('status', ['active', 'discharge_initiated']).limit(3),
        // Search lab orders by patient name
        sb().from('hmis_lab_orders').select('id, test_name, status, patient:hmis_patients!inner(id, first_name, last_name)')
          .eq('status', 'completed')
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .limit(3),
      ]);

      const patItems = (patRes.data || []).map((p: any) => ({
        id: `pat-${p.id}`, label: `${p.first_name} ${p.last_name}`,
        description: `${p.uhid} · ${p.age_years || '?'}/${p.gender?.charAt(0) || '?'} · ${p.phone_primary || ''}`,
        icon: Users, category: 'patient' as const, href: `/patients/${p.id}`,
      }));

      const billItems = (billRes.data || []).map((b: any) => ({
        id: `bill-${b.id}`, label: `Bill ${b.bill_number}`,
        description: `${b.patient?.first_name} ${b.patient?.last_name} · ₹${Math.round(b.net_amount).toLocaleString('en-IN')}`,
        icon: CreditCard, category: 'bill' as const, href: `/billing`,
      }));

      // Lab results — only show if patient name matches query
      const labItems: CommandItem[] = [];
      for (const lab of labRes.data || []) {
        const pt = lab.patient as any;
        const name = `${pt?.first_name || ''} ${pt?.last_name || ''}`.toLowerCase();
        if (name.includes(q) || lab.test_name.toLowerCase().includes(q)) {
          labItems.push({
            id: `lab-${lab.id}`, label: `${pt?.first_name} ${pt?.last_name} — ${lab.test_name}`,
            description: `${lab.status} · Last 7 days`,
            icon: FlaskConical, category: 'patient' as const, href: `/patients/${pt?.id}`,
          });
        }
      }

      // Admission results
      const admItems = (admRes.data || []).map((a: any) => ({
        id: `adm-${a.id}`, label: `IPD ${a.ipd_number} — ${a.patient?.first_name} ${a.patient?.last_name}`,
        description: `Status: ${a.status.replace('_', ' ')}`,
        icon: BedDouble, category: 'patient' as const, href: `/ipd/${a.id}`,
      }));

      setPatients([...intents, ...patItems, ...admItems, ...labItems.slice(0, 3)]);
      setBills(billItems);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Combine and filter results
  useEffect(() => {
    if (!query) { setResults([...filteredActions.slice(0, 5), ...filteredNav.slice(0, 8)]); setSelectedIndex(0); return; }
    const q = query.toLowerCase();
    const navMatches = filteredNav.filter(n => n.label.toLowerCase().includes(q) || n.keywords?.includes(q));
    const actMatches = filteredActions.filter(a => a.label.toLowerCase().includes(q) || a.keywords?.includes(q));
    setResults([...patients, ...bills, ...actMatches, ...navMatches].slice(0, 12));
    setSelectedIndex(0);
  }, [query, patients, bills, filteredNav, filteredActions]);

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
          <span className="ml-auto">HMIS</span>
        </div>
      </div>
    </div>
  );
}
