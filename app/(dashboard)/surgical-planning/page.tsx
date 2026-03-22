'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useSurgicalPlanning, type SurgicalPlanning, type ChecklistItem } from '@/lib/surgical-planning/surgical-planning-hooks';
import { sb } from '@/lib/supabase/browser';

const PRIORITY_COLORS: Record<string, string> = { routine: 'bg-blue-100 text-blue-700', urgent: 'bg-amber-100 text-amber-700', emergency: 'bg-red-100 text-red-700' };
const STATUS_COLORS: Record<string, string> = { planning: 'bg-amber-100 text-amber-700', ready: 'bg-green-100 text-green-700', blocked: 'bg-red-100 text-red-700', cancelled: 'bg-gray-200 text-gray-600', completed: 'bg-blue-100 text-blue-700' };
const ITEM_COLORS: Record<string, string> = { pending: 'bg-amber-400', in_progress: 'bg-amber-400', done: 'bg-green-500', waived: 'bg-green-400', blocked: 'bg-red-500' };
const TRAFFIC: Record<string, string> = { pending: '🟡', in_progress: '🟡', done: '🟢', waived: '🟢', blocked: '🔴' };
const CAT_LABELS: Record<string, string> = {
  pre_op_investigation: 'Pre-Op Investigations', anaesthesia_fitness: 'Anaesthesia Fitness',
  insurance_preauth: 'Insurance Pre-Auth', consent: 'Consent', blood_arrangement: 'Blood Arrangement',
  cssd_booking: 'CSSD Booking', ot_slot: 'OT Slot', bed_reservation: 'Bed Reservation', custom: 'Custom',
};

type Tab = 'overview' | 'create';

