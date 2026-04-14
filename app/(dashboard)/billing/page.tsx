// HEALTH1 HMIS — BILLING COMMAND CENTRE
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, FileText, CreditCard, Shield, TrendingUp, Users, Bed, Activity, ArrowRight, Filter, RefreshCw, IndianRupee, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BillingEncounter, BillingDashboardStats, EncounterType, EncounterStatus } from '@/lib/billing/billing-v2-types';
import { ENCOUNTER_STATUS_COLORS, PAYOR_TYPE_LABELS } from '@/lib/billing/billing-v2-types';

function StatCard({ label, value, subValue, icon: Icon, color, onClick }: { label: string; value: string | number; subValue?: string; icon: any; color: string; onClick?: () => void }) {
  return (<button onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : 'cursor-default'} bg-white border-gray-200`}>
    <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p><p className="mt-0.5 text-xl font-bold text-gray-900 font-mono tabular-nums">{value}</p>{subValue && <p className="mt-0.5 text-xs text-gray-500">{subValue}</p>}</div>
  </button>);
}

function EncounterRow({ encounter, onSelect }: { encounter: BillingEncounter; onSelect: (id: string) => void }) {
  const statusColor = ENCOUNTER_STATUS_COLORS[encounter.status] || 'bg-gray-100 text-gray-700';
  const payorLabel = PAYOR_TYPE_LABELS[encounter.primary_payor_type] || encounter.primary_payor_type;
  const isOverdue = encounter.balance_due > 0 && encounter.status === 'OPEN';
  return (<tr onClick={() => onSelect(encounter.id)} className="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-0">
    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-500">{encounter.encounter_number}</span></td>
    <td className="px-4 py-3"><div><p className="font-medium text-gray-900 text-sm">{encounter.patient_name || 'Unknown'}</p><p className="text-xs text-gray-500">{encounter.patient_uhid || ''}</p></div></td>
    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${encounter.encounter_type === 'IPD' ? 'bg-purple-100 text-purple-700' : encounter.encounter_type === 'OPD' ? 'bg-blue-100 text-blue-700' : encounter.encounter_type === 'ER' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{encounter.encounter_type}</span></td>
    <td className="px-4 py-3 text-right"><span className="font-mono text-sm font-semibold text-gray-900">₹{encounter.net_amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span></td>
    <td className="px-4 py-3 text-right"><span className={`font-mono text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>₹{encounter.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span></td>
    <td className="px-4 py-3"><span className="text-xs text-gray-600">{payorLabel}</span></td>
    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{encounter.status.replace(/_/g, ' ')}</span></td>
    <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); onSelect(encounter.id); }} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">View <ArrowRight className="h-3 w-3" /></button></td>
  </tr>);
}

const TABS = [
  { id: 'all', label: 'All', icon: FileText }, { id: 'OPD', label: 'OPD', icon: Users },
  { id: 'IPD', label: 'IPD', icon: Bed }, { id: 'ER', label: 'ER', icon: Activity },
  { id: 'DAYCARE', label: 'Day Care', icon: Clock }, { id: 'insurance', label: 'Insurance', icon: Shield },
] as const;

