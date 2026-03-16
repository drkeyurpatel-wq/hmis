'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard, Users, Calendar, BedDouble, Stethoscope,
  FileText, CreditCard, Shield, Pill, FlaskConical, ScanLine,
  Scissors, BarChart3, Settings, LogOut, Building2, ChevronDown,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: null },
  { href: '/patients', label: 'Patients', icon: Users, module: 'patients' },
  { href: '/opd', label: 'OPD', icon: Calendar, module: 'opd' },
  { href: '/ipd', label: 'IPD', icon: BedDouble, module: 'ipd' },
  { href: '/emr', label: 'EMR (Legacy)', icon: Stethoscope, module: 'emr' },
  { href: '/emr-v2', label: 'EMR v2', icon: Stethoscope, module: 'emr' },
  { href: '/billing', label: 'Billing', icon: CreditCard, module: 'billing' },
  { href: '/insurance', label: 'Insurance & TPA', icon: Shield, module: 'insurance' },
  { href: '/pharmacy', label: 'Pharmacy', icon: Pill, module: 'pharmacy' },
  { href: '/lab', label: 'Laboratory', icon: FlaskConical, module: 'lab' },
  { href: '/radiology', label: 'Radiology', icon: ScanLine, module: 'radiology' },
  { href: '/ot', label: 'OT Scheduling', icon: Scissors, module: 'ot' },
  { href: '/reports', label: 'MIS & Reports', icon: BarChart3, module: 'mis' },
  { href: '/settings', label: 'Settings', icon: Settings, module: null },
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const pathname = usePathname();
  const { staff, centres, activeCentreId, setActiveCentre } = useAuthStore();

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
      <div className="px-3 py-3 border-b border-gray-100">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate">
              {activeCentre?.centre?.name || 'Select centre'}
            </span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
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
          <button className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
