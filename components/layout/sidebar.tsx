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
  Home, Activity, Truck, FileText, Shield, Heart, PanelLeftClose, PanelLeft,
  Smartphone, ShieldCheck, Wrench, SprayCan, Shirt, Cross,
  Mic, ClipboardList, UtensilsCrossed, Dumbbell, AlertTriangle,
  Package, HandshakeIcon, Eye, UserPlus, Siren, MessageSquare, SlidersHorizontal,
  MoreHorizontal,
} from 'lucide-react';

interface NavItem { href: string; label: string; icon: any; moduleKey?: string }

// ===================================================================
// ROLE-BASED PRIMARY NAV — what each role sees by default (5-8 items)
// These are workflows, not modules
// ===================================================================
const ROLE_NAV: Record<string, NavItem[]> = {
  doctor: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
    { href: '/opd', label: 'OPD Queue', icon: Calendar, moduleKey: 'opd' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/ipd', label: 'My Patients (IPD)', icon: Heart, moduleKey: 'ipd' },
    { href: '/lab', label: 'Lab Results', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Imaging', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/ot', label: 'OT Schedule', icon: Scissors, moduleKey: 'ot' },
  ],
  consultant: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
    { href: '/opd', label: 'OPD Queue', icon: Calendar, moduleKey: 'opd' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/ipd', label: 'My Patients (IPD)', icon: Heart, moduleKey: 'ipd' },
    { href: '/lab', label: 'Lab Results', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Imaging', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/ot', label: 'OT Schedule', icon: Scissors, moduleKey: 'ot' },
  ],
  nurse: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/nursing-station', label: 'Nursing Station', icon: Heart, moduleKey: 'nursing' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, moduleKey: 'pharmacy' },
    { href: '/emergency', label: 'Emergency', icon: Siren, moduleKey: 'emergency' },
  ],
  receptionist: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/opd', label: 'OPD & Appointments', icon: Calendar, moduleKey: 'opd' },
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/ipd', label: 'Admissions', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
  ],
  pharmacist: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
    { href: '/pharmacy', label: 'Dispensing', icon: Pill, moduleKey: 'pharmacy' },
    { href: '/vpms', label: 'Procurement', icon: Truck, moduleKey: 'procurement' },
    { href: '/patients', label: 'Patients', icon: Users },
  ],
  lab_tech: [
    { href: '/', label: 'My Tasks', icon: LayoutDashboard },
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
  ],
};

