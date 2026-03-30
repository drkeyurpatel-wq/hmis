'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus, PlusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useCostCentres, usePnL } from '@/lib/billing/cost-centre-hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 10000000 ? `Rs.${(n/10000000).toFixed(2)} Cr` : n >= 100000 ? `Rs.${(n/100000).toFixed(1)}L` : `Rs.${fmt(n)}`;
const mColor = (pct: number) => pct >= 40 ? 'text-green-700' : pct >= 20 ? 'text-teal-600' : pct >= 0 ? 'text-amber-600' : 'text-red-600';
const mBg = (pct: number) => pct >= 40 ? 'bg-green-50' : pct >= 20 ? 'bg-teal-50' : pct >= 0 ? 'bg-amber-50' : 'bg-red-50';

interface BillPnL {
  id: string; bill_number: string; bill_date: string; bill_type: string;
  patient_name: string; uhid: string; payor_type: string;
  net_amount: number; total_cost: number; margin: number; margin_pct: number;
  items: { description: string; net_amount: number; cost_amount: number; margin: number; margin_pct: number }[];
}

interface TypeSummary { type: string; revenue: number; cost: number; margin: number; margin_pct: number; count: number }
interface DailySummary { date: string; revenue: number; cost: number; margin: number }

const EXPENSE_CATEGORIES = ['salary','consumables','maintenance','rent','utilities','equipment','outsourced','marketing','insurance','miscellaneous'];

function PnLInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [period, setPeriod] = useState<'mtd'|'qtd'|'ytd'|'custom'>('mtd');
  const [view, setView] = useState<'summary'|'bills'|'cost_centres'>('summary');
  const [loading, setLoading] = useState(false);

  // Item-level P&L data
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, margin: 0, marginPct: 0, directCost: 0, overhead: 0, bills: 0 });
  const [bills, setBills] = useState<BillPnL[]>([]);
  const [byType, setByType] = useState<TypeSummary[]>([]);
  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Cost centre P&L (overhead tracking)
  const { costCentres } = useCostCentres(centreId);
  const { rows: ccRows, totals: ccTotals, loadPnL: loadCCPnL, addExpense } = usePnL(centreId);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({ cost_centre_id: '', expense_date: now.toISOString().split('T')[0], category: 'consumables', description: '', amount: 0, vendor: '', reference_number: '' });
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const setPeriodDates = (p: string) => {
    const today = new Date();
    let from: Date;
    switch (p) {
      case 'mtd': from = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case 'qtd': from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1); break;
      case 'ytd': from = new Date(today.getFullYear(), 3, 1); if (from > today) from = new Date(today.getFullYear() - 1, 3, 1); break;
      default: return;
    }
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
    setPeriod(p as any);
  };

  const loadData = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);

    // Fetch bills with items (including cost fields)
    const { data: billData } = await sb().from('hmis_bills')
      .select(`id, bill_number, bill_date, bill_type, payor_type, net_amount, total_cost, status,
        patient:hmis_patients!inner(first_name, last_name, uhid),
        items:hmis_bill_items(description, net_amount, unit_cost, cost_amount)`)
      .eq('centre_id', centreId)
      .gte('bill_date', dateFrom).lte('bill_date', dateTo)
      .neq('status', 'cancelled')
      .order('bill_date', { ascending: false });

    // Fetch overhead expenses
    const { data: overheadData } = await sb().from('hmis_cost_centre_expenses')
      .select('amount')
      .eq('centre_id', centreId)
      .gte('expense_date', dateFrom).lte('expense_date', dateTo);

    const b = billData || [];
    const overhead = (overheadData || []).reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);

    // Build per-bill P&L
    const pnlBills: BillPnL[] = b.map((bill: any) => {
      const netAmt = parseFloat(bill.net_amount) || 0;
      const totalCost = parseFloat(bill.total_cost) || 0;
      const items = (bill.items || []).map((i: any) => {
        const iNet = parseFloat(i.net_amount) || 0;
        const iCost = parseFloat(i.cost_amount) || 0;
        return {
          description: i.description, net_amount: iNet, cost_amount: iCost,
          margin: iNet - iCost, margin_pct: iNet > 0 ? Math.round(((iNet - iCost) / iNet) * 1000) / 10 : 0,
        };
      });
      const margin = netAmt - totalCost;
      return {
        id: bill.id, bill_number: bill.bill_number, bill_date: bill.bill_date,
        bill_type: bill.bill_type, payor_type: bill.payor_type,
        patient_name: `${bill.patient?.first_name || ''} ${bill.patient?.last_name || ''}`.trim(),
        uhid: bill.patient?.uhid || '',
        net_amount: netAmt, total_cost: totalCost, margin,
        margin_pct: netAmt > 0 ? Math.round((margin / netAmt) * 1000) / 10 : 0,
        items,
      };
    });

    // Aggregates
    const totalRevenue = pnlBills.reduce((s, b) => s + b.net_amount, 0);
    const totalDirectCost = pnlBills.reduce((s, b) => s + b.total_cost, 0);
    const totalCost = totalDirectCost + overhead;
    const margin = totalRevenue - totalCost;
    setTotals({
      revenue: totalRevenue, cost: totalCost, margin,
      marginPct: totalRevenue > 0 ? Math.round((margin / totalRevenue) * 1000) / 10 : 0,
      directCost: totalDirectCost, overhead, bills: pnlBills.length,
    });
    setBills(pnlBills);

    // By type
    const typeMap: Record<string, TypeSummary> = {};
    pnlBills.forEach(b => {
      if (!typeMap[b.bill_type]) typeMap[b.bill_type] = { type: b.bill_type, revenue: 0, cost: 0, margin: 0, margin_pct: 0, count: 0 };
      typeMap[b.bill_type].revenue += b.net_amount;
      typeMap[b.bill_type].cost += b.total_cost;
      typeMap[b.bill_type].count++;
    });
    const typeSummaries = Object.values(typeMap).map(t => ({
      ...t, margin: t.revenue - t.cost,
      margin_pct: t.revenue > 0 ? Math.round(((t.revenue - t.cost) / t.revenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
    setByType(typeSummaries);

    // Daily trend
    const dayMap: Record<string, DailySummary> = {};
    pnlBills.forEach(b => {
      if (!dayMap[b.bill_date]) dayMap[b.bill_date] = { date: b.bill_date, revenue: 0, cost: 0, margin: 0 };
      dayMap[b.bill_date].revenue += b.net_amount;
      dayMap[b.bill_date].cost += b.total_cost;
    });
    setDaily(Object.values(dayMap).map(d => ({ ...d, margin: d.revenue - d.cost })).sort((a, b) => a.date.localeCompare(b.date)));

    setLoading(false);
  }, [centreId, dateFrom, dateTo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [loadData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (centreId && view === 'cost_centres') loadCCPnL(dateFrom, dateTo); }, [centreId, view, dateFrom, dateTo, loadCCPnL]);

  const handleAddExpense = async () => {
    if (!expForm.cost_centre_id || !expForm.amount) { flash('Cost centre and amount required'); return; }
    const result = await addExpense({ ...expForm, staffId } as any);
    if (result.error) flash(`Error: ${result.error}`);
    else { flash('Expense logged'); setShowExpenseForm(false); setExpForm({ cost_centre_id: '', expense_date: now.toISOString().split('T')[0], category: 'consumables', description: '', amount: 0, vendor: '', reference_number: '' }); loadData(); loadCCPnL(dateFrom, dateTo); }
  };

  const activeCC = costCentres.filter(c => c.is_active);

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-sm text-gray-500">Live operational margin — item-level cost on every bill</p>
        </div>
        <div className="flex gap-2 items-center">
          {(['mtd','qtd','ytd'] as const).map(p => (
            <button key={p} onClick={() => setPeriodDates(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${period === p ? 'bg-teal-600 text-white' : 'bg-white border text-gray-500 hover:bg-gray-50'}`}>
              {p.toUpperCase()}
            </button>
          ))}
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriod('custom'); }} className="text-sm border rounded-lg px-2 py-1.5" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriod('custom'); }} className="text-sm border rounded-lg px-2 py-1.5" />
          <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 flex items-center gap-1.5">
            <PlusCircle size={14} /> Overhead
          </button>
        </div>
      </div>

      {/* Expense Form */}
      {showExpenseForm && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-6 space-y-3">
          <h3 className="font-bold text-sm text-orange-800">Log Overhead Expense</h3>
          <div className="grid grid-cols-7 gap-3">
            <div><label className="text-[10px] text-gray-500 font-medium">Cost Centre *</label>
              <select value={expForm.cost_centre_id} onChange={e => setExpForm(f => ({ ...f, cost_centre_id: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs">
                <option value="">Select...</option>
                {activeCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Date</label>
              <input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Category</label>
              <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Amount (Rs.) *</label>
              <input type="number" value={expForm.amount || ''} onChange={e => setExpForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-2 border rounded-lg text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Description</label>
              <input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" placeholder="Staff salary Mar" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Vendor</label>
              <input value={expForm.vendor} onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" /></div>
            <div className="flex items-end gap-2">
              <button onClick={handleAddExpense} className="px-4 py-2 bg-orange-600 text-white text-xs rounded-lg font-medium">Save</button>
              <button onClick={() => setShowExpenseForm(false)} className="px-3 py-2 bg-gray-100 text-xs rounded-lg border">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Revenue</div>
          <div className="text-xl font-bold text-teal-700 mt-1">{INR(totals.revenue)}</div>
          <div className="text-[9px] text-gray-400">{totals.bills} bills</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Direct Cost</div>
          <div className="text-xl font-bold text-orange-600 mt-1">{INR(totals.directCost)}</div>
          <div className="text-[9px] text-gray-400">From tariff/pharmacy/implant</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Overhead</div>
          <div className="text-xl font-bold text-purple-600 mt-1">{INR(totals.overhead)}</div>
          <div className="text-[9px] text-gray-400">Salary, rent, etc.</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Total Cost</div>
          <div className="text-xl font-bold text-red-600 mt-1">{INR(totals.cost)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${mBg(totals.marginPct)}`}>
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Net Margin</div>
          <div className={`text-xl font-bold mt-1 ${mColor(totals.marginPct)}`}>{INR(totals.margin)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${mBg(totals.marginPct)}`}>
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Margin %</div>
          <div className={`text-xl font-bold mt-1 flex items-center gap-2 ${mColor(totals.marginPct)}`}>
            {totals.marginPct > 0 ? <TrendingUp size={16} /> : totals.marginPct < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
            {totals.marginPct}%
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-6">
        {([['summary','Summary'],['bills','Per-Patient Bills'],['cost_centres','Cost Centres']] as const).map(([k,l]) =>
          <button key={k} onClick={() => setView(k as any)} className={`px-4 py-2 text-sm rounded-lg border ${view === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200 text-gray-600'}`}>{l}</button>
        )}
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> : <>

        {/* ===== SUMMARY VIEW ===== */}
        {view === 'summary' && <>
          {/* Trend chart */}
          {daily.length > 1 && (
            <div className="bg-white rounded-2xl border p-5 mb-6">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Daily Revenue vs Cost</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={daily} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={(d: string) => new Date(d+'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} formatter={(v: number) => `Rs.${fmt(v)}`} />
                  <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="cost" fill="#ea580c" radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By bill type */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-bold">Margin by Service Type</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-3 text-left font-medium text-gray-500">Type</th>
                <th className="p-3 text-center font-medium text-gray-500">Bills</th>
                <th className="p-3 text-right font-medium text-gray-500">Revenue</th>
                <th className="p-3 text-right font-medium text-gray-500">Direct Cost</th>
                <th className="p-3 text-right font-medium text-gray-500">Margin</th>
                <th className="p-3 text-center font-medium text-gray-500">Margin %</th>
              </tr></thead>
              <tbody>
                {byType.map(t => (
                  <tr key={t.type} className="border-b hover:bg-gray-50">
                    <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium uppercase">{t.type}</span></td>
                    <td className="p-3 text-center text-gray-500">{t.count}</td>
                    <td className="p-3 text-right font-medium text-teal-700">{INR(t.revenue)}</td>
                    <td className="p-3 text-right text-orange-600">{t.cost > 0 ? INR(t.cost) : <span className="text-gray-300">—</span>}</td>
                    <td className={`p-3 text-right font-bold ${mColor(t.margin_pct)}`}>{INR(t.margin)}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${mColor(t.margin_pct)}`}>{t.margin_pct}%</span>
                    </td>
                  </tr>
                ))}
                {byType.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400 text-xs">No bills in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </>}

        {/* ===== PER-PATIENT BILLS VIEW ===== */}
        {view === 'bills' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold">Per-Patient Profitability</h3>
              <span className="text-xs text-gray-400">{bills.length} bills</span>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-3 text-left font-medium text-gray-500">Bill</th>
                <th className="p-3 text-left font-medium text-gray-500">Patient</th>
                <th className="p-3 text-center font-medium text-gray-500">Type</th>
                <th className="p-3 text-center font-medium text-gray-500">Payor</th>
                <th className="p-3 text-right font-medium text-gray-500">Revenue</th>
                <th className="p-3 text-right font-medium text-gray-500">Cost</th>
                <th className="p-3 text-right font-medium text-gray-500">Margin</th>
                <th className="p-3 text-center font-medium text-gray-500">%</th>
              </tr></thead>
              <tbody>
                {bills.map(b => (
                  <React.Fragment key={b.id}>
                    <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {expanded === b.id ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          <div>
                            <span className="font-mono text-teal-600">{b.bill_number}</span>
                            <div className="text-[9px] text-gray-400">{b.bill_date}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{b.patient_name}</span>
                        <span className="ml-1.5 text-gray-400">{b.uhid}</span>
                      </td>
                      <td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] uppercase">{b.bill_type}</span></td>
                      <td className="p-3 text-center"><span className="text-[9px] text-gray-500 capitalize">{b.payor_type?.replace('_', ' ')}</span></td>
                      <td className="p-3 text-right font-medium">{INR(b.net_amount)}</td>
                      <td className="p-3 text-right text-orange-600">{b.total_cost > 0 ? INR(b.total_cost) : <span className="text-gray-300">—</span>}</td>
                      <td className={`p-3 text-right font-bold ${mColor(b.margin_pct)}`}>{b.total_cost > 0 ? INR(b.margin) : '—'}</td>
                      <td className="p-3 text-center">
                        {b.total_cost > 0 ? <span className={`font-bold ${mColor(b.margin_pct)}`}>{b.margin_pct}%</span> : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>

                    {/* Expanded: item-level breakdown */}
                    {expanded === b.id && b.items.length > 0 && (
                      <tr><td colSpan={8} className="p-0">
                        <div className="bg-gray-50 px-8 py-3 border-b">
                          <table className="w-full text-[10px]">
                            <thead><tr className="border-b border-gray-200">
                              <th className="py-1.5 text-left text-gray-500">Item</th>
                              <th className="py-1.5 text-right text-gray-500">Revenue</th>
                              <th className="py-1.5 text-right text-gray-500">Cost</th>
                              <th className="py-1.5 text-right text-gray-500">Margin</th>
                              <th className="py-1.5 text-center text-gray-500">%</th>
                            </tr></thead>
                            <tbody>{b.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5">{item.description}</td>
                                <td className="py-1.5 text-right">Rs.{fmt(item.net_amount)}</td>
                                <td className="py-1.5 text-right text-orange-600">{item.cost_amount > 0 ? `Rs.${fmt(item.cost_amount)}` : '—'}</td>
                                <td className={`py-1.5 text-right font-medium ${mColor(item.margin_pct)}`}>{item.cost_amount > 0 ? `Rs.${fmt(item.margin)}` : '—'}</td>
                                <td className="py-1.5 text-center">
                                  {item.cost_amount > 0 ? <span className={`font-bold ${mColor(item.margin_pct)}`}>{item.margin_pct}%</span> : '—'}
                                </td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
                {bills.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-gray-400 text-sm">No bills in this period</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== COST CENTRES VIEW ===== */}
        {view === 'cost_centres' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-bold">Revenue & Overhead by Cost Centre</h3></div>
            {ccRows.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">No cost centres configured. Set them up in Settings &gt; Cost Centres.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left font-medium text-gray-500">Cost Centre</th>
                  <th className="p-3 text-right font-medium text-gray-500">Revenue</th>
                  <th className="p-3 text-right font-medium text-gray-500">Expenses</th>
                  <th className="p-3 text-right font-medium text-gray-500">Margin</th>
                  <th className="p-3 text-center font-medium text-gray-500">%</th>
                  <th className="p-3 text-right font-medium text-gray-500">Budget Var</th>
                </tr></thead>
                <tbody>
                  {ccRows.map(row => (
                    <tr key={row.costCentreId} className="border-b hover:bg-gray-50">
                      <td className="p-3"><span className="font-medium">{row.costCentreName}</span> <span className="font-mono text-xs text-gray-400 ml-1">{row.costCentreCode}</span></td>
                      <td className="p-3 text-right text-teal-700 font-medium">{row.revenue > 0 ? INR(row.revenue) : '—'}</td>
                      <td className="p-3 text-right text-orange-600">{row.expenses > 0 ? INR(row.expenses) : '—'}</td>
                      <td className={`p-3 text-right font-bold ${mColor(row.marginPct)}`}>{INR(row.margin)}</td>
                      <td className="p-3 text-center"><span className={`font-bold ${mColor(row.marginPct)}`}>{row.marginPct}%</span></td>
                      <td className="p-3 text-right">
                        {row.budgetMonthly > 0 ? (
                          <span className={`text-xs font-medium ${row.budgetVariance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {row.budgetVariance >= 0 ? '+' : ''}{INR(row.budgetVariance)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </>}
    </div>
  );
}

export default function PnLPage() { return <RoleGuard module="billing"><PnLInner /></RoleGuard>; }
