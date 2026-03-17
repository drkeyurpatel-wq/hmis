'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard, Users, Calendar, BedDouble, Stethoscope,
  FileText, CreditCard, Shield, Pill, FlaskConical, ScanLine,
  Scissors, BarChart3, Settings, LogOut, Building2, ChevronDown, Droplets, Home, Activity, Truck,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: null },
  { href: '/command-centre', label: 'Command Centre', icon: Activity, module: null },
  { href: '/patients', label: 'Patients', icon: Users, module: 'patients' },
  { href: '/opd', label: 'OPD', icon: Calendar, module: 'opd' },
  { href: '/ipd', label: 'IPD', icon: BedDouble, module: 'ipd' },
  { href: '/bed-management', label: 'Bed Management', icon: BedDouble, module: 'ipd' },
  { href: '/beds', label: 'Bed Board', icon: BedDouble, module: 'ipd' },
  { href: '/emr', label: 'EMR (Legacy)', icon: Stethoscope, module: 'emr' },
  { href: '/emr-v2', label: 'EMR v2', icon: Stethoscope, module: 'emr' },
  { href: '/billing', label: 'Billing', icon: CreditCard, module: 'billing' },
  { href: '/insurance', label: 'Insurance & TPA', icon: Shield, module: 'insurance' },
  { href: '/pharmacy', label: 'Pharmacy', icon: Pill, module: 'pharmacy' },
  { href: '/lab', label: 'Laboratory', icon: FlaskConical, module: 'lab' },
  { href: '/blood-bank', label: 'Blood Bank', icon: Droplets, module: 'lab' },
  { href: '/homecare', label: 'Homecare', icon: Home, module: 'homecare' },
  { href: '/radiology', label: 'Radiology', icon: ScanLine, module: 'radiology' },
  { href: '/ot', label: 'OT Management', icon: Scissors, module: 'ot' },
  { href: '/vpms', label: 'Vendor & Purchase', icon: Truck, module: null },
  { href: '/reports', label: 'MIS & Reports', icon: BarChart3, module: 'mis' },
  { href: '/settings', label: 'Settings', icon: Settings, module: null },
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const pathname = usePathname();
  const { staff, centres, activeCentreId, setActiveCentre } = useAuthStore();
  const [centreOpen, setCentreOpen] = useState(false);

  const activeCentre = centres.find((c) => c.centre_id === activeCentreId);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onMobileClose} />}
      <aside className={`fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-gray-200 flex flex-col z-40 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Logo */}
      <div className="h-[var(--header-height)] flex items-center px-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-health1-teal flex items-center justify-center">
            <span className="text-white font-bold text-sm">H1</span>
          </div>
          <div>
            <p className="font-display font-bold text-sm text-gray-900 leading-tight">Health1</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">HMIS</p>
          </div>
        </div>
      </div>

      {/* Centre selector */}
      <div className="px-3 py-3 border-b border-gray-100 relative">
        <button onClick={() => setCentreOpen(!centreOpen)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate">
              {activeCentre?.centre?.name || 'Select centre'}
            </span>
          </div>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${centreOpen ? 'rotate-180' : ''}`} />
        </button>
        {centreOpen && centres.length > 1 && (
          <div className="absolute left-3 right-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            {centres.map((c) => (
              <button key={c.centre_id} onClick={() => { setActiveCentre(c.centre_id); setCentreOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 ${c.centre_id === activeCentreId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                {c.centre?.name || c.centre_id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.filter((item) => {
          if (!item.module) return true; // dashboard, settings always visible
          const staffType = staff?.staff_type || 'admin';
          if (staffType === 'admin') return true;
          const moduleAccess: Record<string, string[]> = {
            patients: ['doctor','nurse','admin','receptionist','support'],
            opd: ['doctor','nurse','admin','receptionist'],
            emr: ['doctor','nurse'], 'emr-v2': ['doctor','nurse'],
            billing: ['admin','receptionist','accountant'],
            pharmacy: ['pharmacist','admin','doctor'],
            lab: ['lab_tech','admin','doctor','nurse'],
            ipd: ['doctor','nurse','admin'],
            ot: ['doctor','nurse','admin'],
            radiology: ['technician','admin','doctor'],
            insurance: ['admin','accountant'],
            accounting: ['accountant','admin'],
            mis: ['admin','doctor','accountant'],
          };
          return (moduleAccess[item.module] || []).includes(staffType);
        }).map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-item', isActive && 'active')}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-xs font-semibold text-brand-700">
              {staff?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '??'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {staff?.full_name || 'Loading...'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {staff?.designation || staff?.staff_type}
            </p>
          </div>
          <button onClick={async () => {
            if (!confirm('Sign out of Health1 HMIS?')) return;
            try { const { createClient } = await import('@/lib/supabase/client'); const supabase = createClient(); await supabase.auth.signOut(); } catch {}
            window.location.href = '/auth/login';
          }} className="text-gray-400 hover:text-red-500 transition-colors" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
