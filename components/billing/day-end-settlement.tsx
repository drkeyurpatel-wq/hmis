// components/billing/day-end-settlement.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { openPrintWindow } from '@/components/ui/shared';

interface Props { bills: any[]; }

const DENOMINATIONS = [{ val: 2000, label: '₹2000' },{ val: 500, label: '₹500' },{ val: 200, label: '₹200' },{ val: 100, label: '₹100' },{ val: 50, label: '₹50' },{ val: 20, label: '₹20' },{ val: 10, label: '₹10' },{ val: 5, label: '₹5' },{ val: 2, label: '₹2' },{ val: 1, label: '₹1' }];

export default function DayEndSettlement({ bills }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [denoms, setDenoms] = useState<Record<number, number>>(Object.fromEntries(DENOMINATIONS.map(d => [d.val, 0])));
  const [openingBalance, setOpeningBalance] = useState(0);

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const todayStats = useMemo(() => {
    const todayBills = bills.filter(b => b.bill_date === today && b.status !== 'cancelled');
    const totalBilled = todayBills.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0);
    const totalCollected = todayBills.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
    const totalDiscount = todayBills.reduce((s, b) => s + parseFloat(b.discount_amount || 0), 0);
    // Mode-wise (approximation from bill data — real implementation would query payments)
    const newBills = todayBills.length;
    const paidBills = todayBills.filter(b => b.status === 'paid').length;
    const partialBills = todayBills.filter(b => b.status === 'partially_paid').length;
    const unpaidBills = todayBills.filter(b => parseFloat(b.balance_amount) > 0).length;
    return { totalBilled, totalCollected, totalDiscount, newBills, paidBills, partialBills, unpaidBills };
  }, [bills, today]);

  const cashCount = Object.entries(denoms).reduce((s, [val, count]) => s + parseInt(val) * count, 0);
  const expectedCash = todayStats.totalCollected; // Simplified — real impl filters by cash mode
  const difference = cashCount + openingBalance - expectedCash;

  const printSettlement = () => {
    const denomRows = DENOMINATIONS.filter(d => denoms[d.val] > 0).map(d => `<tr><td style="padding:2px 8px">${d.label}</td><td style="padding:2px 8px;text-align:center">${denoms[d.val]}</td><td style="padding:2px 8px;text-align:right">₹${fmt(d.val * denoms[d.val])}</td></tr>`).join('');
    openPrintWindow(`<div style="max-width:500px;margin:0 auto;font-family:'Segoe UI',Arial;font-size:11px">
      <div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:6px;margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:#1e40af">Health1 Super Speciality Hospital</div>
        <div style="font-size:12px;font-weight:700;margin-top:4px">DAY-END SETTLEMENT</div>
        <div style="font-size:9px;color:#666">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <table style="width:100%;font-size:10px;margin-bottom:8px">
        <tr><td>Total Bills</td><td style="text-align:right;font-weight:600">${todayStats.newBills}</td></tr>
        <tr><td>Total Billed</td><td style="text-align:right;font-weight:600">₹${fmt(todayStats.totalBilled)}</td></tr>
        <tr><td>Total Collected</td><td style="text-align:right;font-weight:600;color:#16a34a">₹${fmt(todayStats.totalCollected)}</td></tr>
        <tr><td>Total Discount</td><td style="text-align:right;color:#dc2626">₹${fmt(todayStats.totalDiscount)}</td></tr>
      </table>
      ${denomRows ? `<div style="font-size:10px;font-weight:600;margin-bottom:4px">Cash Denomination:</div><table style="width:100%;font-size:10px;margin-bottom:8px">${denomRows}<tr style="border-top:2px solid #333;font-weight:700"><td style="padding:4px 8px">TOTAL CASH</td><td></td><td style="padding:4px 8px;text-align:right">₹${fmt(cashCount)}</td></tr></table>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:30px;font-size:9px"><div style="text-align:center;width:150px"><div style="border-bottom:1px solid #333;margin-bottom:4px;height:30px"></div>Cashier Signature</div><div style="text-align:center;width:150px"><div style="border-bottom:1px solid #333;margin-bottom:4px;height:30px"></div>Supervisor Signature</div></div>
    </div>`, 'Day-End-Settlement');
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm">Day-End Settlement — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Bills Today</div><div className="text-xl font-bold">{todayStats.newBills}</div><div className="text-[10px] text-gray-400">Paid: {todayStats.paidBills} | Partial: {todayStats.partialBills} | Unpaid: {todayStats.unpaidBills}</div></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center"><div className="text-[10px] text-blue-600">Total Billed</div><div className="text-xl font-bold text-blue-700">₹{fmt(todayStats.totalBilled)}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div className="text-[10px] text-green-600">Collected</div><div className="text-xl font-bold text-green-700">₹{fmt(todayStats.totalCollected)}</div></div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 text-center"><div className="text-[10px] text-orange-600">Discounts</div><div className="text-xl font-bold text-orange-700">₹{fmt(todayStats.totalDiscount)}</div></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Cash denomination count */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Cash Denomination Count</h3>
          <div><label className="text-xs text-gray-500">Opening Balance</label>
            <input type="number" value={openingBalance || ''} onChange={e => setOpeningBalance(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" placeholder="₹0" /></div>
          <div className="space-y-1.5">{DENOMINATIONS.map(d => (
            <div key={d.val} className="flex items-center gap-2">
              <span className="w-14 text-xs font-mono text-right">{d.label}</span>
              <span className="text-xs text-gray-400">×</span>
              <input type="number" value={denoms[d.val] || ''} onChange={e => setDenoms(prev => ({...prev, [d.val]: parseInt(e.target.value) || 0}))} className="w-16 px-2 py-1 border rounded text-sm text-center" min="0" />
              <span className="text-xs text-gray-400">=</span>
              <span className="text-xs font-bold w-20 text-right">₹{fmt(d.val * (denoms[d.val] || 0))}</span>
            </div>
          ))}</div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-sm font-bold">Total Cash in Hand</span>
            <span className="text-lg font-bold text-green-700">₹{fmt(cashCount + openingBalance)}</span>
          </div>
        </div>

        {/* Reconciliation */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Reconciliation</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b"><span className="text-sm">Total collections (all modes)</span><span className="font-bold">₹{fmt(todayStats.totalCollected)}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-sm">Opening balance</span><span className="font-bold">₹{fmt(openingBalance)}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-sm">Cash counted</span><span className="font-bold">₹{fmt(cashCount)}</span></div>
            <div className={`flex justify-between py-3 rounded-lg px-3 ${Math.abs(difference) < 10 ? 'bg-green-50' : difference > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <span className="text-sm font-bold">{Math.abs(difference) < 10 ? 'Balanced ✓' : difference > 0 ? 'Excess' : 'Short'}</span>
              <span className={`text-lg font-bold ${Math.abs(difference) < 10 ? 'text-green-700' : difference > 0 ? 'text-blue-700' : 'text-red-700'}`}>₹{fmt(Math.abs(difference))}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button onClick={printSettlement} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Print Day-End Report</button>
            <button className="w-full py-2 bg-green-600 text-white rounded-xl text-sm">Close Counter & Submit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
