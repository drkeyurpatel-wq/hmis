'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useAmbulances } from '@/lib/ambulance/ambulance-hooks';
import { Plus, X, Search, Truck, Phone, MapPin, Clock, ChevronRight } from 'lucide-react';

type Tab = 'fleet' | 'dispatch' | 'history';
const STATUS_BADGE: Record<string, string> = { requested: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', dispatched: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', en_route: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', arrived: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', patient_loaded: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', returning: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', completed: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' };
const VEHICLE_STATUS: Record<string, { bg: string; border: string; text: string }> = {
  available: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  on_trip: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  maintenance: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  out_of_service: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' },
};
const TYPE_LABELS: Record<string, string> = { als: 'ALS', bls: 'BLS', patient_transport: 'PT', neonatal: 'Neo', mortuary: 'Mort' };

function AmbulanceInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const amb = useAmbulances(centreId);
  const [tab, setTab] = useState<Tab>('dispatch');
  const [showNew, setShowNew] = useState(false);
  const [showDispatch, setShowDispatch] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [form, setForm] = useState({ request_type: 'emergency_pickup', priority: 'urgent', patient_name: '', patient_phone: '', patient_condition: 'stable', pickup_location: '', pickup_landmark: '', drop_location: 'Hospital (default)', drop_landmark: '' });

  const handleCreate = async () => {
    if (!form.pickup_location || !form.patient_name) return;
    const res = await amb.createRequest(form, staffId);
    if (res.success) { flash('Transport request created'); setShowNew(false); setForm({ request_type: 'emergency_pickup', priority: 'urgent', patient_name: '', patient_phone: '', patient_condition: 'stable', pickup_location: '', pickup_landmark: '', drop_location: 'Hospital (default)', drop_landmark: '' }); } else { flash(res.error || 'Operation failed'); }
  };

  const activeRequests = amb.requests.filter(r => !['completed', 'cancelled'].includes(r.status));
  const completedRequests = amb.requests.filter(r => r.status === 'completed');

  const timeAgo = (d: string) => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`; };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Ambulance & Transport</h1><p className="text-xs text-gray-400">{amb.stats.totalVehicles} vehicles · {amb.stats.todayRequests} trips today</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold hover:bg-red-700"><Plus size={15} /> New Request</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Available', v: amb.stats.available, c: 'text-emerald-700' },
          { l: 'On Trip', v: amb.stats.onTrip, c: 'text-amber-700' },
          { l: 'Maintenance', v: amb.stats.maintenance, c: 'text-red-600' },
          { l: 'Active Requests', v: amb.stats.activeRequests, c: amb.stats.activeRequests > 0 ? 'text-blue-700' : 'text-gray-400' },
          { l: 'Completed', v: amb.stats.completedToday, c: 'text-emerald-700' },
          { l: 'Avg Response', v: amb.stats.avgResponseMin ? `${amb.stats.avgResponseMin}m` : '—', c: 'text-teal-700' },
          { l: 'Emergency', v: amb.stats.emergency, c: amb.stats.emergency > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex gap-1">{(['dispatch', 'fleet', 'history'] as Tab[]).map(t => (
        <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t === 'dispatch' ? 'Active Dispatch' : t}</button>
      ))}</div>

      {/* FLEET */}
      {tab === 'fleet' && (
        <div className="grid grid-cols-4 gap-3">
          {amb.vehicles.map(v => {
            const vs = VEHICLE_STATUS[v.status] || VEHICLE_STATUS.available;
            return (
              <div key={v.id} className={`rounded-2xl border-2 ${vs.border} ${vs.bg} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-black text-gray-800">{v.vehicle_number}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.status === 'available' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : v.status === 'on_trip' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700'} uppercase font-bold`}>{TYPE_LABELS[v.type] || v.type}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  {v.driver_name && <div className="flex items-center gap-1.5"><Truck size={11} />{v.driver_name}</div>}
                  {v.driver_phone && <div className="flex items-center gap-1.5"><Phone size={11} />{v.driver_phone}</div>}
                  {v.make && <div className="text-[10px] text-gray-400">{v.make} {v.model} {v.year || ''}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${vs.text === 'text-emerald-700' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : vs.text === 'text-amber-700' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700'} capitalize`}>{v.status.replace('_', ' ')}</span>
                  {v.fuel_level && <span className="text-[9px] text-gray-400">Fuel: {v.fuel_level}</span>}
                </div>
              </div>
            );
          })}
          {amb.vehicles.length === 0 && <div className="col-span-4 text-center py-12 bg-white rounded-2xl border text-gray-400">No vehicles configured</div>}
        </div>
      )}

      {/* ACTIVE DISPATCH */}
      {tab === 'dispatch' && (
        <div className="space-y-3">
          {activeRequests.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border text-gray-400">No active transport requests</div> :
          activeRequests.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${r.priority === 'emergency' ? 'border-red-200 bg-red-50/30' : ''}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${r.priority === 'emergency' ? 'bg-red-100' : 'bg-teal-100'}`}>
                <Truck size={20} className={r.priority === 'emergency' ? 'text-red-600' : 'text-teal-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-sm">{r.patient_name || r.patient?.first_name + ' ' + r.patient?.last_name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.priority === 'emergency' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : r.priority === 'urgent' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} uppercase text-[8px]`}>{r.priority}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 text-[8px] capitalize">{r.request_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500"><MapPin size={10} />{r.pickup_location} → {r.drop_location}</div>
                {r.ambulance?.vehicle_number && <div className="text-[10px] text-teal-600 font-medium mt-0.5"> {r.ambulance.vehicle_number} · {r.driver_name || ''}</div>}
                <div className="text-[9px] text-gray-400 mt-0.5">{r.request_number} · {timeAgo(r.requested_at)}</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[r.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{r.status.replace('_', ' ')}</span>
                <div className="flex gap-1">
                  {r.status === 'requested' && (
                    <button onClick={() => setShowDispatch(r.id)} className="px-3 py-1.5 bg-teal-600 text-white text-[10px] rounded-lg font-semibold hover:bg-teal-700">Dispatch</button>
                  )}
                  {r.status === 'dispatched' && <button onClick={() => amb.updateRequestStatus(r.id, 'en_route')} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 text-[10px] rounded-lg font-medium">En Route</button>}
                  {r.status === 'en_route' && <button onClick={() => amb.updateRequestStatus(r.id, 'arrived')} className="px-2.5 py-1.5 bg-purple-50 text-purple-700 text-[10px] rounded-lg font-medium">Arrived</button>}
                  {r.status === 'arrived' && <button onClick={() => amb.updateRequestStatus(r.id, 'patient_loaded')} className="px-2.5 py-1.5 bg-purple-50 text-purple-700 text-[10px] rounded-lg font-medium">Loaded</button>}
                  {['patient_loaded', 'returning'].includes(r.status) && <button onClick={() => amb.updateRequestStatus(r.id, 'completed')} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Complete</button>}
                  {!['completed', 'cancelled'].includes(r.status) && <button onClick={() => amb.updateRequestStatus(r.id, 'cancelled', { cancellation_reason: 'Cancelled' })} className="px-2 py-1.5 text-red-500 text-[10px] hover:bg-red-50 rounded-lg">Cancel</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr><th>Req#</th><th>Type</th><th>Patient</th><th>Route</th><th>Vehicle</th><th>Response</th><th>Total Time</th><th>Status</th></tr></thead>
            <tbody>{completedRequests.map(r => (
              <tr key={r.id}>
                <td className="font-mono text-[10px]">{r.request_number}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.priority === 'emergency' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize text-[8px]`}>{r.request_type?.replace(/_/g, ' ')}</span></td>
                <td className="font-semibold text-[11px]">{r.patient_name || (r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '—')}</td>
                <td className="text-[10px] text-gray-500 max-w-[200px] truncate">{r.pickup_location} → {r.drop_location}</td>
                <td className="text-[11px] font-medium">{r.ambulance?.vehicle_number || '—'}</td>
                <td className="text-[11px]">{r.response_time_min ? `${r.response_time_min}m` : '—'}</td>
                <td className="text-[11px]">{r.total_trip_time_min ? `${r.total_trip_time_min}m` : '—'}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
              </tr>
            ))}{completedRequests.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No completed trips</td></tr>}</tbody>
          </table>
        </div>
      )}

      {/* NEW REQUEST MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Transport Request</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.request_type} onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))}>{['emergency_pickup', 'inter_hospital_transfer', 'discharge', 'dialysis_shuttle', 'opd_pickup', 'dead_body'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Priority</label><div className="flex gap-1 mt-1">{['emergency', 'urgent', 'routine'].map(p => <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.priority === p ? (p === 'emergency' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{p}</button>)}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Patient Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Phone</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.patient_phone} onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))} /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Pickup Location *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.pickup_location} onChange={e => setForm(f => ({ ...f, pickup_location: e.target.value }))} placeholder="Full address" /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Drop Location</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.drop_location} onChange={e => setForm(f => ({ ...f, drop_location: e.target.value }))} /></div>
            </div>
            <button onClick={handleCreate} disabled={!form.patient_name || !form.pickup_location} className="w-full py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-red-700">Create Request</button>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL */}
      {showDispatch && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDispatch(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Assign Ambulance</h2>
            <div className="space-y-2">
              {amb.vehicles.filter(v => v.status === 'available').map(v => (
                <button key={v.id} onClick={() => { amb.dispatch(showDispatch, v.id); setShowDispatch(null); flash(`${v.vehicle_number} dispatched`); }}
                  className="w-full flex items-center gap-3 p-3 border rounded-xl hover:bg-teal-50 hover:border-teal-200 transition-colors text-left">
                  <Truck size={18} className="text-emerald-600" />
                  <div><div className="font-bold text-sm">{v.vehicle_number}</div><div className="text-[10px] text-gray-400">{TYPE_LABELS[v.type]} · {v.driver_name || 'No driver'} · {v.driver_phone || ''}</div></div>
                </button>
              ))}
              {amb.vehicles.filter(v => v.status === 'available').length === 0 && <div className="text-center py-4 text-gray-400 text-sm">No ambulances available</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function AmbulancePage() { return <RoleGuard module="opd"><AmbulanceInner /></RoleGuard>; }
