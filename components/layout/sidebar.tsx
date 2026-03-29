'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard, Users, Calendar, BedDouble, Stethoscope,
  CreditCard, Pill, FlaskConical, ScanLine, Scissors, BarChart3,
  Settings, LogOut, Building2, ChevronDown, ChevronRight, Droplets,
  Heart, PanelLeftClose, PanelLeft, Shield, Siren,
  Activity, Truck, FileText, Wrench, SprayCan, Shirt,
  ClipboardList, UtensilsCrossed, Dumbbell, AlertTriangle,
  Package, Eye, UserPlus, MessageSquare, SlidersHorizontal,
  MoreHorizontal, Star, Cross, Home, Mic,
} from 'lucide-react';

interface NavItem { href: string; label: string; icon: any; moduleKey?: string }

// ===================================================================
// ROLE-BASED PRIMARY NAV — what each role sees first (5-8 items)
// ===================================================================
const ROLE_NAV: Record<string, NavItem[]> = {
  doctor: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/opd', label: 'OPD Queue', icon: Calendar, moduleKey: 'opd' },
    { href: '/ipd', label: 'My Patients', icon: Heart, moduleKey: 'ipd' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/lab', label: 'Lab Results', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Imaging', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/ot', label: 'OT Schedule', icon: Scissors, moduleKey: 'ot' },
  ],
  consultant: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/opd', label: 'OPD Queue', icon: Calendar, moduleKey: 'opd' },
    { href: '/ipd', label: 'My Patients', icon: Heart, moduleKey: 'ipd' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/lab', label: 'Lab Results', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Imaging', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/ot', label: 'OT Schedule', icon: Scissors, moduleKey: 'ot' },
  ],
  nurse: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/nursing-station', label: 'Nursing Station', icon: Heart, moduleKey: 'nursing' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/emergency', label: 'Emergency', icon: Siren, moduleKey: 'emergency' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, moduleKey: 'pharmacy' },
    { href: '/px-nursing', label: 'Patient Requests', icon: Star, moduleKey: 'px_nursing' },
  ],
  receptionist: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/appointments', label: 'Appointments', icon: Calendar, moduleKey: 'opd' },
    { href: '/opd', label: 'OPD', icon: Stethoscope, moduleKey: 'opd' },
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/ipd', label: 'Admissions', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
  ],
  pharmacist: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pharmacy', label: 'Dispensing', icon: Pill, moduleKey: 'pharmacy' },
    { href: '/vpms', label: 'Procurement', icon: Truck, moduleKey: 'procurement' },
    { href: '/patients', label: 'Patients', icon: Users },
  ],
  lab_tech: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/lab', label: 'Lab Worklist', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, moduleKey: 'blood_bank' },
  ],
  accountant: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/pnl', label: 'P&L', icon: BarChart3, moduleKey: 'billing' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/revenue-leakage', label: 'Revenue Leakage', icon: AlertTriangle, moduleKey: 'revenue_leakage' },
  ],
  admin: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/command-centre', label: 'Command Centre', icon: Activity },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/opd', label: 'OPD', icon: Calendar, moduleKey: 'opd' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/lab', label: 'Lab', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/px-coordinator', label: 'Patient Experience', icon: Star, moduleKey: 'px_coordinator' },
  ],
};

