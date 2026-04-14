// @ts-nocheck
// HEALTH1 HMIS — INSURANCE DESK
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Plus, ArrowRight, Clock, CheckCircle2, XCircle, AlertTriangle, HelpCircle, FileText, TrendingUp, TrendingDown, RefreshCw, Filter, ChevronRight, IndianRupee, BarChart3, Send, Search } from 'lucide-react';
import type { PreAuth, InsuranceClaim, ClaimAgingSummary, TPAPerformance } from '@/lib/billing/billing-v2-types';
import { PREAUTH_STATUS_COLORS, CLAIM_STATUS_COLORS, PAYOR_TYPE_LABELS } from '@/lib/billing/billing-v2-types';

function PreAuthCard({ preAuth, onClick }: { preAuth: PreAuth; onClick: () => void }) {
  const tat = preAuth.submitted_at ? Math.round((Date.now() - new Date(preAuth.submitted_at).getTime()) / 3600000) : null;
  const isUrgent = tat !== null && tat > 48;
  return (<button onClick={onClick} className={`w-full text-left rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${isUrgent ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{preAuth.insurance_company?.company_name || 'Insurance Co.'}</p><p className="text-xs text-gray-500 mt-0.5 truncate">Policy: {preAuth.policy_number}</p></div>{isUrgent && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}</div>
    <div className="mt-2 flex items-center justify-between"><span className="text-sm font-bold font-mono text-gray-900">₹{preAuth.requested_amount.toLocaleString('en-IN')}</span>{preAuth.approved_amount != null && <span className="text-xs font-mono text-emerald-600">✓ ₹{preAuth.approved_amount.toLocaleString('en-IN')}</span>}</div>
    <div className="mt-2 flex items-center gap-2">{tat !== null && <span className={`text-[10px] font-medium ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}><Clock className="h-2.5 w-2.5 inline mr-0.5" />{tat < 24 ? `${tat}h` : `${Math.round(tat / 24)}d`}</span>}{preAuth.pmjay_package_code && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">PMJAY</span>}</div>
    {preAuth.diagnosis_codes.length > 0 && <p className="mt-1.5 text-[10px] text-gray-400 truncate">{preAuth.diagnosis_codes.map(d => d.description || d.code).join(', ')}</p>}
  </button>);
}

function KanbanColumn({ title, icon: Icon, color, preAuths, onCardClick, count }: { title: string; icon: any; color: string; preAuths: PreAuth[]; onCardClick: (id: string) => void; count: number }) {
  return (<div className="flex-1 min-w-[260px]">
    <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${color}`}><Icon className="h-3.5 w-3.5" /><span className="text-xs font-bold uppercase tracking-wider">{title}</span><span className="ml-auto text-xs font-bold bg-white/20 rounded-full px-1.5 py-0.5">{count}</span></div>
    <div className="bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
      {preAuths.map(pa => <PreAuthCard key={pa.id} preAuth={pa} onClick={() => onCardClick(pa.id)} />)}
      {preAuths.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No items</p>}
    </div>
  </div>);
}

function AgingBar({ data }: { data: ClaimAgingSummary[] }) {
  const total = data.reduce((s, d) => s + d.total_amount, 0);
  const bc: Record<string, string> = { '0-30': 'bg-emerald-500', '31-60': 'bg-amber-500', '61-90': 'bg-orange-500', '91-120': 'bg-red-500', '120+': 'bg-red-800' };
  return (<div className="space-y-3">
    <div className="h-8 rounded-lg overflow-hidden flex">{data.filter(d => d.percentage > 0).map(d => <div key={d.aging_bucket} className={`${bc[d.aging_bucket] || 'bg-gray-400'} flex items-center justify-center`} style={{ width: `${d.percentage}%` }}>{d.percentage > 10 && <span className="text-[10px] font-bold text-white">{d.percentage.toFixed(0)}%</span>}</div>)}</div>
    <table className="w-full"><thead><tr className="text-[10px] font-semibold text-gray-500 uppercase"><th className="text-left py-1">Aging</th><th className="text-center py-1">Claims</th><th className="text-right py-1">Amount</th><th className="text-right py-1">%</th></tr></thead><tbody>
      {data.map(d => <tr key={d.aging_bucket} className="border-t border-gray-100"><td className="py-1.5"><div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-sm ${bc[d.aging_bucket]}`} /><span className="text-xs font-medium text-gray-700">{d.aging_bucket}d</span></div></td><td className="py-1.5 text-center text-xs font-mono text-gray-600">{d.claim_count}</td><td className="py-1.5 text-right text-xs font-mono font-semibold text-gray-900">₹{d.total_amount >= 100000 ? `${(d.total_amount / 100000).toFixed(1)}L` : d.total_amount.toLocaleString('en-IN')}</td><td className="py-1.5 text-right text-xs text-gray-500">{d.percentage.toFixed(0)}%</td></tr>)}
    </tbody></table>
  </div>);
}