function Inner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const sp = useSurgicalPlanning(centreId);

  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [selected, setSelected] = useState<SurgicalPlanning | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Create form
  const [otBookings, setOtBookings] = useState<any[]>([]);
  const [cf, setCf] = useState({ ot_booking_id: '', patient_id: '', admission_id: '', surgeon_id: '', planned_date: '', procedure_name: '', priority: 'routine', notes: '' });

  // Staff list for assignment
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);

  // Add custom item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ item_name: '', is_mandatory: true, category: 'custom', assigned_to: '', due_date: '' });

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb()!.from('hmis_staff').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setStaffList(data || []));
  }, [centreId]);

  // Load pending OT bookings for create form
  const loadBookings = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb()!.from('hmis_ot_bookings')
      .select(`*, admission:hmis_admissions!inner(id, centre_id, patient_id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid)),
        surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name)`)
      .eq('admission.centre_id', centreId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });
    setOtBookings(data || []);
  }, [centreId]);

  const selectBooking = (b: any) => {
    setCf(prev => ({
      ...prev,
      ot_booking_id: b.id,
      patient_id: b.admission?.patient_id || '',
      admission_id: b.admission?.id || '',
      surgeon_id: b.surgeon_id || '',
      planned_date: b.scheduled_date || '',
      procedure_name: b.procedure_name || '',
    }));
  };

  const handleCreate = async () => {
    if (!cf.ot_booking_id || !cf.patient_id || !cf.planned_date || !cf.procedure_name) { flash('Fill all required fields'); return; }
    const plan = await sp.createCase({ ...cf, admission_id: cf.admission_id || undefined, surgeon_id: cf.surgeon_id || undefined, created_by: staffId });
    if (plan) { flash('Planning case created with default checklist'); setTab('overview'); sp.load(); setCf({ ot_booking_id: '', patient_id: '', admission_id: '', surgeon_id: '', planned_date: '', procedure_name: '', priority: 'routine', notes: '' }); }
    else flash('Error creating case');
  };

  // Detail view
  const openDetail = async (c: SurgicalPlanning) => {
    setSelected(c);
    setLoadingItems(true);
    const data = await sp.loadItems(c.id);
    setItems(data);
    setLoadingItems(false);
  };

  const handleItemStatusChange = async (itemId: string, status: string) => {
    await sp.updateItemStatus(itemId, status, staffId);
    if (selected) {
      await sp.recalcReadiness(selected.id);
      const data = await sp.loadItems(selected.id);
      setItems(data);
      sp.load();
    }
  };

  const handleAddCustomItem = async () => {
    if (!selected || !newItem.item_name) return;
    await sp.addCustomItem(selected.id, { ...newItem, assigned_to: newItem.assigned_to || undefined, due_date: newItem.due_date || undefined });
    await sp.recalcReadiness(selected.id);
    const data = await sp.loadItems(selected.id);
    setItems(data);
    setShowAddItem(false);
    setNewItem({ item_name: '', is_mandatory: true, category: 'custom', assigned_to: '', due_date: '' });
    flash('Item added');
  };

  const handleClear = async () => {
    if (!selected) return;
    const mandatory = items.filter(i => i.is_mandatory);
    const allGreen = mandatory.every(i => i.status === 'done' || i.status === 'waived');
    if (!allGreen) { flash('Cannot clear — mandatory items not complete'); return; }
    await sp.clearForSurgery(selected.id, staffId);
    flash('Cleared for surgery ✓');
    sp.load();
    setSelected(null);
  };

  // Filtered cases
  const filtered = useMemo(() => {
    let list = sp.cases;
    if (filterStatus !== 'all') list = list.filter(c => c.overall_status === filterStatus);
    if (filterDate) list = list.filter(c => c.planned_date === filterDate);
    return list;
  }, [sp.cases, filterStatus, filterDate]);

  // Group by category for detail view
  const groupedItems = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    items.forEach(i => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });
    return groups;
  }, [items]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Surgical Planning</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('overview')} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Overview</button>
          <button onClick={() => { setTab('create'); loadBookings(); }} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>+ New Case</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Cases', value: sp.stats.total, color: 'text-gray-900' },
          { label: 'Ready ✓', value: sp.stats.ready, color: 'text-green-600' },
          { label: 'In Planning', value: sp.stats.planning, color: 'text-amber-600' },
          { label: 'Blocked', value: sp.stats.blocked, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {tab === 'create' && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Planning Case from OT Booking</h2>
          {otBookings.length === 0 && <p className="text-gray-500 text-sm mb-4">No upcoming OT bookings found. Schedule an OT booking first.</p>}
          {otBookings.length > 0 && (
            <div className="mb-4 max-h-60 overflow-y-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0"><tr>
                  <th className="text-left p-2">Date</th><th className="text-left p-2">Patient</th><th className="text-left p-2">Procedure</th><th className="text-left p-2">Surgeon</th><th className="p-2">Select</th>
                </tr></thead>
                <tbody>
                  {otBookings.map(b => (
                    <tr key={b.id} className={`border-t hover:bg-blue-50 cursor-pointer ${cf.ot_booking_id === b.id ? 'bg-blue-50' : ''}`} onClick={() => selectBooking(b)}>
                      <td className="p-2">{b.scheduled_date}</td>
                      <td className="p-2">{b.admission?.patient?.first_name} {b.admission?.patient?.last_name} ({b.admission?.patient?.uhid})</td>
                      <td className="p-2">{b.procedure_name}</td>
                      <td className="p-2">{b.surgeon?.full_name || '-'}</td>
                      <td className="p-2 text-center">{cf.ot_booking_id === b.id ? '✓' : '○'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div><label className="text-xs text-gray-500">Procedure *</label><input className="w-full border rounded px-3 py-2 text-sm" value={cf.procedure_name} onChange={e => setCf(p => ({ ...p, procedure_name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Planned Date *</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={cf.planned_date} onChange={e => setCf(p => ({ ...p, planned_date: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Priority</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={cf.priority} onChange={e => setCf(p => ({ ...p, priority: e.target.value }))}>
                <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
              </select>
            </div>
          </div>
          <div className="mb-4"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={cf.notes} onChange={e => setCf(p => ({ ...p, notes: e.target.value }))} /></div>
          <button onClick={handleCreate} disabled={!cf.ot_booking_id} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">Create & Seed Checklist</button>
        </div>
      )}

      {tab === 'overview' && !selected && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <select className="border rounded px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option><option value="planning">Planning</option><option value="ready">Ready</option><option value="blocked">Blocked</option><option value="cancelled">Cancelled</option>
            </select>
            <input type="date" className="border rounded px-3 py-1.5 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            {filterDate && <button className="text-xs text-blue-600 underline" onClick={() => setFilterDate('')}>Clear date</button>}
          </div>
          {sp.loading ? <p className="text-gray-500 text-sm">Loading...</p> : filtered.length === 0 ? <p className="text-gray-500 text-sm">No surgical planning cases. Create one from an OT booking.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border rounded-lg">
                <thead className="bg-gray-50"><tr>
                  <th className="text-left p-3">Patient</th><th className="text-left p-3">Procedure</th><th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Surgeon</th><th className="text-center p-3">Priority</th><th className="text-center p-3">Readiness</th><th className="text-center p-3">Status</th>
                </tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c)}>
                      <td className="p-3 font-medium">{c.patient?.first_name} {c.patient?.last_name}<br /><span className="text-xs text-gray-400">{c.patient?.uhid}</span></td>
                      <td className="p-3">{c.procedure_name}</td>
                      <td className="p-3">{c.planned_date}</td>
                      <td className="p-3">{c.surgeon?.full_name || '-'}</td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[c.priority] || ''}`}>{c.priority}</span></td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${c.readiness_pct === 100 ? 'bg-green-500' : c.readiness_pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${c.readiness_pct}%` }} /></div>
                          <span className="text-xs font-medium">{c.readiness_pct}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.overall_status] || ''}`}>{c.overall_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detail View */}
      {tab === 'overview' && selected && (
        <div>
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600 mb-4 flex items-center gap-1">← Back to list</button>
          <div className="bg-white border rounded-lg p-6 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold">{selected.patient?.first_name} {selected.patient?.last_name} <span className="text-sm font-normal text-gray-400">{selected.patient?.uhid}</span></h2>
                <p className="text-gray-600">{selected.procedure_name}</p>
                <p className="text-sm text-gray-500">Planned: {selected.planned_date} · Surgeon: {selected.surgeon?.full_name || '-'} · OT: {selected.ot_booking?.ot_room?.name || '-'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded text-sm font-medium ${PRIORITY_COLORS[selected.priority]}`}>{selected.priority}</span>
                <span className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[selected.overall_status]}`}>{selected.overall_status}</span>
                <div className="text-center">
                  <div className="text-2xl font-bold">{selected.readiness_pct}%</div>
                  <div className="text-xs text-gray-400">Ready</div>
                </div>
              </div>
            </div>

            {/* Readiness bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
              <div className={`h-3 rounded-full transition-all ${selected.readiness_pct === 100 ? 'bg-green-500' : selected.readiness_pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${selected.readiness_pct}%` }} />
            </div>

            {loadingItems ? <p className="text-gray-400 text-sm">Loading checklist...</p> : (
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([cat, catItems]) => (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{CAT_LABELS[cat] || cat}</h3>
                    <div className="space-y-1">
                      {catItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 group">
                          <span className="text-lg">{TRAFFIC[item.status]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${item.status === 'done' || item.status === 'waived' ? 'line-through text-gray-400' : ''}`}>{item.item_name}</span>
                              {item.is_mandatory && <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded">REQ</span>}
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.assignee?.full_name && <span>Assigned: {item.assignee.full_name}</span>}
                              {item.due_date && <span> · Due: {item.due_date}</span>}
                              {item.actual_date && <span> · Done: {item.actual_date}</span>}
                              {item.remarks && <span> · {item.remarks}</span>}
                            </div>
                          </div>
                          <select className="border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity" value={item.status} onChange={e => handleItemStatusChange(item.id, e.target.value)}>
                            <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="done">Done</option><option value="waived">Waived</option><option value="blocked">Blocked</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowAddItem(true)} className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50">+ Add Item</button>
              <button onClick={handleClear} disabled={selected.overall_status === 'ready' || selected.overall_status === 'cancelled'} className="text-sm bg-green-600 text-white rounded px-4 py-1.5 font-medium disabled:opacity-50">Clear for Surgery ✓</button>
              <button onClick={async () => { const reason = prompt('Cancel reason?'); if (reason) { await sp.cancelCase(selected.id, reason); flash('Cancelled'); sp.load(); setSelected(null); } }} className="text-sm text-red-600 border border-red-200 rounded px-3 py-1.5">Cancel</button>
            </div>

            {/* Add custom item modal */}
            {showAddItem && (
              <div className="mt-4 p-4 border rounded bg-gray-50">
                <h4 className="text-sm font-semibold mb-2">Add Custom Checklist Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input className="border rounded px-2 py-1.5 text-sm" placeholder="Item name *" value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))} />
                  <select className="border rounded px-2 py-1.5 text-sm" value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                    {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select className="border rounded px-2 py-1.5 text-sm" value={newItem.assigned_to} onChange={e => setNewItem(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">Assign to...</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="date" className="border rounded px-2 py-1.5 text-sm" value={newItem.due_date} onChange={e => setNewItem(p => ({ ...p, due_date: e.target.value }))} />
                  <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={newItem.is_mandatory} onChange={e => setNewItem(p => ({ ...p, is_mandatory: e.target.checked }))} /> Mandatory</label>
                  <button onClick={handleAddCustomItem} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Add</button>
                  <button onClick={() => setShowAddItem(false)} className="text-sm text-gray-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurgicalPlanningPage() {
  return <RoleGuard module="ot"><Inner /></RoleGuard>;
}
