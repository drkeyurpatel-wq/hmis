'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useBilling, type Bill, type BillItem } from '@/lib/revenue/hooks';
import { RoleGuard, TableSkeleton, printBill } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';

function BillingPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { bills, loading, tariffs, loadBills, createBillFromEncounter, loadBillItems, addBillItem, collectPayment, finalizeBill, applyDiscount } = useBilling(centreId);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [showAddItem, setShowAddItem] = useState(false);
  const [tariffSearch, setTariffSearch] = useState('');
  const [discountAmt, setDiscountAmt] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Load bill items when selected
  useEffect(() => {
    if (selectedBill) {
      loadBillItems(selectedBill.id).then(items => setBillItems(items));
    }
  }, [selectedBill, loadBillItems]);

  useEffect(() => { loadBills(dateFilter); }, [dateFilter, loadBills]);

  // URL param: auto-create bill for patient
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patient');
    const encounterId = params.get('encounter');
    if (patientId && encounterId && tariffs.length > 0) {
      const consultTariff = tariffs.find((t: any) => t.service_code === 'OPD-CONSULT');
      if (consultTariff) {
        createBillFromEncounter(patientId, encounterId, staffId, [
          { description: consultTariff.service_name, quantity: 1, unitRate: consultTariff.rate_self, tariffId: consultTariff.id }
        ]).then(r => { if (r?.bill) setSelectedBill({ ...r.bill, items: [] } as any); });
      }
    }
  }, [tariffs]);

  const handlePayment = async () => {
    if (!selectedBill || !payAmount) return;
    await collectPayment(selectedBill.id, parseFloat(payAmount), payMode, staffId);
    setShowPayment(false); setPayAmount('');
    const updated = bills.find(b => b.id === selectedBill.id);
    if (updated) setSelectedBill(updated);
  };

  const handleAddItem = async (tariff: any) => {
    if (!selectedBill) return;
    await addBillItem(selectedBill.id, { description: tariff.service_name, quantity: 1, unitRate: tariff.rate_self, tariffId: tariff.id });
    const items = await loadBillItems(selectedBill.id);
    setBillItems(items);
    setShowAddItem(false); setTariffSearch('');
  };

  const handleDiscount = async () => {
    if (!selectedBill || !discountAmt) return;
    await applyDiscount(selectedBill.id, parseFloat(discountAmt));
    setDiscountAmt('');
  };

  const filteredBills = bills.filter(b => statusFilter === 'all' || b.status === statusFilter);
  const todayTotal = bills.reduce((s, b) => s + b.paidAmount, 0);
  const todayPending = bills.reduce((s, b) => s + b.balanceAmount, 0);

  const stColor = (s: string) => s === 'paid' ? 'bg-green-100 text-green-800' : s === 'draft' ? 'bg-gray-100 text-gray-700' : s === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' : s === 'final' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800';

  const filteredTariffs = tariffSearch.length >= 1 ? tariffs.filter((t: any) => t.service_name.toLowerCase().includes(tariffSearch.toLowerCase()) || t.service_code.toLowerCase().includes(tariffSearch.toLowerCase())) : tariffs;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Billing</h1><p className="text-sm text-gray-500">OPD billing and payment collection</p></div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Bills today</div><div className="text-2xl font-bold">{bills.length}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Collected</div><div className="text-2xl font-bold text-green-700">Rs.{todayTotal.toLocaleString('en-IN')}</div></div>
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">Rs.{todayPending.toLocaleString('en-IN')}</div></div>
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg bill</div><div className="text-2xl font-bold text-blue-700">Rs.{bills.length ? Math.round(bills.reduce((s, b) => s + b.netAmount, 0) / bills.length).toLocaleString('en-IN') : '0'}</div></div>
      </div>

      <div className="flex gap-6">
        {/* Bill List */}
        <div className="w-1/2">
          <div className="flex gap-2 mb-3">{[['all','All'],['draft','Draft'],['final','Final'],['partially_paid','Partial'],['paid','Paid']].map(([k,l]) =>
            <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
          )}</div>

          {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
          filteredBills.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No bills for this date</div> :
          <div className="space-y-2">{filteredBills.map(b => (
            <div key={b.id} onClick={() => setSelectedBill(b)} className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-400 ${selectedBill?.id === b.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-blue-600">{b.billNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${stColor(b.status)}`}>{b.status}</span>
              </div>
              <div className="font-medium text-sm mt-1">{b.patientName}</div>
              <div className="text-xs text-gray-400">{b.patientUhid} | {b.billType.toUpperCase()} | {b.payorType}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-semibold">Rs.{b.netAmount.toLocaleString('en-IN')}</span>
                {b.balanceAmount > 0 && <span className="text-xs text-red-600">Due: Rs.{b.balanceAmount.toLocaleString('en-IN')}</span>}
              </div>
            </div>
          ))}</div>}
        </div>

        {/* Bill Detail */}
        <div className="w-1/2">
          {!selectedBill ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select a bill to view details</div> : (
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div><div className="font-mono text-sm text-blue-600">{selectedBill.billNumber}</div>
                  <div className="font-semibold text-lg">{selectedBill.patientName}</div>
                  <div className="text-xs text-gray-400">{selectedBill.patientUhid} | {selectedBill.payorType}</div></div>
                <span className={`px-3 py-1 rounded-full text-sm ${stColor(selectedBill.status)}`}>{selectedBill.status}</span>
              </div>

              {/* Items */}
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50"><th className="text-left p-2 text-xs text-gray-500">Item</th><th className="text-right p-2 text-xs text-gray-500">Qty</th><th className="text-right p-2 text-xs text-gray-500">Rate</th><th className="text-right p-2 text-xs text-gray-500">Amount</th></tr></thead>
                  <tbody>{billItems.map(i => (
                    <tr key={i.id} className="border-t"><td className="p-2">{i.description}</td><td className="p-2 text-right">{i.quantity}</td><td className="p-2 text-right">Rs.{i.unitRate.toLocaleString('en-IN')}</td><td className="p-2 text-right font-medium">Rs.{i.netAmount.toLocaleString('en-IN')}</td></tr>
                  ))}{billItems.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 text-xs">No items — add from tariff master</td></tr>}</tbody>
                </table>
              </div>

              <button onClick={() => setShowAddItem(!showAddItem)} className="text-xs text-blue-600 hover:text-blue-800 mb-3">+ Add item from tariff</button>
              {showAddItem && <div className="border rounded-lg p-3 bg-gray-50 mb-4">
                <input type="text" placeholder="Search tariff..." value={tariffSearch} onChange={e => setTariffSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                <div className="max-h-40 overflow-y-auto space-y-1">{filteredTariffs.slice(0, 15).map((t: any) =>
                  <button key={t.id} onClick={() => handleAddItem(t)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex justify-between">
                    <span>{t.service_name}</span><span className="text-gray-400">Rs.{t.rate_self}</span></button>
                )}</div>
              </div>}

              {/* Totals */}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Gross</span><span>Rs.{selectedBill.grossAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500">Discount</span>
                  <div className="flex gap-2 items-center"><input type="number" placeholder="0" value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} className="w-20 px-2 py-1 border rounded text-xs text-right" />
                    {discountAmt && <button onClick={handleDiscount} className="text-xs text-blue-600">Apply</button>}</div></div>
                <div className="flex justify-between"><span className="text-gray-500">Discount applied</span><span className="text-red-600">-Rs.{selectedBill.discountAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Net amount</span><span>Rs.{selectedBill.netAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-green-600"><span>Paid</span><span>Rs.{selectedBill.paidAmount.toLocaleString('en-IN')}</span></div>
                {selectedBill.balanceAmount > 0 && <div className="flex justify-between text-red-600 font-semibold"><span>Balance due</span><span>Rs.{selectedBill.balanceAmount.toLocaleString('en-IN')}</span></div>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                {selectedBill.status === 'draft' && <button onClick={() => finalizeBill(selectedBill.id)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Finalize Bill</button>}
                {selectedBill.balanceAmount > 0 && <button onClick={() => { setShowPayment(true); setPayAmount(selectedBill.balanceAmount.toString()); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Collect Payment</button>}
                <button className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg" onClick={() => {
                  if(!selectedBill) return;
                  printBill({
                    billNumber: selectedBill.billNumber, billDate: selectedBill.billDate,
                    patientName: selectedBill.patientName, patientUhid: selectedBill.patientUhid,
                    ageGender: '--', payorType: selectedBill.payorType,
                    items: billItems.map(i => ({ description: i.description, quantity: i.quantity, rate: i.unitRate, amount: i.netAmount })),
                    grossAmount: selectedBill.grossAmount, discountAmount: selectedBill.discountAmount,
                    netAmount: selectedBill.netAmount, paidAmount: selectedBill.paidAmount, balanceAmount: selectedBill.balanceAmount,
                    payments: [],
                  }, { name: 'Health1 Super Speciality Hospital', address: 'Shilaj, Ahmedabad', phone: '+91 79 6190 1111', tagline: '330 Beds' });
                }}>Print Bill</button>
              </div>

              {/* Payment modal */}
              {showPayment && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowPayment(false)}>
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-4">Collect Payment</h3>
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Amount *</label>
                      <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-lg font-bold" /></div>
                    <div><label className="text-xs text-gray-500">Mode *</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">{['cash','card','upi','neft','cheque'].map(m =>
                        <button key={m} onClick={() => setPayMode(m)} className={`px-3 py-2 text-xs rounded-lg border ${payMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{m.toUpperCase()}</button>
                      )}</div></div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handlePayment} disabled={!payAmount} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Confirm Payment</button>
                      <button onClick={() => setShowPayment(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingPageInner /></RoleGuard>; }