function TPAPerformanceTable({ data }: { data: TPAPerformance[] }) {
  return (<table className="w-full"><thead><tr className="text-[10px] font-semibold text-gray-500 uppercase border-b"><th className="text-left py-2 px-3">TPA</th><th className="text-center py-2 px-3">Avg TAT</th><th className="text-center py-2 px-3">Approval %</th><th className="text-center py-2 px-3">Deduction %</th><th className="text-right py-2 px-3">Claims</th><th className="text-right py-2 px-3">Settled</th></tr></thead><tbody>
    {data.map(tpa => <tr key={tpa.tpa_id} className="border-b border-gray-50 hover:bg-gray-50/50"><td className="py-2.5 px-3"><span className="text-sm font-medium text-gray-900">{tpa.tpa_name}</span></td><td className="py-2.5 px-3 text-center"><span className={`text-xs font-mono font-medium ${tpa.avg_tat_days <= 15 ? 'text-emerald-600' : tpa.avg_tat_days <= 30 ? 'text-amber-600' : 'text-red-600'}`}>{tpa.avg_tat_days}d</span></td><td className="py-2.5 px-3 text-center"><span className={`text-xs font-mono font-medium ${tpa.approval_rate >= 90 ? 'text-emerald-600' : tpa.approval_rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{tpa.approval_rate.toFixed(0)}%</span></td><td className="py-2.5 px-3 text-center"><span className={`text-xs font-mono font-medium ${tpa.deduction_rate <= 3 ? 'text-emerald-600' : tpa.deduction_rate <= 5 ? 'text-amber-600' : 'text-red-600'}`}>{tpa.deduction_rate.toFixed(1)}%</span></td><td className="py-2.5 px-3 text-right"><span className="text-xs font-mono text-gray-600">{tpa.total_claims}</span></td><td className="py-2.5 px-3 text-right"><span className="text-xs font-mono font-semibold text-gray-900">₹{tpa.total_settled >= 100000 ? `${(tpa.total_settled / 100000).toFixed(1)}L` : tpa.total_settled.toLocaleString('en-IN')}</span></td></tr>)}
  </tbody></table>);
}

export default function InsuranceDeskPage() {
  const router = useRouter();
  const [preAuths, setPreAuths] = useState<PreAuth[]>([]);
  const [agingData, setAgingData] = useState<ClaimAgingSummary[]>([]);
  const [tpaPerformance, setTpaPerformance] = useState<TPAPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'preauth' | 'claims' | 'performance'>('preauth');
  const centreId = 'CURRENT_CENTRE_ID';

  const loadData = useCallback(async () => {
    try { setLoading(true);
      const [paRes, agingRes, tpaRes] = await Promise.all([
        fetch(`/api/billing/pre-auths?centre_id=${centreId}`),
        fetch(`/api/billing/claims/aging?centre_id=${centreId}`),
        fetch(`/api/billing/claims/tpa-performance?centre_id=${centreId}`),
      ]);
      if (paRes.ok) setPreAuths(await paRes.json());
      if (agingRes.ok) setAgingData(await agingRes.json());
      if (tpaRes.ok) setTpaPerformance(await tpaRes.json());
    } catch (err) { console.error('Failed:', err); } finally { setLoading(false); }
  }, [centreId]);
  useEffect(() => { loadData(); }, [loadData]);

  const kanbanColumns = useMemo(() => ({
    DRAFT: preAuths.filter(p => p.status === 'DRAFT'),
    SUBMITTED: preAuths.filter(p => p.status === 'SUBMITTED'),
    QUERY: preAuths.filter(p => p.status === 'QUERY'),
    APPROVED: preAuths.filter(p => ['APPROVED', 'PARTIALLY_APPROVED', 'ENHANCED'].includes(p.status)),
    REJECTED: preAuths.filter(p => ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(p.status)),
  }), [preAuths]);

  const totalPending = agingData.reduce((s, d) => s + d.total_amount, 0);
  const totalClaims = agingData.reduce((s, d) => s + d.claim_count, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Shield className="h-6 w-6 text-blue-600" /><div><h1 className="text-xl font-bold text-[#0A2540]">Insurance Desk</h1><p className="text-xs text-gray-500">Pre-authorizations, Claims, TPA Management</p></div></div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            <button onClick={() => router.push('/billing/insurance/new-preauth')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> New Pre-Auth</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-[10px] font-semibold text-gray-500 uppercase">Active Pre-Auths</p><p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{preAuths.filter(p => !['REJECTED', 'CANCELLED', 'EXPIRED'].includes(p.status)).length}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-[10px] font-semibold text-gray-500 uppercase">Pending Claims</p><p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{totalClaims}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-[10px] font-semibold text-gray-500 uppercase">Outstanding Amount</p><p className="text-2xl font-bold text-gray-900 mt-1 font-mono">₹{totalPending >= 100000 ? `${(totalPending / 100000).toFixed(1)}L` : totalPending.toLocaleString('en-IN')}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-[10px] font-semibold text-gray-500 uppercase">Queries Pending</p><p className="text-2xl font-bold text-orange-600 mt-1 font-mono">{kanbanColumns.QUERY.length}</p></div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[{ id: 'preauth', label: 'Pre-Auth Pipeline', icon: Shield }, { id: 'claims', label: 'Claims Aging', icon: BarChart3 }, { id: 'performance', label: 'TPA Performance', icon: TrendingUp }].map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id as any)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon className="h-3.5 w-3.5" /> {tab.label}</button>
          ))}
        </div>

        {activeSection === 'preauth' && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            <KanbanColumn title="Draft" icon={FileText} color="bg-gray-200 text-gray-700" preAuths={kanbanColumns.DRAFT} onCardClick={(id) => router.push(`/billing/insurance/${id}`)} count={kanbanColumns.DRAFT.length} />
            <KanbanColumn title="Submitted" icon={Send} color="bg-blue-100 text-blue-700" preAuths={kanbanColumns.SUBMITTED} onCardClick={(id) => router.push(`/billing/insurance/${id}`)} count={kanbanColumns.SUBMITTED.length} />
            <KanbanColumn title="Query" icon={HelpCircle} color="bg-orange-100 text-orange-700" preAuths={kanbanColumns.QUERY} onCardClick={(id) => router.push(`/billing/insurance/${id}`)} count={kanbanColumns.QUERY.length} />
            <KanbanColumn title="Approved" icon={CheckCircle2} color="bg-emerald-100 text-emerald-700" preAuths={kanbanColumns.APPROVED} onCardClick={(id) => router.push(`/billing/insurance/${id}`)} count={kanbanColumns.APPROVED.length} />
            <KanbanColumn title="Rejected" icon={XCircle} color="bg-red-100 text-red-700" preAuths={kanbanColumns.REJECTED} onCardClick={(id) => router.push(`/billing/insurance/${id}`)} count={kanbanColumns.REJECTED.length} />
          </div>
        )}

        {activeSection === 'claims' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Claims Outstanding by Aging</h3>
            {agingData.length > 0 ? <AgingBar data={agingData} /> : <p className="text-sm text-gray-400 text-center py-8">No outstanding claims</p>}
          </div>
        )}

        {activeSection === 'performance' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">TPA Performance Tracker</h3><p className="text-xs text-gray-500 mt-0.5">Average TAT, approval rates, deduction percentages</p></div>
            {tpaPerformance.length > 0 ? <TPAPerformanceTable data={tpaPerformance} /> : <p className="text-sm text-gray-400 text-center py-8">No TPA data available</p>}
          </div>
        )}
      </div>
    </div>
  );
}
