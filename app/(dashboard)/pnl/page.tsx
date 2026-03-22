'use client';
import React, { useState, useEffect } from 'react';
import { usePnL, useCostCentres, type PnLRow } from '@/lib/billing/cost-centre-hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, PlusCircle } from 'lucide-react';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 10000000 ? `Rs.${(n/10000000).toFixed(2)} Cr` : n >= 100000 ? `Rs.${(n/100000).toFixed(1)}L` : `Rs.${fmt(n)}`;
const pctColor = (pct: number) => pct > 20 ? 'text-green-700' : pct > 0 ? 'text-teal-600' : pct === 0 ? 'text-gray-400' : 'text-red-600';

const EXPENSE_CATEGORIES = ['salary','consumables','maintenance','rent','utilities','equipment','outsourced','marketing','insurance','miscellaneous'];

function PnLInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [period, setPeriod] = useState<'mtd'|'qtd'|'ytd'|'custom'>('mtd');

  const { rows, totals, loading, loadPnL, addExpense } = usePnL(centreId);
  const { costCentres } = useCostCentres(centreId);
  const [expanded, setExpanded] = useState<string | null>(null);
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

  useEffect(() => { if (centreId) loadPnL(dateFrom, dateTo); }, [centreId, dateFrom, dateTo, loadPnL]);

  const handleAddExpense = async () => {
    if (!expForm.cost_centre_id || !expForm.amount) { flash('Cost centre and amount required'); return; }
    const result = await addExpense({ ...expForm, staffId } as any);
    if (result.error) flash(`Error: ${result.error}`);
    else { flash('Expense logged'); setShowExpenseForm(false); setExpForm({ cost_centre_id: '', expense_date: now.toISOString().split('T')[0], category: 'consumables', description: '', amount: 0, vendor: '', reference_number: '' }); loadPnL(dateFrom, dateTo); }
  };

  // Chart data
  const chartData = rows.slice(0, 10).map(r => ({
    name: r.costCentreCode,
    revenue: Math.round(r.revenue),
    expenses: Math.round(r.expenses),
    margin: Math.round(r.margin),
  }));

  const activeCC = costCentres.filter(c => c.is_active);

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-sm text-gray-500">Live P&L by cost centre — revenue vs expenses</p>
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
            <PlusCircle size={14} /> Log Expense
          </button>
        </div>
      </div>

      {/* Expense Form */}
      {showExpenseForm && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-6 space-y-3">
          <h3 className="font-bold text-sm text-orange-800">Log Expense</h3>
          <div className="grid grid-cols-7 gap-3">
            <div><label className="text-[10px] text-gray-500 font-medium">Cost Centre *</label>
              <select value={expForm.cost_centre_id} onChange={e => setExpForm(f => ({ ...f, cost_centre_id: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs">
                <option value="">Select...</option>
                {activeCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Date *</label>
              <input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Category</label>
              <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Amount (Rs.) *</label>
              <input type="number" value={expForm.amount || ''} onChange={e => setExpForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-2 border rounded-lg text-xs" placeholder="0" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Description</label>
              <input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" placeholder="Staff salary Mar" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Vendor</label>
              <input value={expForm.vendor} onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))} className="w-full px-2 py-2 border rounded-lg text-xs" placeholder="Optional" /></div>
            <div className="flex items-end gap-2">
              <button onClick={handleAddExpense} className="px-4 py-2 bg-orange-600 text-white text-xs rounded-lg font-medium">Save</button>
              <button onClick={() => setShowExpenseForm(false)} className="px-3 py-2 bg-gray-100 text-xs rounded-lg border">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold text-teal-700 mt-1">{INR(totals.revenue)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">Total Expenses</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{INR(totals.expenses)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">Net Margin</div>
          <div className={`text-2xl font-bold mt-1 ${totals.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {INR(Math.abs(totals.margin))} {totals.margin < 0 ? '(Loss)' : ''}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">Margin %</div>
          <div className={`text-2xl font-bold mt-1 flex items-center gap-2 ${pctColor(totals.marginPct)}`}>
            {totals.marginPct > 0 ? <TrendingUp size={18} /> : totals.marginPct < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
            {totals.marginPct}%
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Revenue vs Expenses by Cost Centre</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} formatter={(v: number) => `Rs.${fmt(v)}`} />
              <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#ea580c" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L Table */}
      {loading ? <TableSkeleton rows={8} cols={7} /> : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <div className="text-gray-300 text-4xl mb-3">$</div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">No P&L data yet</h3>
          <p className="text-xs text-gray-400">Set up cost centres in Settings, add mapping rules, and start billing.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-3 text-left font-medium text-gray-500">Cost Centre</th>
              <th className="p-3 text-center font-medium text-gray-500">Type</th>
              <th className="p-3 text-right font-medium text-gray-500">Revenue</th>
              <th className="p-3 text-right font-medium text-gray-500">Expenses</th>
              <th className="p-3 text-right font-medium text-gray-500">Margin</th>
              <th className="p-3 text-center font-medium text-gray-500">Margin %</th>
              <th className="p-3 text-right font-medium text-gray-500">Budget Var</th>
            </tr></thead>
            <tbody>
              {rows.map(row => (
                <React.Fragment key={row.costCentreId}>
                  <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === row.costCentreId ? null : row.costCentreId)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{expanded === row.costCentreId ? '▾' : '▸'}</span>
                        <div>
                          <span className="font-medium">{row.costCentreName}</span>
                          <span className="ml-2 font-mono text-xs text-gray-400">{row.costCentreCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        row.costCentreType === 'revenue' ? 'bg-green-100 text-green-700' :
                        row.costCentreType === 'expense' ? 'bg-red-100 text-red-700' :
                        row.costCentreType === 'overhead' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{row.costCentreType}</span>
                    </td>
                    <td className="p-3 text-right font-medium text-teal-700">{row.revenue > 0 ? INR(row.revenue) : '—'}</td>
                    <td className="p-3 text-right font-medium text-orange-600">{row.expenses > 0 ? INR(row.expenses) : '—'}</td>
                    <td className={`p-3 text-right font-bold ${row.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{INR(Math.abs(row.margin))}{row.margin < 0 ? ' (L)' : ''}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${pctColor(row.marginPct)}`}>{row.marginPct}%</span>
                    </td>
                    <td className="p-3 text-right">
                      {row.budgetMonthly > 0 ? (
                        <span className={`text-xs font-medium ${row.budgetVariance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.budgetVariance >= 0 ? '+' : ''}{INR(row.budgetVariance)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expanded === row.costCentreId && (
                    <tr><td colSpan={7} className="p-0">
                      <div className="bg-gray-50 px-8 py-4 grid grid-cols-2 gap-6 border-b">
                        {/* Revenue breakdown */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-600 mb-2">Revenue Breakdown</h4>
                          {Object.keys(row.revenueByCategory).length === 0 ? <p className="text-[10px] text-gray-400">No revenue data</p> :
                          <div className="space-y-1.5">
                            {Object.entries(row.revenueByCategory).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between items-center">
                                <span className="text-xs text-gray-600 capitalize">{cat.replace(/_/g, ' ')}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${row.revenue > 0 ? (amt / row.revenue) * 100 : 0}%` }} />
                                  </div>
                                  <span className="text-xs font-medium text-teal-700 w-20 text-right">Rs.{fmt(amt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>}
                        </div>
                        {/* Expense breakdown */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-600 mb-2">Expense Breakdown</h4>
                          {Object.keys(row.expenseByCategory).length === 0 ? <p className="text-[10px] text-gray-400">No expenses logged</p> :
                          <div className="space-y-1.5">
                            {Object.entries(row.expenseByCategory).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between items-center">
                                <span className="text-xs text-gray-600 capitalize">{cat.replace(/_/g, ' ')}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${row.expenses > 0 ? (amt / row.expenses) * 100 : 0}%` }} />
                                  </div>
                                  <span className="text-xs font-medium text-orange-600 w-20 text-right">Rs.{fmt(amt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}

              {/* Grand totals row */}
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                <td className="p-3">TOTAL</td>
                <td className="p-3"></td>
                <td className="p-3 text-right text-teal-700">{INR(totals.revenue)}</td>
                <td className="p-3 text-right text-orange-600">{INR(totals.expenses)}</td>
                <td className={`p-3 text-right ${totals.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{INR(Math.abs(totals.margin))}</td>
                <td className={`p-3 text-center ${pctColor(totals.marginPct)}`}>{totals.marginPct}%</td>
                <td className="p-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PnLPage() { return <RoleGuard module="billing"><PnLInner /></RoleGuard>; }
