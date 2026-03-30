'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard, Users, Calendar, BedDouble, Stethoscope,
  CreditCard, Pill, FlaskConical, ScanLine, Scissors, BarChart3,
  Settings, LogOut, Building2, ChevronDown, Droplets,
  Heart, PanelLeftClose, PanelLeft, Shield, Siren,
  Activity, Truck, FileText, Wrench, SprayCan, Shirt,
  ClipboardList, UtensilsCrossed, Dumbbell, AlertTriangle,
  Package, Eye, UserPlus, MessageSquare, Star, Home, Mic,
} from 'lucide-react';

interface NavItem { href: string; label: string; icon: any; moduleKey?: string }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: '', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/command-centre', label: 'Command Centre', icon: Activity },
  ]},
  { label: 'CLINICAL', items: [
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/opd', label: 'OPD', icon: Calendar, moduleKey: 'opd' },
    { href: '/emr-v2', label: 'EMR', icon: Stethoscope, moduleKey: 'emr' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/nursing-station', label: 'Nursing Station', icon: Heart, moduleKey: 'nursing' },
    { href: '/ward-board', label: 'Ward Board', icon: BedDouble, moduleKey: 'nursing' },
    { href: '/emergency', label: 'Emergency', icon: Siren, moduleKey: 'emergency' },
    { href: '/ot', label: 'OT & Surgery', icon: Scissors, moduleKey: 'ot' },
    { href: '/cathlab', label: 'Cath Lab', icon: Heart, moduleKey: 'cathlab' },
    { href: '/endoscopy', label: 'Endoscopy', icon: Eye, moduleKey: 'endoscopy' },
    { href: '/dialysis', label: 'Dialysis', icon: Droplets, moduleKey: 'dialysis' },
    { href: '/physiotherapy', label: 'Physiotherapy', icon: Dumbbell, moduleKey: 'physiotherapy' },
  ]},
  { label: 'DIAGNOSTICS', items: [
    { href: '/lab', label: 'Laboratory', icon: FlaskConical, moduleKey: 'lab' },
    { href: '/radiology', label: 'Radiology', icon: ScanLine, moduleKey: 'radiology' },
    { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, moduleKey: 'blood_bank' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, moduleKey: 'pharmacy' },
  ]},
  { label: 'REVENUE', items: [
    { href: '/billing', label: 'Billing', icon: CreditCard, moduleKey: 'billing' },
    { href: '/insurance', label: 'Insurance', icon: Shield, moduleKey: 'billing' },
    { href: '/packages', label: 'Packages', icon: Package, moduleKey: 'billing' },
    { href: '/pnl', label: 'P&L', icon: BarChart3, moduleKey: 'billing' },
    { href: '/accounting', label: 'Accounting', icon: BarChart3, moduleKey: 'billing' },
    { href: '/revenue-leakage', label: 'Leakage Audit', icon: AlertTriangle, moduleKey: 'revenue_leakage' },
  ]},
  { label: 'OPERATIONS', items: [
    { href: '/vpms', label: 'Procurement', icon: Truck, moduleKey: 'procurement' },
    { href: '/cssd', label: 'CSSD', icon: Shield, moduleKey: 'cssd' },
    { href: '/housekeeping', label: 'Housekeeping', icon: SprayCan, moduleKey: 'housekeeping' },
    { href: '/biomedical', label: 'Equipment', icon: Wrench, moduleKey: 'biomedical' },
    { href: '/duty-roster', label: 'Duty Roster', icon: ClipboardList, moduleKey: 'duty_roster' },
    { href: '/linen', label: 'Linen', icon: Shirt, moduleKey: 'linen' },
    { href: '/dietary', label: 'Dietary', icon: UtensilsCrossed, moduleKey: 'dietary' },
    { href: '/bed-turnover', label: 'Bed Turnover', icon: BedDouble, moduleKey: 'ipd' },
    { href: '/ambulance', label: 'Ambulance', icon: Truck, moduleKey: 'ambulance' },
  ]},
  { label: 'EXPERIENCE', items: [
    { href: '/px-coordinator', label: 'PX Dashboard', icon: Star, moduleKey: 'px_coordinator' },
    { href: '/px-feedback', label: 'Feedback', icon: MessageSquare, moduleKey: 'px_feedback' },
    { href: '/grievances', label: 'Grievances', icon: AlertTriangle, moduleKey: 'grievances' },
    { href: '/visitors', label: 'Visitors', icon: Users, moduleKey: 'visitors' },
    { href: '/crm', label: 'CRM', icon: MessageSquare, moduleKey: 'crm' },
  ]},
  { label: 'ADMIN', items: [
    { href: '/staff', label: 'Staff', icon: Users },
    { href: '/quality', label: 'Quality / NABH', icon: Shield, moduleKey: 'quality' },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/handover', label: 'Shift Handover', icon: ClipboardList },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/infection-control', label: 'Infection Control', icon: Shield, moduleKey: 'infection_control' },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { staff, centres, activeCentreId, setActiveCentre } = useAuthStore();
  const [centreOpen, setCentreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = useCallback((href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  const switchCentre = useCallback((id: string) => {
    setActiveCentre(id);
    setCentreOpen(false);
  }, [setActiveCentre]);

  const activeCentre = centres.find((c: any) => c.centre_id === activeCentreId);
  const initials = staff?.full_name ? staff.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : 'H1';
  const w = collapsed ? 'w-[60px]' : 'w-[220px]';

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onMobileClose} />}

      <aside className={cn(
        'fixed top-0 left-0 h-screen flex flex-col z-50 transition-all duration-200',
        'bg-[#0f1729] text-white',
        w, mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>

        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.06]">
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="w-full flex justify-center text-white/40 hover:text-white/80 cursor-pointer">
              <PanelLeft size={18} />
            </button>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <span className="text-[10px] font-black text-white tracking-tight">H1</span>
                </div>
                <div>
                  <span className="text-[13px] font-bold text-white tracking-wide">Health1</span>
                  <span className="text-[9px] text-white/30 block -mt-0.5 font-medium">HMIS</span>
                </div>
              </Link>
              <button onClick={() => setCollapsed(true)} className="text-white/20 hover:text-white/60 transition-colors cursor-pointer">
                <PanelLeftClose size={15} />
              </button>
            </>
          )}
        </div>

        {/* Centre selector */}
        {!collapsed && centres.length > 1 && (
          <div className="px-3 py-2 relative">
            <button onClick={() => setCentreOpen(!centreOpen)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] transition-colors text-left cursor-pointer">
              <Building2 size={13} className="text-teal-400 shrink-0" />
              <span className="text-[11px] font-medium text-white/70 truncate flex-1">
                {(activeCentre as any)?.centre?.name?.replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '') || 'Select centre'}
              </span>
              <ChevronDown size={11} className={cn('text-white/30 transition-transform shrink-0', centreOpen && 'rotate-180')} />
            </button>
            {centreOpen && (
              <div className="absolute left-3 right-3 mt-1 bg-[#1a2640] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                {centres.map((c: any) => (
                  <button key={c.centre_id} onClick={() => switchCentre(c.centre_id)}
                    className={cn('w-full text-left px-3 py-2.5 text-[11px] hover:bg-white/[0.06] border-b border-white/[0.04] last:border-0 transition-colors cursor-pointer',
                      c.centre_id === activeCentreId ? 'text-teal-400 font-semibold bg-white/[0.04]' : 'text-white/60')}>
                    {c.centre?.name || c.centre_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={cn(group.label && 'mt-3.5')}>
              {group.label && !collapsed && (
                <div className="px-2.5 mb-1">
                  <span className="text-[10px] font-semibold tracking-[0.08em] text-white/25 uppercase">{group.label}</span>
                </div>
              )}
              {collapsed && gi > 0 && <div className="border-t border-white/[0.06] my-2 mx-2" />}
              <div className="space-y-[1px]">
                {group.items.map(item => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href + gi} href={item.href} onClick={onMobileClose}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[12px] font-medium transition-all duration-100 relative group cursor-pointer',
                        collapsed && 'justify-center px-0 py-2',
                        active
                          ? 'bg-white/[0.1] text-white'
                          : 'text-white/45 hover:bg-white/[0.05] hover:text-white/80',
                      )}
                      title={collapsed ? item.label : undefined}>
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-3.5 bg-teal-400 rounded-r-full" />}
                      <Icon size={collapsed ? 17 : 14} strokeWidth={active ? 2.2 : 1.8} className={cn('shrink-0', active ? 'text-teal-400' : 'text-white/25 group-hover:text-white/50')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-2 py-2.5 border-t border-white/[0.06] shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-teal-400">{initials}</span>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch (e) { console.error(e); }
                window.location.href = '/auth/login';
              }} className="text-white/30 hover:text-red-400 transition-colors cursor-pointer"><LogOut size={14} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-teal-400">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white/90 truncate">{staff?.full_name || 'Loading...'}</p>
                <p className="text-[10px] text-white/30 truncate capitalize">{staff?.staff_type || ''}</p>
              </div>
              <button onClick={async () => {
                if (!confirm('Sign out of HMIS?')) return;
                try { const { createClient: cc } = await import('@/lib/supabase/client'); await cc().auth.signOut(); } catch (e) { console.error(e); }
                window.location.href = '/auth/login';
              }} className="text-white/30 hover:text-red-400 transition-colors p-1 cursor-pointer" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
