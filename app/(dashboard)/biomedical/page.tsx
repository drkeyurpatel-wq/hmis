'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { sb } from '@/lib/supabase/browser';
import {
  useEquipment, useMaintenance, usePMSchedule,
  type Equipment, type MaintenanceTicket, type PMSchedule,
} from '@/lib/biomedical/biomedical-hooks';
import { fmtINR } from '@/lib/utils/format';
type Tab = 'equipment' | 'maintenance' | 'pm' | 'analytics';
const CATEGORIES = ['imaging', 'laboratory', 'icu', 'ot', 'monitoring', 'sterilization', 'dental', 'ophthalmic', 'physiotherapy', 'general'];
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', maintenance: 'bg-amber-100 text-amber-700',
  condemned: 'bg-gray-200 text-gray-600', out_of_order: 'bg-red-100 text-red-700',
  open: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', pending_parts: 'bg-amber-100 text-amber-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white', high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600',
};

function BiomedicalInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('equipment');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const eq = useEquipment(centreId);
  const mt = useMaintenance(centreId);
  const pm = usePMSchedule(centreId);

  // Equipment form
  const [showAdd, setShowAdd] = useState(false);
  const [eqForm, setEqForm] = useState({ name: '', category: 'general', brand: '', model: '', serial_number: '', location: '', department: '', purchase_date: '', purchase_cost: '', warranty_expiry: '', amc_vendor: '', amc_expiry: '', amc_cost: '', criticality: 'medium', notes: '' });

  // Maintenance form
  const [showMtAdd, setShowMtAdd] = useState(false);
  const [mtForm, setMtForm] = useState({ equipmentId: '', type: 'breakdown', issueDescription: '', priority: 'medium', assignedTo: '' });
  const [mtFilter, setMtFilter] = useState('all');

  // PM form
  const [showPmAdd, setShowPmAdd] = useState(false);
  const [pmForm, setPmForm] = useState({ equipmentId: '', frequency: 'monthly', checklist: '', nextDue: '', assignedTo: '' });

  // Equipment filter
  const [eqFilter, setEqFilter] = useState('all');
  const [eqSearch, setEqSearch] = useState('');

  const filteredEq = eq.equipment.filter(e =>
    (eqFilter === 'all' || e.status === eqFilter || e.category === eqFilter) &&
    (!eqSearch || e.name.toLowerCase().includes(eqSearch.toLowerCase()) || (e.serial_number || '').toLowerCase().includes(eqSearch.toLowerCase()))
  );

  const filteredMt = mtFilter === 'all' ? mt.tickets : mt.tickets.filter(t => t.status === mtFilter);

  const addEquipment = async () => {
    if (!eqForm.name) { flash('Name required'); return; }
    await eq.addEquipment({
      name: eqForm.name, category: eqForm.category, brand: eqForm.brand, model: eqForm.model,
      serial_number: eqForm.serial_number, location: eqForm.location, department: eqForm.department,
      purchase_date: eqForm.purchase_date || null, purchase_cost: eqForm.purchase_cost ? parseFloat(eqForm.purchase_cost) : null,
      warranty_expiry: eqForm.warranty_expiry || null, amc_vendor: eqForm.amc_vendor, amc_expiry: eqForm.amc_expiry || null,
      amc_cost: eqForm.amc_cost ? parseFloat(eqForm.amc_cost) : null, criticality: eqForm.criticality, notes: eqForm.notes,
    } as any);
    setEqForm({ name: '', category: 'general', brand: '', model: '', serial_number: '', location: '', department: '', purchase_date: '', purchase_cost: '', warranty_expiry: '', amc_vendor: '', amc_expiry: '', amc_cost: '', criticality: 'medium', notes: '' });
    setShowAdd(false); flash('Equipment added');
  };

  const addTicket = async () => {
    if (!mtForm.equipmentId || !mtForm.issueDescription) { flash('Select equipment and describe issue'); return; }
    await mt.createTicket({ equipmentId: mtForm.equipmentId, type: mtForm.type, issueDescription: mtForm.issueDescription, priority: mtForm.priority, assignedTo: mtForm.assignedTo, staffId });
    setMtForm({ equipmentId: '', type: 'breakdown', issueDescription: '', priority: 'medium', assignedTo: '' });
    setShowMtAdd(false); flash('Maintenance ticket created');
  };

  const addPM = async () => {
    if (!pmForm.equipmentId || !pmForm.nextDue) { flash('Select equipment and due date'); return; }
    const checklist = pmForm.checklist.split('\n').filter(Boolean).map(item => ({ item: item.trim(), done: false }));
    await pm.addSchedule({ equipmentId: pmForm.equipmentId, frequency: pmForm.frequency, checklist, nextDue: pmForm.nextDue, assignedTo: pmForm.assignedTo });
    setPmForm({ equipmentId: '', frequency: 'monthly', checklist: '', nextDue: '', assignedTo: '' });
    setShowPmAdd(false); flash('PM schedule added');
  };

  const [today, setToday] = useState(""); useEffect(() => { setToday(new Date().toISOString().split("T")[0]); }, []);

  return (
    <div className="overflow-x-auto max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Biomedical Engineering</h1><p className="text-xs text-gray-500">Equipment, maintenance & preventive schedules</p></div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-teal-700">{eq.stats.total}</div><div className="text-[10px] text-gray-500">Total Equipment</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-amber-600">{eq.stats.maintenance + eq.stats.outOfOrder}</div><div className="text-[10px] text-gray-500">Under Maintenance</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-red-600">{pm.stats.overdue}</div><div className="text-[10px] text-gray-500">Overdue PMs</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-blue-600">{mt.stats.avgDowntime.toFixed(1)}h</div><div className="text-[10px] text-gray-500">Avg Downtime</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['equipment', 'Equipment Registry'], ['maintenance', 'Maintenance Log'], ['pm', 'PM Schedule'], ['analytics', 'Analytics']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-xs font-medium rounded-lg ${tab === k ? 'bg-white shadow text-teal-700' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {/* ===== EQUIPMENT REGISTRY ===== */}
      {tab === 'equipment' && <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input type="text" value={eqSearch} onChange={e => setEqSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm flex-1" placeholder="Search equipment..." />
          <select value={eqFilter} onChange={e => setEqFilter(e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs">
            <option value="all">All Status</option>
            <option value="active">Active</option><option value="maintenance">Maintenance</option>
            <option value="out_of_order">Out of Order</option><option value="condemned">Condemned</option>
          </select>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{showAdd ? 'Cancel' : '+ Add Equipment'}</button>
        </div>

        {showAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">Add Equipment</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2"><input value={eqForm.name} onChange={e => setEqForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Equipment name *" /></div>
            <select value={eqForm.category} onChange={e => setEqForm(f => ({ ...f, category: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={eqForm.criticality} onChange={e => setEqForm(f => ({ ...f, criticality: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="high">High Criticality</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <input value={eqForm.brand} onChange={e => setEqForm(f => ({ ...f, brand: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Brand" />
            <input value={eqForm.model} onChange={e => setEqForm(f => ({ ...f, model: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Model" />
            <input value={eqForm.serial_number} onChange={e => setEqForm(f => ({ ...f, serial_number: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Serial Number" />
            <input value={eqForm.location} onChange={e => setEqForm(f => ({ ...f, location: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Location" />
            <input value={eqForm.department} onChange={e => setEqForm(f => ({ ...f, department: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Department" />
            <div><label className="text-[9px] text-gray-500">Purchase Date</label><input type="date" value={eqForm.purchase_date} onChange={e => setEqForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full px-2 py-1.5 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Purchase Cost</label><input type="number" value={eqForm.purchase_cost} onChange={e => setEqForm(f => ({ ...f, purchase_cost: e.target.value }))} className="w-full px-2 py-1.5 border rounded-lg text-sm" placeholder="₹" /></div>
            <div><label className="text-[9px] text-gray-500">Warranty Expiry</label><input type="date" value={eqForm.warranty_expiry} onChange={e => setEqForm(f => ({ ...f, warranty_expiry: e.target.value }))} className="w-full px-2 py-1.5 border rounded-lg text-sm" /></div>
            <input value={eqForm.amc_vendor} onChange={e => setEqForm(f => ({ ...f, amc_vendor: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="AMC Vendor" />
            <div><label className="text-[9px] text-gray-500">AMC Expiry</label><input type="date" value={eqForm.amc_expiry} onChange={e => setEqForm(f => ({ ...f, amc_expiry: e.target.value }))} className="w-full px-2 py-1.5 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">AMC Cost/yr</label><input type="number" value={eqForm.amc_cost} onChange={e => setEqForm(f => ({ ...f, amc_cost: e.target.value }))} className="w-full px-2 py-1.5 border rounded-lg text-sm" placeholder="₹" /></div>
          </div>
          <button onClick={addEquipment} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg">Save Equipment</button>
        </div>}

        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Equipment</th><th className="p-2">Category</th><th className="p-2">Location</th>
              <th className="p-2">Serial #</th><th className="p-2">AMC</th><th className="p-2">Next PM</th>
              <th className="p-2">Status</th><th className="p-2">Criticality</th>
            </tr></thead>
            <tbody>{filteredEq.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-2"><div className="font-medium">{e.name}</div><div className="text-[10px] text-gray-400">{e.brand} {e.model}</div></td>
                <td className="p-2 text-center capitalize">{e.category}</td>
                <td className="p-2 text-center text-gray-500">{e.location || '—'}</td>
                <td className="p-2 text-center font-mono text-gray-500">{e.serial_number || '—'}</td>
                <td className="p-2 text-center">{e.amc_expiry ? <span className={e.amc_expiry < today ? 'text-red-600 font-medium' : ''}>{new Date(e.amc_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span> : '—'}</td>
                <td className="p-2 text-center">{e.next_pm_date ? <span className={e.next_pm_date < today ? 'text-red-600 font-bold' : e.next_pm_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] ? 'text-amber-600 font-medium' : 'text-green-600'}>{new Date(e.next_pm_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span> : '—'}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[e.status]}`}>{e.status.replace('_', ' ')}</span></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${e.criticality === 'high' ? 'bg-red-100 text-red-700' : e.criticality === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{e.criticality}</span></td>
              </tr>
            ))}</tbody>
          </table>
          {filteredEq.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{eq.loading ? 'Loading...' : 'No equipment found'}</div>}
        </div>
      </div>}

      {/* ===== MAINTENANCE LOG ===== */}
      {tab === 'maintenance' && <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {['all', 'open', 'in_progress', 'pending_parts', 'completed'].map(s => (
              <button key={s} onClick={() => { setMtFilter(s); mt.load(s); }} className={`px-2 py-1 text-[10px] rounded-lg border ${mtFilter === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}>{s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s === 'pending_parts' ? 'Parts' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowMtAdd(!showMtAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{showMtAdd ? 'Cancel' : '+ Log Maintenance'}</button>
        </div>

        {showMtAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">New Maintenance Ticket</h3>
          <div className="grid grid-cols-4 gap-2">
            <select value={mtForm.equipmentId} onChange={e => setMtForm(f => ({ ...f, equipmentId: e.target.value }))} className="col-span-2 px-3 py-2 border rounded-lg text-sm">
              <option value="">Select Equipment *</option>
              {eq.equipment.map(e => <option key={e.id} value={e.id}>{e.name} ({e.serial_number || e.category})</option>)}
            </select>
            <select value={mtForm.type} onChange={e => setMtForm(f => ({ ...f, type: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="breakdown">Breakdown</option><option value="preventive">Preventive</option><option value="calibration">Calibration</option>
            </select>
            <select value={mtForm.priority} onChange={e => setMtForm(f => ({ ...f, priority: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <textarea value={mtForm.issueDescription} onChange={e => setMtForm(f => ({ ...f, issueDescription: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Describe the issue *" />
          <input value={mtForm.assignedTo} onChange={e => setMtForm(f => ({ ...f, assignedTo: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Assigned to (engineer name)" />
          <button onClick={addTicket} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg">Create Ticket</button>
        </div>}

        {/* Kanban-style columns */}
        <div className="grid grid-cols-4 gap-3">
          {(['open', 'in_progress', 'pending_parts', 'completed'] as const).map(status => {
            const col = filteredMt.filter(t => t.status === status);
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-red-500' : status === 'in_progress' ? 'bg-blue-500' : status === 'pending_parts' ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <span className="text-xs font-bold text-gray-600">{status === 'in_progress' ? 'In Progress' : status === 'pending_parts' ? 'Pending Parts' : status.charAt(0).toUpperCase() + status.slice(1)} ({col.length})</span>
                </div>
                {col.slice(0, 10).map(t => (
                  <div key={t.id} className="bg-white rounded-xl border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{t.equipment?.name || 'Unknown'}</span>
                      <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 line-clamp-2">{t.issue_description}</div>
                    <div className="text-[10px] text-gray-400">{t.type} · {t.assigned_to || 'Unassigned'}</div>
                    <div className="text-[10px] text-gray-400">{new Date(t.reported_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    {status !== 'completed' && <div className="flex gap-1 pt-1">
                      {status === 'open' && <button onClick={() => mt.updateTicket(t.id, { status: 'in_progress' })} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] rounded">Start</button>}
                      {status === 'in_progress' && <>
                        <button onClick={() => mt.updateTicket(t.id, { status: 'completed' })} className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] rounded">Complete</button>
                        <button onClick={() => mt.updateTicket(t.id, { status: 'pending_parts' })} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded">Parts</button>
                      </>}
                      {status === 'pending_parts' && <button onClick={() => mt.updateTicket(t.id, { status: 'in_progress' })} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] rounded">Resume</button>}
                    </div>}
                    {t.downtime_hours > 0 && <div className="text-[9px] text-gray-400">Downtime: {t.downtime_hours}h</div>}
                  </div>
                ))}
                {col.length === 0 && <div className="bg-gray-50 rounded-xl border border-dashed p-4 text-center text-[10px] text-gray-400">No tickets</div>}
              </div>
            );
          })}
        </div>
      </div>}

      {/* ===== PM SCHEDULE ===== */}
      {tab === 'pm' && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs">
            <span className="text-red-600 font-medium">● {pm.stats.overdue} Overdue</span>
            <span className="text-amber-600 font-medium">● {pm.stats.dueThisWeek} Due This Week</span>
            <span className="text-green-600 font-medium">● {pm.stats.completed} Done Today</span>
          </div>
          <button onClick={() => setShowPmAdd(!showPmAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{showPmAdd ? 'Cancel' : '+ Add PM Schedule'}</button>
        </div>

        {showPmAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">New PM Schedule</h3>
          <div className="grid grid-cols-4 gap-2">
            <select value={pmForm.equipmentId} onChange={e => setPmForm(f => ({ ...f, equipmentId: e.target.value }))} className="col-span-2 px-3 py-2 border rounded-lg text-sm">
              <option value="">Select Equipment *</option>
              {eq.equipment.map(e => <option key={e.id} value={e.id}>{e.name} ({e.serial_number || e.category})</option>)}
            </select>
            <select value={pmForm.frequency} onChange={e => setPmForm(f => ({ ...f, frequency: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
            </select>
            <input type="date" value={pmForm.nextDue} onChange={e => setPmForm(f => ({ ...f, nextDue: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm" />
          </div>
          <input value={pmForm.assignedTo} onChange={e => setPmForm(f => ({ ...f, assignedTo: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Assigned to" />
          <textarea value={pmForm.checklist} onChange={e => setPmForm(f => ({ ...f, checklist: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} placeholder="Checklist items (one per line)&#10;Visual inspection&#10;Electrical safety check&#10;Calibration verification" />
          <button onClick={addPM} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg">Save Schedule</button>
        </div>}

        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Equipment</th><th className="p-2">Frequency</th><th className="p-2">Last Done</th>
              <th className="p-2">Next Due</th><th className="p-2">Assigned</th><th className="p-2">Status</th><th className="p-2">Action</th>
            </tr></thead>
            <tbody>{pm.schedules.map(s => {
              const overdue = s.next_due && s.next_due < today;
              const dueSoon = s.next_due && !overdue && s.next_due <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
              return (
                <tr key={s.id} className={`border-b ${overdue ? 'bg-red-50' : dueSoon ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <td className="p-2"><div className="font-medium">{s.equipment?.name}</div><div className="text-[10px] text-gray-400">{s.equipment?.location}</div></td>
                  <td className="p-2 text-center capitalize">{s.frequency}</td>
                  <td className="p-2 text-center text-gray-500">{s.last_done ? new Date(s.last_done).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}</td>
                  <td className="p-2 text-center"><span className={`font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-green-600'}`}>{s.next_due ? new Date(s.next_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span></td>
                  <td className="p-2 text-center text-gray-500">{s.assigned_to || '—'}</td>
                  <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${overdue ? 'bg-red-100 text-red-700' : dueSoon ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{overdue ? 'OVERDUE' : dueSoon ? 'Due Soon' : 'On Track'}</span></td>
                  <td className="p-2 text-center"><button onClick={() => { pm.completePM(s.id); flash('PM marked complete'); }} className="px-2 py-1 bg-green-600 text-white text-[9px] rounded">Mark Done</button></td>
                </tr>
              );
            })}</tbody>
          </table>
          {pm.schedules.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{pm.loading ? 'Loading...' : 'No PM schedules. Add one above.'}</div>}
        </div>
      </div>}

      {/* ===== ANALYTICS ===== */}
      {tab === 'analytics' && <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Equipment by Status */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-bold text-sm mb-3">Equipment by Status</h3>
            <div className="space-y-2">
              {[['Active', eq.stats.active, 'bg-green-500'], ['Maintenance', eq.stats.maintenance, 'bg-amber-500'], ['Out of Order', eq.stats.outOfOrder, 'bg-red-500'], ['Condemned', eq.stats.condemned, 'bg-gray-400']].map(([label, count, color]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-xs flex-1">{label}</span>
                  <span className="text-xs font-bold">{count as number}</span>
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${eq.stats.total > 0 ? ((count as number) / eq.stats.total * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Summary */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-bold text-sm mb-3">Maintenance Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Open Tickets</span><span className="font-bold text-red-600">{mt.stats.open}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">In Progress</span><span className="font-bold text-blue-600">{mt.stats.inProgress}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pending Parts</span><span className="font-bold text-amber-600">{mt.stats.pendingParts}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-bold text-green-600">{mt.stats.completed}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-gray-500">Active Breakdowns</span><span className="font-bold text-red-600">{mt.stats.breakdowns}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Maintenance Cost</span><span className="font-bold">{fmtINR(mt.stats.totalCost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg Downtime</span><span className="font-bold">{mt.stats.avgDowntime.toFixed(1)} hrs</span></div>
            </div>
          </div>

          {/* AMC & Warranty Alerts */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-bold text-sm mb-3">AMC & Warranty Alerts</h3>
            <div className="space-y-1.5">
              {eq.equipment.filter(e => (e.amc_expiry && e.amc_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]) || (e.warranty_expiry && e.warranty_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])).slice(0, 8).map(e => (
                <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="font-medium">{e.name}</span>
                  <div className="text-right">
                    {e.amc_expiry && e.amc_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] && <div className={`text-[9px] ${e.amc_expiry < today ? 'text-red-600 font-bold' : 'text-amber-600'}`}>AMC: {new Date(e.amc_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>}
                    {e.warranty_expiry && e.warranty_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] && <div className={`text-[9px] ${e.warranty_expiry < today ? 'text-red-600 font-bold' : 'text-amber-600'}`}>Warranty: {new Date(e.warranty_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>}
                  </div>
                </div>
              ))}
              {eq.equipment.filter(e => e.amc_expiry && e.amc_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]).length === 0 && <div className="text-xs text-gray-400 text-center py-4">No upcoming AMC expirations</div>}
            </div>
          </div>
        </div>

        {/* Equipment by Category */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-sm mb-3">Equipment by Category</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const count = eq.equipment.filter(e => e.category === cat).length;
              if (count === 0) return null;
              return <div key={cat} className="px-3 py-2 bg-gray-50 rounded-lg border text-xs"><span className="font-bold text-teal-700">{count}</span> <span className="capitalize text-gray-600">{cat}</span></div>;
            })}
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function BiomedicalPage() {
  return <RoleGuard module="settings"><BiomedicalInner /></RoleGuard>;
}
