'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { usePharmacy, useBilling, type PharmacyOrder } from '@/lib/revenue/hooks';
import { useAuthStore } from '@/lib/store/auth';

export default function PharmacyPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { orders, loading, loadOrders, dispenseOrder, startDispensing } = usePharmacy(centreId);
  const { createBillFromEncounter } = useBilling(centreId);

  const [selectedOrder, setSelectedOrder] = useState<PharmacyOrder | null>(null);
  const [dispensingItems, setDispensingItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [toast, setToast] = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // When selecting an order, build dispensing items from prescriptions
  useEffect(() => {
    if (selectedOrder) {
      setDispensingItems(selectedOrder.prescriptions.map((p: any, i: number) => ({
        ...p, index: i, dispensed: true, dispensedQty: p.quantity || 1,
        unitPrice: p.mrp || 0, available: true,
      })));
    }
  }, [selectedOrder]);

  const handleDispense = async () => {
    if (!selectedOrder) return;
    const items = dispensingItems.filter(i => i.dispensed);
    const total = items.reduce((s: number, i: any) => s + (i.dispensedQty * i.unitPrice), 0);
    await dispenseOrder(selectedOrder.id, items, staffId, total);

    // Auto-create pharmacy bill if total > 0
    if (total > 0 && selectedOrder.patientId && selectedOrder.encounterId) {
      const billItems = items.map((i: any) => ({
        description: `${i.brand || i.generic} ${i.strength || ''} x ${i.dispensedQty}`,
        quantity: i.dispensedQty, unitRate: i.unitPrice,
      }));
      await createBillFromEncounter(selectedOrder.patientId, selectedOrder.encounterId, staffId, billItems, 'self');
    }

    flash('Dispensed successfully' + (total > 0 ? ` — Bill created: Rs.${total}` : ''));
    setSelectedOrder(null);
  };

  const filteredOrders = orders.filter(o => statusFilter === 'all' || o.status === statusFilter);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const inProgressCount = orders.filter(o => o.status === 'in_progress').length;
  const dispensedCount = orders.filter(o => o.status === 'dispensed').length;

  const stColor = (s: string) => s === 'pending' ? 'bg-yellow-100 text-yellow-800' : s === 'in_progress' ? 'bg-blue-100 text-blue-800' : s === 'dispensed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
  const timeAgo = (ts: string) => { const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.round(m / 60) + 'h ago'; };

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Pharmacy</h1><p className="text-sm text-gray-500">Prescription dispensing queue</p></div>
        <button onClick={() => loadOrders(statusFilter === 'all' ? undefined : statusFilter)} className="px-3 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{pendingCount}</div></div>
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">In progress</div><div className="text-2xl font-bold text-blue-700">{inProgressCount}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Dispensed today</div><div className="text-2xl font-bold text-green-700">{dispensedCount}</div></div>
        <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total Rx today</div><div className="text-2xl font-bold text-purple-700">{orders.length}</div></div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">{[['pending','Pending'],['in_progress','In Progress'],['dispensed','Dispensed'],['all','All']].map(([k,l]) =>
        <button key={k} onClick={() => { setStatusFilter(k); loadOrders(k === 'all' ? undefined : k); }}
          className={`px-3 py-1.5 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
          {l} {k === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}</button>
      )}</div>

      <div className="flex gap-6">
        {/* Order List */}
        <div className="w-2/5">
          {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
          filteredOrders.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No orders in this queue</div> :
          <div className="space-y-2">{filteredOrders.map(o => (
            <div key={o.id} onClick={() => { setSelectedOrder(o); if (o.status === 'pending') startDispensing(o.id); }}
              className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-400 ${selectedOrder?.id === o.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{o.patientName}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${stColor(o.status)}`}>{o.status.replace('_', ' ')}</span>
              </div>
              <div className="text-xs text-gray-400">{o.patientUhid} | {timeAgo(o.createdAt)}</div>
              <div className="text-xs text-gray-500 mt-1">{o.prescriptions.length} items</div>
              {o.status === 'pending' && <div className="mt-1"><span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded animate-pulse">New Rx</span></div>}
            </div>
          ))}</div>}
        </div>

        {/* Dispensing Detail */}
        <div className="w-3/5">
          {!selectedOrder ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select an order to dispense</div> : (
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div><div className="font-semibold text-lg">{selectedOrder.patientName}</div>
                  <div className="text-xs text-gray-400">{selectedOrder.patientUhid} | {timeAgo(selectedOrder.createdAt)}</div></div>
                <span className={`px-3 py-1 rounded-full text-sm ${stColor(selectedOrder.status)}`}>{selectedOrder.status.replace('_', ' ')}</span>
              </div>

              {/* Prescription items */}
              <div className="space-y-2 mb-4">
                {dispensingItems.map((item, idx) => (
                  <div key={idx} className={`border rounded-lg p-3 ${item.dispensed ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={item.dispensed} onChange={e => {
                        const u = [...dispensingItems]; u[idx] = { ...u[idx], dispensed: e.target.checked }; setDispensingItems(u);
                      }} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.brand || item.generic} <span className="text-gray-400">{item.strength}</span></div>
                        <div className="text-xs text-gray-500">{item.generic} | {item.form} | {item.dose} {item.frequency} x {item.duration}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.instructions}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400">Qty:</label>
                          <input type="number" value={item.dispensedQty} onChange={e => {
                            const u = [...dispensingItems]; u[idx] = { ...u[idx], dispensedQty: parseInt(e.target.value) || 0 }; setDispensingItems(u);
                          }} className="w-14 px-2 py-1 border rounded text-sm text-right" min="0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-gray-400">MRP:</label>
                          <input type="number" value={item.unitPrice} onChange={e => {
                            const u = [...dispensingItems]; u[idx] = { ...u[idx], unitPrice: parseFloat(e.target.value) || 0 }; setDispensingItems(u);
                          }} className="w-20 px-2 py-1 border rounded text-sm text-right" min="0" step="0.5" />
                        </div>
                        <div className="text-xs font-medium mt-1 text-right">Rs.{(item.dispensedQty * item.unitPrice).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Items selected</span>
                  <span>{dispensingItems.filter(i => i.dispensed).length} of {dispensingItems.length}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold mt-1">
                  <span>Total</span>
                  <span>Rs.{dispensingItems.filter(i => i.dispensed).reduce((s: number, i: any) => s + i.dispensedQty * i.unitPrice, 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Actions */}
              {selectedOrder.status !== 'dispensed' ? (
                <div className="flex gap-2">
                  <button onClick={handleDispense} disabled={dispensingItems.filter(i => i.dispensed).length === 0}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                    Dispense & Generate Bill</button>
                  <button onClick={() => setSelectedOrder(null)} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg">Cancel</button>
                </div>
              ) : (
                <div className="text-center py-3 text-green-600 font-medium">
                  Dispensed {selectedOrder.dispensedAt ? 'at ' + new Date(selectedOrder.dispensedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