// ===================================================================
// EVERYTHING ELSE — accessible via "More" (collapsed by default)
// ===================================================================
const MORE_NAV: { label: string; items: NavItem[] }[] = [
  { label: 'CLINICAL', items: [
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/opd', label: 'OPD & Appointments', icon: Calendar, moduleKey: 'opd' },
    { href: '/emr-v2', label: 'EMR', icon: Stethoscope, moduleKey: 'emr' },
    { href: '/ipd', label: 'IPD & Beds', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/nursing-station', label: 'Nursing Station', icon: Heart, moduleKey: 'nursing' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/emergency', label: 'Emergency', icon: Siren, moduleKey: 'emergency' },
    { href: '/ot', label: 'OT & Surgery', icon: Scissors, moduleKey: 'ot' },
    { href: '/cathlab', label: 'Cath Lab', icon: Heart, moduleKey: 'cathlab' },
    { href: '/endoscopy', label: 'Endoscopy', icon: Eye, moduleKey: 'endoscopy' },
    { href: '/dialysis', label: 'Dialysis', icon: Droplets, moduleKey: 'dialysis' },
    { href: '/physiotherapy', label: 'Physiotherapy', icon: Dumbbell, moduleKey: 'physiotherapy' },
    { href: '/dietary', label: 'Dietary', icon: UtensilsCrossed, moduleKey: 'dietary' },
    { href: '/referrals', label: 'Referrals', icon: UserPlus, moduleKey: 'referrals' },
  ]},
  { label: 'DIAGNOSTICS', items: [
    { href: '/lab', label: 'Laboratory', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Radiology', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, moduleKey: 'blood_bank' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, moduleKey: 'pharmacy' },
  ]},
  { label: 'REVENUE', items: [
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/pnl', label: 'P&L', icon: BarChart3, moduleKey: 'billing' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
    { href: '/revenue-leakage', label: 'Revenue Leakage', icon: AlertTriangle, moduleKey: 'revenue_leakage' },
  ]},
  { label: 'OPERATIONS', items: [
    { href: '/vpms', label: 'Procurement', icon: Truck, moduleKey: 'procurement' },
    { href: '/biomedical', label: 'Equipment', icon: Wrench, moduleKey: 'biomedical' },
    { href: '/housekeeping', label: 'Housekeeping', icon: SprayCan, moduleKey: 'housekeeping' },
    { href: '/cssd', label: 'CSSD', icon: Shield, moduleKey: 'cssd' },
    { href: '/duty-roster', label: 'Duty Roster', icon: ClipboardList, moduleKey: 'duty_roster' },
    { href: '/linen', label: 'Linen', icon: Shirt, moduleKey: 'linen' },
    { href: '/infection-control', label: 'Infection Control', icon: Shield, moduleKey: 'infection_control' },
    { href: '/crm', label: 'CRM', icon: MessageSquare, moduleKey: 'crm' },
    { href: '/homecare', label: 'Homecare', icon: Home, moduleKey: 'homecare' },
    { href: '/visitors', label: 'Visitors', icon: Users, moduleKey: 'visitors' },
    { href: '/mortuary', label: 'Mortuary', icon: Cross, moduleKey: 'mortuary' },
    { href: '/quality', label: 'Quality', icon: Shield, moduleKey: 'quality' },
  ]},
  { label: 'ADMIN', items: [
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/staff', label: 'Staff', icon: Users },
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
  const w = collapsed ? 'w-[68px]' : 'w-[240px]';
  const initials = staff?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??';

  // Get primary nav for this role
  const primaryItems = (ROLE_NAV[staffType] || ROLE_NAV.admin).filter(canSee);

  // For "More" — deduplicate items already in primary
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
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            {collapsed ? (
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-xs">H1</span>
              </div>
            ) : (
              <img src="/images/health1-logo.svg" alt="Health1" className="h-10 w-auto shrink-0" />
            )}
            {!collapsed && (
              <div className="min-w-0" />
            )}
          </Link>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Centre selector */}
        {!collapsed && (
          <div className="px-3 py-2.5 border-b border-gray-100 shrink-0 relative">
            <button onClick={() => setCentreOpen(!centreOpen)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left group">
              <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center shrink-0">
                <Building2 size={12} className="text-teal-700" />
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
                    className={cn('w-full text-left px-3 py-2 text-xs hover:bg-teal-50 border-b last:border-0 transition-colors',
                      c.centre_id === activeCentreId ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-600')}>
                    {c.centre?.name || c.centre_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRIMARY NAV — role-based, always visible */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          <div className="space-y-0.5">
            {primaryItems.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-[8px] rounded-lg text-[13px] font-medium transition-all duration-150 relative group',
                    collapsed && 'justify-center px-0',
                    active ? 'bg-teal-50 text-teal-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                  )}
                  title={collapsed ? item.label : undefined}>
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-teal-600 rounded-r-full" />}
                  <Icon size={collapsed ? 18 : 16} className={cn('shrink-0', active ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-600')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* DIVIDER */}
          {!collapsed && <div className="border-t border-gray-100 my-3" />}

          {/* MORE — everything else, collapsed by default */}
          {!collapsed && (
            <div>
              <button onClick={() => setMoreOpen(!moreOpen)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
                <div className="flex items-center gap-2.5">
                  <MoreHorizontal size={16} />
                  <span>More</span>
                </div>
                <ChevronRight size={12} className={cn('transition-transform', moreOpen && 'rotate-90')} />
              </button>

              {moreOpen && (
                <div className="mt-1 space-y-1">
                  {MORE_NAV.map(group => {
                    const visible = group.items.filter(i => canSee(i) && !primaryHrefs.has(i.href));
                    if (visible.length === 0) return null;
                    const isGroupOpen = moreGroup === group.label;
                    const hasActiveChild = visible.some(i => isActive(i.href));

                    return (
                      <div key={group.label}>
                        <button onClick={() => setMoreGroup(isGroupOpen ? null : group.label)}
                          className={cn('w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-gray-400 uppercase hover:text-gray-600',
                            hasActiveChild && 'text-teal-600')}>
                          <span>{group.label}</span>
                          <ChevronRight size={9} className={cn('transition-transform', isGroupOpen && 'rotate-90')} />
                        </button>
                        {isGroupOpen && (
                          <div className="space-y-0.5 ml-1">
                            {visible.map(item => {
                              const active = isActive(item.href);
                              const Icon = item.icon;
                              return (
                                <Link key={item.href} href={item.href} onClick={onMobileClose}
                                  className={cn(
                                    'flex items-center gap-2 px-2.5 py-[6px] rounded-lg text-[12px] font-medium transition-all',
                                    active ? 'bg-teal-50 text-teal-700' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700',
                                  )}>
                                  <Icon size={14} className={active ? 'text-teal-600' : 'text-gray-300'} />
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
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-[10px] font-bold text-teal-700">{initials}</span>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch {}
                window.location.href = '/auth/login';
              }} className="text-gray-400 hover:text-red-500 transition-colors"><LogOut size={14} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-teal-700">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{staff?.full_name || 'Loading...'}</p>
                <p className="text-[10px] text-gray-400 truncate capitalize">{staff?.staff_type || ''}</p>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out of HMIS?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch {}
                window.location.href = '/auth/login';
              }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
