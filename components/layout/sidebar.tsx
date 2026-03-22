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
  Package, HandshakeIcon, Eye, UserPlus, Siren, MessageSquare,
} from 'lucide-react';

interface NavItem { href: string; label: string; icon: any; module: string | null; badge?: string }
interface NavGroup { key: string; label: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { key: 'core', label: '', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: null },
    { href: '/command-centre', label: 'Command Centre', icon: Activity, module: null },
  ]},
  { key: 'clinical', label: 'CLINICAL', items: [
    { href: '/patients', label: 'Patients', icon: Users, module: 'patients' },
    { href: '/opd', label: 'OPD', icon: Calendar, module: 'opd' },
    { href: '/appointments', label: 'Appointments', icon: Calendar, module: 'opd' },
    { href: '/emr-v2', label: 'EMR', icon: Stethoscope, module: 'emr' },
    { href: '/voice-notes', label: 'Voice Notes', icon: Mic, module: 'emr' },
    { href: '/ipd', label: 'IPD', icon: BedDouble, module: 'ipd' },
    { href: '/bed-management', label: 'Beds', icon: BedDouble, module: 'ipd' },
    { href: '/nursing-station', label: 'Nursing', icon: Heart, module: 'ipd' },
    { href: '/handover', label: 'Shift Handover', icon: ClipboardList, module: 'ipd' },
    { href: '/emergency', label: 'Emergency', icon: Siren, module: 'ipd' },
    { href: '/ot', label: 'OT', icon: Scissors, module: 'ot' },
    { href: '/surgical-planning', label: 'Surgical Planning', icon: ClipboardList, module: 'ot' },
    { href: '/cathlab', label: 'Cath Lab', icon: Heart, module: 'ot' },
    { href: '/endoscopy', label: 'Endoscopy', icon: Eye, module: 'ot' },
    { href: '/dialysis', label: 'Dialysis', icon: Droplets, module: 'ipd' },
    { href: '/physiotherapy', label: 'Physiotherapy', icon: Dumbbell, module: 'ipd' },
    { href: '/dietary', label: 'Dietary', icon: UtensilsCrossed, module: 'ipd' },
    { href: '/cssd', label: 'CSSD', icon: Shield, module: 'ot' },
    { href: '/referrals', label: 'Referrals', icon: UserPlus, module: 'opd' },
  ]},
  { key: 'diagnostics', label: 'DIAGNOSTICS', items: [
    { href: '/lab', label: 'Laboratory', icon: FlaskConical, module: 'lab' },
    { href: '/radiology', label: 'Radiology', icon: ScanLine, module: 'radiology' },
    { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, module: 'lab' },
    { href: '/pharmacy', label: 'Pharmacy', icon: Pill, module: 'pharmacy' },
  ]},
  { key: 'revenue', label: 'REVENUE', items: [
    { href: '/billing', label: 'Billing', icon: CreditCard, module: 'billing' },
    { href: '/packages', label: 'Packages', icon: Package, module: 'billing' },
    { href: '/insurance', label: 'Insurance', icon: ShieldCheck, module: 'billing' },
    { href: '/pnl', label: 'P&L', icon: BarChart3, module: 'billing' },
    { href: '/revenue-leakage', label: 'Revenue Leakage', icon: AlertTriangle, module: 'billing' },
    { href: '/accounting', label: 'Accounting', icon: FileText, module: 'billing' },
  ]},
  { key: 'operations', label: 'OPERATIONS', items: [
    { href: '/vpms', label: 'Procurement', icon: Truck, module: null },
    { href: '/homecare', label: 'Homecare', icon: Home, module: 'homecare' },
    { href: '/crm', label: 'CRM', icon: MessageSquare, module: null },
    { href: '/biomedical', label: 'Biomedical', icon: Wrench, module: null },
    { href: '/equipment-lifecycle', label: 'Equipment Lifecycle', icon: Wrench, module: null },
    { href: '/housekeeping', label: 'Housekeeping', icon: SprayCan, module: null },
    { href: '/bed-turnover', label: 'Bed Turnover', icon: BedDouble, module: 'ipd' },
    { href: '/duty-roster', label: 'Duty Roster', icon: ClipboardList, module: 'settings' },
    { href: '/linen', label: 'Linen', icon: Shirt, module: null },
    { href: '/infection-control', label: 'Infection Control', icon: Shield, module: null },
    { href: '/visitors', label: 'Visitors', icon: Users, module: null },
    { href: '/mortuary', label: 'Mortuary', icon: Cross, module: null },
    { href: '/quality', label: 'Quality', icon: Shield, module: 'mis' },
  ]},
  { key: 'admin', label: 'ADMIN', items: [
    { href: '/reports', label: 'Reports', icon: BarChart3, module: 'mis' },
    { href: '/telemedicine', label: 'Telemedicine', icon: Smartphone, module: null },
    { href: '/staff', label: 'Staff', icon: Users, module: 'settings' },
    { href: '/settings', label: 'Settings', icon: Settings, module: null },
  ]},
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { staff, centres, activeCentreId, setActiveCentre, hasPermission } = useAuthStore();
  const [centreOpen, setCentreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const activeCentre = centres.find(c => c.centre_id === activeCentreId);
  const staffType = staff?.staff_type || '';

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const canSee = (item: NavItem) => {
    if (!item.module) return true;
    if (staffType === 'admin') return true;
    if (hasPermission(item.module, 'view')) return true;
    const fb: Record<string, string[]> = {
      patients: ['doctor','nurse','admin','receptionist','support'],
      opd: ['doctor','nurse','admin','receptionist'],
      emr: ['doctor','nurse'],
      billing: ['admin','receptionist','accountant'],
      pharmacy: ['pharmacist','admin','doctor'],
      lab: ['lab_tech','admin','doctor','nurse'],
      ipd: ['doctor','nurse','admin'],
      ot: ['doctor','nurse','admin'],
      radiology: ['technician','admin','doctor'],
      mis: ['admin','doctor','accountant'],
      settings: ['admin'],
      homecare: ['admin','nurse','doctor'],
    };
    return (fb[item.module] || []).includes(staffType);
  };

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const w = collapsed ? 'w-[68px]' : 'w-[240px]';
  const initials = staff?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??';

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
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs tracking-tight">H1</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-gray-900 leading-none">Hospital</p>
                <p className="text-[9px] text-teal-600 font-semibold uppercase tracking-[0.15em] mt-0.5">HMIS</p>
              </div>
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
                {activeCentre?.centre?.name?.replace('Hospital ', '').replace('Hospital', '').replace('Super Speciality', 'SS').trim() || 'Select centre'}
              </span>
              <ChevronDown size={12} className={cn('text-gray-400 transition-transform shrink-0', centreOpen && 'rotate-180')} />
            </button>
            {centreOpen && centres.length > 1 && (
              <div className="absolute left-3 right-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                {centres.map(c => (
                  <button key={c.centre_id} onClick={() => { setActiveCentre(c.centre_id); setCentreOpen(false); }}
                    className={cn('w-full text-left px-3 py-2 text-xs hover:bg-teal-50 border-b last:border-0 transition-colors',
                      c.centre_id === activeCentreId ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-600')}>
                    {c.centre?.name || c.centre_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
          {NAV.map(group => {
            const visible = group.items.filter(canSee);
            if (visible.length === 0) return null;
            const isCollapsed = collapsedGroups[group.key];
            const hasActiveChild = visible.some(i => isActive(i.href));

            return (
              <div key={group.key}>
                {/* Group header */}
                {group.label && !collapsed && (
                  <button onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-2.5 pt-3 pb-1 group">
                    <span className="text-[9px] font-bold tracking-[0.12em] text-gray-400 uppercase">{group.label}</span>
                    <ChevronRight size={10} className={cn('text-gray-300 transition-transform', !isCollapsed && 'rotate-90')} />
                  </button>
                )}

                {/* Items */}
                {(!isCollapsed || collapsed) && (
                  <div className="space-y-0.5">
                    {visible.map(item => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} onClick={onMobileClose}
                          className={cn(
                            'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative group',
                            collapsed && 'justify-center px-0',
                            active
                              ? 'bg-teal-50 text-teal-700'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                          )}
                          title={collapsed ? item.label : undefined}>
                          {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-teal-600 rounded-r-full" />}
                          <Icon size={collapsed ? 18 : 16} className={cn('shrink-0', active ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-600')} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.badge && (
                            <span className="ml-auto text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{item.badge}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
                <p className="text-[10px] text-gray-400 truncate">{staff?.designation || staff?.staff_type}</p>
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