// ===================================================================
// ALL MODULES — accessible via "More" (collapsed by default)
// ===================================================================
const MORE_NAV: { label: string; items: NavItem[] }[] = [
  { label: 'CLINICAL', items: [
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/opd', label: 'OPD', icon: Calendar, moduleKey: 'opd' },
    { href: '/emr-v2', label: 'EMR', icon: Stethoscope, moduleKey: 'emr' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/nursing-station', label: 'Nursing Station', icon: Heart, moduleKey: 'nursing' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/emergency', label: 'Emergency', icon: Siren, moduleKey: 'emergency' },
    { href: '/ot', label: 'OT & Surgery', icon: Scissors, moduleKey: 'ot' },
    { href: '/surgical-planning', label: 'Surgical Planning', icon: ClipboardList, moduleKey: 'ot' },
    { href: '/cathlab', label: 'Cath Lab', icon: Heart, moduleKey: 'cathlab' },
    { href: '/endoscopy', label: 'Endoscopy', icon: Eye, moduleKey: 'endoscopy' },
    { href: '/dialysis', label: 'Dialysis', icon: Droplets, moduleKey: 'dialysis' },
    { href: '/physiotherapy', label: 'Physiotherapy', icon: Dumbbell, moduleKey: 'physiotherapy' },
    { href: '/referrals', label: 'Referrals', icon: UserPlus, moduleKey: 'referrals' },
    { href: '/digital-consent', label: 'Digital Consent', icon: FileText, moduleKey: 'digital_consent' },
    { href: '/dietary', label: 'Dietary', icon: UtensilsCrossed, moduleKey: 'dietary' },
    { href: '/homecare', label: 'Homecare', icon: Home, moduleKey: 'homecare' },
    { href: '/telemedicine', label: 'Telemedicine', icon: Stethoscope, moduleKey: 'telemedicine' },
    { href: '/voice-notes', label: 'Voice Notes', icon: Mic, moduleKey: 'emr' },
    { href: '/emr-mobile', label: 'EMR Mobile', icon: Heart, moduleKey: 'emr' },
  ]},
  { label: 'DIAGNOSTICS & PHARMACY', items: [
    { href: '/lab', label: 'Laboratory', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Radiology', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, moduleKey: 'blood_bank' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, moduleKey: 'pharmacy' },
  ]},
  { label: 'PATIENT EXPERIENCE', items: [
    { href: '/px-coordinator', label: 'PX Coordinator', icon: Star, moduleKey: 'px_coordinator' },
    { href: '/px-nursing', label: 'PX Nursing', icon: Star, moduleKey: 'px_nursing' },
    { href: '/px-kitchen', label: 'PX Kitchen', icon: UtensilsCrossed, moduleKey: 'px_kitchen' },
    { href: '/px-feedback', label: 'PX Feedback', icon: MessageSquare, moduleKey: 'px_feedback' },
    { href: '/grievances', label: 'Grievances', icon: AlertTriangle, moduleKey: 'grievances' },
    { href: '/visitors', label: 'Visitors', icon: Users, moduleKey: 'visitors' },
  ]},
  { label: 'REVENUE & BILLING', items: [
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/pnl', label: 'P&L', icon: BarChart3, moduleKey: 'billing' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
    { href: '/revenue-leakage', label: 'Revenue Leakage', icon: AlertTriangle, moduleKey: 'revenue_leakage' },
    { href: '/packages', label: 'Packages', icon: Package, moduleKey: 'billing' },
    { href: '/appointments', label: 'Appointments', icon: Calendar, moduleKey: 'opd' },
    { href: '/crm', label: 'CRM', icon: MessageSquare, moduleKey: 'crm' },
    { href: '/accounting', label: 'Accounting', icon: BarChart3, moduleKey: 'billing' },
  ]},
  { label: 'OPERATIONS', items: [
    { href: '/vpms', label: 'Procurement', icon: Truck, moduleKey: 'procurement' },
    { href: '/cssd', label: 'CSSD', icon: Shield, moduleKey: 'cssd' },
    { href: '/housekeeping', label: 'Housekeeping', icon: SprayCan, moduleKey: 'housekeeping' },
    { href: '/biomedical', label: 'Equipment', icon: Wrench, moduleKey: 'biomedical' },
    { href: '/equipment-lifecycle', label: 'Equipment Lifecycle', icon: Wrench, moduleKey: 'biomedical' },
    { href: '/assets', label: 'Assets', icon: Package, moduleKey: 'assets' },
    { href: '/duty-roster', label: 'Duty Roster', icon: ClipboardList, moduleKey: 'duty_roster' },
    { href: '/linen', label: 'Linen', icon: Shirt, moduleKey: 'linen' },
    { href: '/infection-control', label: 'Infection Control', icon: Shield, moduleKey: 'infection_control' },
    { href: '/ambulance', label: 'Ambulance', icon: Truck, moduleKey: 'ambulance' },
    { href: '/mortuary', label: 'Mortuary', icon: Cross, moduleKey: 'mortuary' },
    { href: '/bed-management', label: 'Bed Management', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/bed-turnover', label: 'Bed Turnover', icon: BedDouble, moduleKey: 'ipd' },
  ]},
  { label: 'ADMIN & REPORTS', items: [
    { href: '/command-centre', label: 'Command Centre', icon: Activity },
    { href: '/pulse', label: 'Hospital Pulse', icon: Heart },
    { href: '/quality', label: 'Quality / NABH', icon: Shield, moduleKey: 'quality' },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/staff', label: 'Staff', icon: Users },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/handover', label: 'Shift Handover', icon: ClipboardList },
    { href: '/onboarding', label: 'Centre Setup', icon: Settings },
    { href: '/settings/modules', label: 'Module Config', icon: SlidersHorizontal },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { staff, centres, activeCentreId, setActiveCentre, setEnabledModules, isModuleEnabled } = useAuthStore();
  const [centreOpen, setCentreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreGroup, setMoreGroup] = useState<string | null>(null);

  const activeCentre = centres.find((c: any) => c.centre_id === activeCentreId);
  const staffType = staff?.staff_type || 'admin';

  const switchCentre = useCallback(async (centreId: string) => {
    setActiveCentre(centreId);
    setCentreOpen(false);
    if (typeof window !== 'undefined') {
      const { sb } = await import('@/lib/supabase/browser');
      if (sb()) {
        const { data } = await sb()!.from('hmis_module_config')
          .select('module_key').eq('centre_id', centreId).eq('is_enabled', true);
        setEnabledModules(new Set((data || []).map((m: any) => m.module_key)));
      }
    }
  }, [setActiveCentre, setEnabledModules]);

  const canSee = (item: NavItem) => {
    if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;
    return true;
  };

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const w = collapsed ? 'w-[68px]' : 'w-[256px]';
  const initials = staff?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??';

  const primaryItems = (ROLE_NAV[staffType] || ROLE_NAV.admin).filter(canSee);
  const primaryHrefs = new Set(primaryItems.map(i => i.href));

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onMobileClose} />}
      <aside className={cn(
        'fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200 ease-in-out',
        'bg-white border-r border-gray-100',
        w,
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="w-full flex justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
              <PanelLeft size={18} />
            </button>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="8" y="0" width="12" height="28" rx="2" fill="#E8B931"/>
                  <rect x="0" y="8" width="28" height="12" rx="2" fill="#E8B931"/>
                  <rect x="9" y="1" width="10" height="26" rx="1.5" fill="#D42B2C"/>
                  <rect x="1" y="9" width="26" height="10" rx="1.5" fill="#2A9D8F"/>
                  <rect x="9" y="9" width="10" height="10" fill="#1B3A5C"/>
                </svg>
                <div>
                  <span className="text-sm font-bold text-[#1B3A5C] tracking-wide">HEALTH1</span>
                  <span className="text-[9px] text-gray-400 block -mt-0.5">HMIS</span>
                </div>
              </Link>
              <button onClick={() => setCollapsed(true)} className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer">
                <PanelLeftClose size={16} />
              </button>
            </>
          )}
        </div>

        {/* Centre Selector */}
        {!collapsed && centres.length > 1 && (
          <div className="px-3 py-2 border-b border-gray-100 relative">
            <button onClick={() => setCentreOpen(!centreOpen)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="w-5 h-5 rounded bg-h1-navy flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-white" />
              </div>
              <span className="text-xs font-medium text-gray-700 truncate flex-1">
                {(activeCentre as any)?.centre?.name?.replace('Health1 ', '').replace('Hospital ', '').replace('Super Speciality', 'SS').trim() || 'Select centre'}
              </span>
              <ChevronDown size={12} className={cn('text-gray-400 transition-transform shrink-0', centreOpen && 'rotate-180')} />
            </button>
            {centreOpen && centres.length > 0 && (
              <div className="absolute left-3 right-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                {centres.map((c: any) => (
                  <button key={c.centre_id} onClick={() => switchCentre(c.centre_id)}
                    className={cn('w-full text-left px-3 py-2 text-xs hover:bg-h1-navy-light border-b last:border-0 transition-colors cursor-pointer',
                      c.centre_id === activeCentreId ? 'bg-h1-navy-light text-h1-navy font-semibold' : 'text-gray-600')}>
                    {c.centre?.name || c.centre_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRIMARY NAV */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          <div className="space-y-0.5">
            {primaryItems.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-[8px] rounded-lg text-[13px] font-medium transition-all duration-150 relative group cursor-pointer',
                    collapsed && 'justify-center px-0',
                    active ? 'bg-h1-navy-light text-h1-navy' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                  )}
                  title={collapsed ? item.label : undefined}>
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-h1-navy rounded-r-full" />}
                  <Icon size={collapsed ? 18 : 16} className={cn('shrink-0', active ? 'text-h1-teal' : 'text-gray-400 group-hover:text-gray-600')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {!collapsed && <div className="border-t border-gray-100 my-3" />}

          {/* MORE — all modules */}
          {!collapsed && (
            <div>
              <button onClick={() => setMoreOpen(!moreOpen)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <MoreHorizontal size={16} />
                  <span>More</span>
                </div>
                <ChevronRight size={12} className={cn('transition-transform', moreOpen && 'rotate-90')} />
              </button>

              {moreOpen && (
                <div className="mt-1.5 space-y-2">
                  {MORE_NAV.map(group => {
                    const visible = group.items.filter(i => canSee(i) && !primaryHrefs.has(i.href));
                    if (visible.length === 0) return null;
                    const isGroupOpen = moreGroup === group.label;
                    const hasActiveChild = visible.some(i => isActive(i.href));

                    return (
                      <div key={group.label}>
                        <button onClick={() => setMoreGroup(isGroupOpen ? null : group.label)}
                          className={cn('w-full flex items-center justify-between px-2.5 py-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors cursor-pointer',
                            hasActiveChild && 'text-h1-teal')}>
                          <span>{group.label}</span>
                          <ChevronRight size={10} className={cn('transition-transform', isGroupOpen && 'rotate-90')} />
                        </button>
                        {isGroupOpen && (
                          <div className="space-y-0.5 ml-2 mt-0.5 border-l border-gray-100 pl-2">
                            {visible.map(item => {
                              const active = isActive(item.href);
                              const Icon = item.icon;
                              return (
                                <Link key={item.href} href={item.href} onClick={onMobileClose}
                                  className={cn(
                                    'flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[12px] font-medium transition-all cursor-pointer',
                                    active ? 'bg-h1-navy-light text-h1-navy' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700',
                                  )}>
                                  <Icon size={14} className={active ? 'text-h1-teal' : 'text-gray-300'} />
                                  <span className="truncate">{item.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* User */}
        <div className="px-2 py-2 border-t border-gray-100 shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-8 h-8 rounded-full bg-h1-teal-light flex items-center justify-center">
                <span className="text-[10px] font-bold text-h1-navy">{initials}</span>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch {}
                window.location.href = '/auth/login';
              }} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><LogOut size={14} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-h1-teal-light flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-h1-navy">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{staff?.full_name || 'Loading...'}</p>
                <p className="text-[10px] text-gray-400 truncate capitalize">{staff?.staff_type || ''}</p>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out of HMIS?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch {}
                window.location.href = '/auth/login';
              }} className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
