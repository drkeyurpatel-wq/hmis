'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface LabOrder {
  id: string; encounterId: string; patientName: string; patientUhid: string;
  patientId: string; doctorName: string; investigations: any[];
  status: string; createdAt: string; results: any[];
}

export default function LabPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultEntries, setResultEntries] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [toast, setToast] = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Load lab orders from EMR encounters that have investigations
  const loadOrders = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_emr_encounters')
      .select(`id, encounter_date, investigations, diagnoses, status,
        patient:hmis_patients!inner(id, uhid, first_name, last_name),
        doctor:hmis_staff!inner(full_name)`)
      .eq('centre_id', centreId)
      .not('investigations', 'eq', '[]')
      .gte('encounter_date', today)
      .order('created_at', { ascending: false })
      .limit(100);

    const mapped = (data || []).map((e: any) => {
      const invs = e.investigations || [];
      const allDone = invs.every((i: any) => i.result && i.result.trim() !== '');
      const someResults = invs.some((i: any) => i.result && i.result.trim() !== '');
      let status = 'pending';
      if (allDone) status = 'completed';
      else if (someResults) status = 'partial';
      return {
        id: e.id, encounterId: e.id,
        patientName: e.patient.first_name + ' ' + (e.patient.last_name || ''),
        patientUhid: e.patient.uhid, patientId: e.patient.id,
        doctorName: e.doctor.full_name,
        investigations: invs, status, createdAt: e.encounter_date,
        results: invs.filter((i: any) => i.result),
      };
    });

    if (statusFilter === 'all') setOrders(mapped);
    else setOrders(mapped.filter((o: LabOrder) => o.status === statusFilter));
    setLoading(false);
  }, [centreId, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // When selecting order, prepare result entries
  useEffect(() => {
    if (selectedOrder) {
      setResultEntries(selectedOrder.investigations.map((inv: any, i: number) => ({
        ...inv, index: i,
        result: inv.result || '',
        normalRange: inv.normalRange || '',
        isAbnormal: inv.isAbnormal || false,
        unit: inv.unit || '',
        status: inv.result ? 'completed' : 'pending',
      })));
    }
  }, [selectedOrder]);

  // Save results back to encounter
  const saveResults = async () => {
    if (!selectedOrder || !sb()) return;
    const updatedInvs = resultEntries.map(r => ({
      name: r.name, urgency: r.urgency || 'routine',
      result: r.result, normalRange: r.normalRange,
      isAbnormal: r.isAbnormal, unit: r.unit,
    }));
    const { error } = await sb().from('hmis_emr_encounters')
      .update({ investigations: updatedInvs })
      .eq('id', selectedOrder.encounterId);
    if (!error) {
      flash('Results saved — visible to doctor in EMR');
      loadOrders();
      setSelectedOrder(null);
    } else {
      flash('Error saving results');
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const stColor = (s: string) => s === 'pending' ? 'bg-yellow-100 text-yellow-800' : s === 'partial' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  const urgColor = (u: string) => u === 'stat' ? 'text-red-600 font-bold' : u === 'urgent' ? 'text-orange-600' : 'text-gray-500';

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Laboratory</h1><p className="text-sm text-gray-500">Investigation orders from EMR encounters</p></div>
        <button onClick={loadOrders} className="px-3 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{pendingCount}</div></div>
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Partial results</div><div className="text-2xl font-bold text-blue-700">{orders.filter(o => o.status === 'partial').length}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Completed</div><div className="text-2xl font-bold text-green-700">{orders.filter(o => o.status === 'completed').length}</div></div>
        <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total tests today</div><div className="text-2xl font-bold text-purple-700">{orders.reduce((s, o) => s + o.investigations.length, 0)}</div></div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">{[['pending','Pending'],['partial','Partial'],['completed','Completed'],['all','All']].map(([k,l]) =>
        <button key={k} onClick={() => setStatusFilter(k)}
          className={`px-3 py-1.5 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
          {l} {k === 'pending' ? `(${pendingCount})` : ''}</button>
      )}</div>

      <div className="flex gap-6">
        {/* Order List */}
        <div className="w-2/5">
          {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
          orders.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No lab orders in this queue</div> :
          <div className="space-y-2">{orders.map(o => (
            <div key={o.id} onClick={() => setSelectedOrder(o)}
              className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-400 ${selectedOrder?.id === o.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{o.patientName}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${stColor(o.status)}`}>{o.status}</span>
              </div>
              <div className="text-xs text-gray-400">{o.patientUhid} | Dr. {o.doctorName}</div>
              <div className="text-xs text-gray-500 mt-1">{o.investigations.length} tests ordered</div>
              <div className="flex flex-wrap gap-1 mt-1">{o.investigations.slice(0, 4).map((inv: any, i: number) =>
                <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${inv.result ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{inv.name}</span>
              )}{o.investigations.length > 4 && <span className="text-xs text-gray-400">+{o.investigations.length - 4} more</span>}</div>
            </div>
          ))}</div>}
        </div>

        {/* Result Entry */}
        <div className="w-3/5">
          {!selectedOrder ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select an order to enter results</div> : (
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div><div className="font-semibold text-lg">{selectedOrder.patientName}</div>
                  <div className="text-xs text-gray-400">{selectedOrder.patientUhid} | Dr. {selectedOrder.doctorName} | {selectedOrder.createdAt}</div></div>
                <span className={`px-3 py-1 rounded-full text-sm ${stColor(selectedOrder.status)}`}>{selectedOrder.status}</span>
              </div>

              {/* Investigation items */}
              <div className="space-y-3 mb-4">
                {resultEntries.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{item.name}</div>
                      <span className={`text-xs ${urgColor(item.urgency)}`}>{item.urgency?.toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Result *</label>
                        <input type="text" value={item.result} onChange={e => {
                          const u = [...resultEntries]; u[idx] = { ...u[idx], result: e.target.value }; setResultEntries(u);
                        }} placeholder="Enter result..." className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Normal range</label>
                        <input type="text" value={item.normalRange} onChange={e => {
                          const u = [...resultEntries]; u[idx] = { ...u[idx], normalRange: e.target.value }; setResultEntries(u);
                        }} placeholder="e.g., 4.5-11.0" className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Unit</label>
                        <input type="text" value={item.unit} onChange={e => {
                          const u = [...resultEntries]; u[idx] = { ...u[idx], unit: e.target.value }; setResultEntries(u);
                        }} placeholder="e.g., mg/dL" className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={item.isAbnormal} onChange={e => {
                          const u = [...resultEntries]; u[idx] = { ...u[idx], isAbnormal: e.target.checked }; setResultEntries(u);
                        }} /><span className="text-red-500">Mark as abnormal</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t pt-3 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total tests</span><span>{resultEntries.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Results entered</span><span className="text-green-600">{resultEntries.filter(r => r.result.trim()).length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Abnormal</span><span className="text-red-600">{resultEntries.filter(r => r.isAbnormal).length}</span></div>
              </div>

              <div className="flex gap-2">
                <button onClick={saveResults} disabled={resultEntries.filter(r => r.result.trim()).length === 0}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  Save Results</button>
                <button onClick={() => setSelectedOrder(null)} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
