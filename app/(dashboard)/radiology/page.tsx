'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function RadiologyPageInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reportText, setReportText] = useState('');
  const [toast, setToast] = useState('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const loadOrders = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_emr_encounters')
      .select('id, encounter_date, investigations, patient:hmis_patients!inner(id, uhid, first_name, last_name), doctor:hmis_staff!inner(full_name)')
      .eq('centre_id', centreId).not('investigations', 'eq', '[]').gte('encounter_date', today)
      .order('created_at', { ascending: false }).limit(100);
    const radiologyKeywords = ['x-ray', 'xray', 'ct ', 'mri', 'usg', 'ultrasound', 'echo', 'doppler', 'mammography', 'dexa', 'cxr'];
    const mapped = (data || []).flatMap((e: any) => {
      const invs = (e.investigations || []).filter((i: any) => radiologyKeywords.some(k => i.name?.toLowerCase().includes(k)));
      return invs.map((inv: any) => ({
        encounterId: e.id, patientName: e.patient.first_name + ' ' + (e.patient.last_name || ''),
        patientUhid: e.patient.uhid, doctorName: e.doctor.full_name,
        testName: inv.name, urgency: inv.urgency || 'routine',
        result: inv.result || '', isAbnormal: inv.isAbnormal || false,
        status: inv.result ? 'completed' : 'pending', date: e.encounter_date, _inv: inv, _allInvs: e.investigations,
      }));
    });
    setOrders(statusFilter === 'all' ? mapped : mapped.filter((o: any) => o.status === statusFilter));
    setLoading(false);
  }, [centreId, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const saveReport = async () => {
    if (!selectedOrder || !sb()) return;
    const updatedInvs = selectedOrder._allInvs.map((i: any) => i.name === selectedOrder.testName ? { ...i, result: reportText, isAbnormal: selectedOrder.isAbnormal } : i);
    await sb().from('hmis_emr_encounters').update({ investigations: updatedInvs }).eq('id', selectedOrder.encounterId);
    flash('Report saved'); setSelectedOrder(null); setReportText(''); loadOrders();
  };

  const pending = orders.filter(o => o.status === 'pending').length;
  const stColor = (s: string) => s === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  const urgColor = (u: string) => u === 'stat' ? 'text-red-600 font-bold' : u === 'urgent' ? 'text-orange-600' : 'text-gray-500';

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Radiology</h1><p className="text-sm text-gray-500">Imaging orders and reporting</p></div>
        <button onClick={loadOrders} className="px-3 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{pending}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Reported</div><div className="text-2xl font-bold text-green-700">{orders.filter(o => o.status === 'completed').length}</div></div>
        <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total today</div><div className="text-2xl font-bold">{orders.length}</div></div>
      </div>

      <div className="flex gap-2 mb-4">{[['pending','Pending'],['completed','Reported'],['all','All']].map(([k,l]) =>
        <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l} {k==='pending'?`(${pending})`:''}</button>
      )}</div>

      <div className="flex gap-6">
        <div className="w-2/5">
          {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
          orders.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No radiology orders</div> :
          <div className="space-y-2">{orders.map((o, i) => (
            <div key={i} onClick={() => { setSelectedOrder(o); setReportText(o.result); }}
              className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-400 ${selectedOrder?.encounterId === o.encounterId && selectedOrder?.testName === o.testName ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between"><span className="font-medium text-sm">{o.testName}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${stColor(o.status)}`}>{o.status}</span></div>
              <div className="text-xs text-gray-500">{o.patientName} — {o.patientUhid}</div>
              <div className="text-xs text-gray-400">Dr. {o.doctorName} | <span className={urgColor(o.urgency)}>{o.urgency.toUpperCase()}</span></div>
            </div>
          ))}</div>}
        </div>
        <div className="w-3/5">
          {!selectedOrder ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select an order to enter report</div> : (
            <div className="bg-white rounded-xl border p-5">
              <div className="mb-4"><div className="font-semibold text-lg">{selectedOrder.testName}</div>
                <div className="text-xs text-gray-400">{selectedOrder.patientName} — {selectedOrder.patientUhid} | Dr. {selectedOrder.doctorName}</div></div>
              <div className="mb-4"><label className="text-xs text-gray-500 mb-1 block">Report / Findings *</label>
                <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={8} placeholder="Enter radiology findings..." className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <label className="flex items-center gap-1.5 text-xs mb-4"><input type="checkbox" checked={selectedOrder.isAbnormal} onChange={e => setSelectedOrder({...selectedOrder, isAbnormal: e.target.checked})} /><span className="text-red-500">Mark as abnormal</span></label>
              <div className="flex gap-2"><button onClick={saveReport} disabled={!reportText.trim()} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">Save Report</button>
                <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RadiologyPage() { return <RoleGuard module="radiology"><RadiologyPageInner /></RoleGuard>; }
