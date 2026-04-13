'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, Plus, FileText, CreditCard, Shield, IndianRupee,
  Activity, TrendingUp, Clock, Filter, ChevronRight,
  Building2, Stethoscope, Pill, FlaskConical, ChevronDown,
} from 'lucide-react';
import type { BillingEncounter, BillingDashboardStats } from '@/lib/billing/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

interface Props {
  encounters: BillingEncounter[];
  stats: BillingDashboardStats;
  loading: boolean;
  onNewBill: () => void;
  onSelectEncounter: (enc: BillingEncounter) => void;
  onFilterChange: (filters: { status?: string; encounterType?: string; search?: string }) => void;
}

export default function BillingCommandCentre({
  encounters, stats, loading, onNewBill, onSelectEncounter, onFilterChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = encounters;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.encounter_number?.toLowerCase().includes(q) ||
        e.patient?.first_name?.toLowerCase().includes(q) ||
        e.patient?.last_name?.toLowerCase().includes(q) ||
        e.patient?.uhid?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter(e => e.encounter_type === typeFilter);
    return result;
  }, [encounters, search, statusFilter, typeFilter]);

  const statCards = [
    { label: "Today's Collection", value: INR(stats.todayCollection), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending Bills', value: String(stats.pendingBills), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Insurance Pending', value: String(stats.insurancePending), icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Bills Today', value: String(stats.todayBillCount), icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Billing Command Centre</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onNewBill}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0A2540] text-white text-sm rounded-xl font-semibold hover:bg-[#0A2540]/90 transition-colors cursor-pointer shadow-sm"
        >
          <Plus size={16} /> New Bill
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</div>
              <div className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <Stethoscope size={15} className="text-teal-600" />
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">OPD</div>
            <div className="text-sm font-bold text-gray-800">{INR(stats.opdCollection)}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <Building2 size={15} className="text-blue-600" />
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">IPD</div>
            <div className="text-sm font-bold text-gray-800">{INR(stats.ipdCollection)}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <Pill size={15} className="text-purple-600" />
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Pharmacy</div>
            <div className="text-sm font-bold text-gray-800">{INR(stats.pharmacyCollection)}</div>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] bg-gray-50/50"
            placeholder="Search patient, UHID, encounter #..."
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {['all', 'OPD', 'IPD', 'ER', 'DAYCARE'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors cursor-pointer ${
                typeFilter === t
                  ? 'bg-[#0A2540]/10 text-[#0A2540] border border-[#00B4D8]/30'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 ml-2">
          {['all', 'OPEN', 'FINAL_BILLED', 'SETTLED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-[#0A2540]/10 text-[#0A2540] border border-[#00B4D8]/30'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? 'All Status' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-gray-400 ml-auto">{filtered.length} encounters</span>
      </div>

      {/* Encounter Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading billing queue...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Encounter #</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Patient</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Payor</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Charges</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Paid</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(enc => (
                <tr
                  key={enc.id}
                  onClick={() => onSelectEncounter(enc)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] text-gray-500">{enc.encounter_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{enc.patient?.first_name} {enc.patient?.last_name}</div>
                    <div className="text-[10px] text-gray-400">{enc.patient?.uhid}{enc.patient?.age_years ? ` · ${enc.patient.age_years}y` : ''}{enc.patient?.gender ? ` · ${enc.patient.gender}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <EncounterTypeBadge type={enc.encounter_type} />
                  </td>
                  <td className="px-4 py-3">
                    <PayorBadge payor={enc.primary_payor_type} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {Number(enc.net_amount) > 0 ? `₹${fmt(Number(enc.net_amount))}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                    {Number(enc.total_paid) > 0 ? `₹${fmt(Number(enc.total_paid))}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(enc.balance_due) > 0
                      ? <span className="font-semibold text-red-600">₹{fmt(Number(enc.balance_due))}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={enc.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-gray-300" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">
                    {search ? `No encounters matching "${search}"` : 'No billing encounters found. Click "New Bill" to start.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════════════

function EncounterTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    OPD: 'bg-teal-50 text-teal-700',
    IPD: 'bg-blue-50 text-blue-700',
    ER: 'bg-red-50 text-red-700',
    DAYCARE: 'bg-purple-50 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

function PayorBadge({ payor }: { payor: string }) {
  const colors: Record<string, string> = {
    SELF_PAY: 'bg-gray-100 text-gray-600',
    PMJAY: 'bg-orange-50 text-orange-700',
    CGHS: 'bg-green-50 text-green-700',
    TPA: 'bg-blue-50 text-blue-700',
    CORPORATE: 'bg-indigo-50 text-indigo-700',
    STAFF: 'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[payor] || 'bg-gray-100 text-gray-600'}`}>
      {payor.replace('_', ' ')}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: 'bg-amber-50 text-amber-700',
    INTERIM_BILLED: 'bg-blue-50 text-blue-700',
    FINAL_BILLED: 'bg-teal-50 text-teal-700',
    DISCHARGED: 'bg-indigo-50 text-indigo-700',
    SETTLED: 'bg-emerald-50 text-emerald-700',
    CANCELLED: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