export default function BillingCommandCentre() {
  const router = useRouter();
  const [stats, setStats] = useState<BillingDashboardStats | null>(null);
  const [encounters, setEncounters] = useState<BillingEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const centreId = 'CURRENT_CENTRE_ID';

  const loadData = useCallback(async () => {
    try { setLoading(true);
      const [statsRes, encountersRes] = await Promise.all([
        fetch(`/api/billing/dashboard-stats?centre_id=${centreId}`),
        fetch(`/api/billing/encounters?centre_id=${centreId}&status=OPEN,INTERIM_BILLED`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (encountersRes.ok) setEncounters(await encountersRes.json());
    } catch (err) { console.error('Failed to load billing data:', err); } finally { setLoading(false); }
  }, [centreId]);

  useEffect(() => { loadData(); }, [loadData]);
  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const filteredEncounters = useMemo(() => {
    let result = encounters;
    if (activeTab !== 'all' && activeTab !== 'insurance') result = result.filter(e => e.encounter_type === activeTab);
    if (activeTab === 'insurance') result = result.filter(e => e.primary_payor_type !== 'SELF_PAY');
    if (searchTerm) { const term = searchTerm.toLowerCase(); result = result.filter(e => (e.patient_name?.toLowerCase().includes(term)) || (e.patient_uhid?.toLowerCase().includes(term)) || (e.encounter_number?.toLowerCase().includes(term)) || (e.patient_phone?.includes(term))); }
    return result;
  }, [encounters, activeTab, searchTerm]);

  const formatCurrency = (amount: number) => { if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`; if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`; return `₹${amount.toLocaleString('en-IN')}`; };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-[#0A2540]">Billing Command Centre</h1>
          <p className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
            <button onClick={() => router.push('/billing/new')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90"><Plus className="h-4 w-4" /> New Bill</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Today's Collection" value={formatCurrency(stats?.today_collection || 0)} subValue={`${stats?.today_bills || 0} bills generated`} icon={IndianRupee} color="bg-emerald-500" />
          <StatCard label="Pending Bills" value={stats?.pending_bills || 0} subValue={`${stats?.opd_count || 0} OPD today`} icon={Clock} color="bg-amber-500" onClick={() => setActiveTab('all')} />
          <StatCard label="Insurance Pending" value={stats?.insurance_pending_count || 0} subValue={formatCurrency(stats?.insurance_pending_amount || 0)} icon={Shield} color="bg-blue-500" onClick={() => router.push('/billing/insurance')} />
          <StatCard label="Active IPD" value={stats?.ipd_active || 0} subValue={`Advance: ${formatCurrency(stats?.advance_balance || 0)}`} icon={Bed} color="bg-purple-500" onClick={() => setActiveTab('IPD')} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by patient name, UHID, phone, or bill number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div>
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="font-mono">{filteredEncounters.length}</span> encounters</div>
          </div>

          <div className="px-4 border-b border-gray-100">
            <nav className="flex gap-1 -mb-px">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id; const TabIcon = tab.icon;
                const count = tab.id === 'all' ? encounters.length : tab.id === 'insurance' ? encounters.filter(e => e.primary_payor_type !== 'SELF_PAY').length : encounters.filter(e => e.encounter_type === tab.id).length;
                return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive ? 'border-[#00B4D8] text-[#00B4D8]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                  <TabIcon className="h-3.5 w-3.5" /> {tab.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-[#00B4D8]/10 text-[#00B4D8]' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                </button>);
              })}
            </nav>
          </div>

          <div className="overflow-x-auto">
            {loading ? (<div className="flex items-center justify-center py-16"><div className="flex items-center gap-3 text-gray-500"><RefreshCw className="h-5 w-5 animate-spin" /><span className="text-sm">Loading billing queue...</span></div></div>
            ) : filteredEncounters.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-gray-400"><FileText className="h-10 w-10 mb-3" /><p className="text-sm font-medium">No encounters found</p><p className="text-xs mt-1">{searchTerm ? 'Try a different search term' : 'Create a new bill to get started'}</p></div>
            ) : (
              <table className="w-full">
                <thead><tr className="bg-gray-50/80">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Bill #</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Payor</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Action</th>
                </tr></thead>
                <tbody>{filteredEncounters.map(encounter => (<EncounterRow key={encounter.id} encounter={encounter} onSelect={(id) => router.push(`/billing/${id}`)} />))}</tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Insurance Desk', href: '/billing/insurance', icon: Shield, color: 'text-blue-600' },
            { label: 'Day End Report', href: '/billing/reports/day-end', icon: FileText, color: 'text-emerald-600' },
            { label: 'Rate Card Setup', href: '/billing/settings/rate-cards', icon: CreditCard, color: 'text-purple-600' },
            { label: 'Revenue Analytics', href: '/billing/analytics', icon: TrendingUp, color: 'text-amber-600' },
            { label: 'Discount Approvals', href: '/billing/approvals', icon: AlertCircle, color: 'text-red-600' },
          ].map(link => (
            <button key={link.href} onClick={() => router.push(link.href)} className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
              <link.icon className={`h-4 w-4 ${link.color}`} /><span className="text-sm font-medium text-gray-700">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
