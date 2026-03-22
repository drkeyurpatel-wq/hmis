'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';
import { useHousekeepingTasks, useHousekeepingSchedules, type HKTask, type HKSchedule } from '@/lib/housekeeping/housekeeping-hooks';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'board' | 'discharge' | 'schedules';
const TASK_TYPES = ['routine', 'discharge', 'deep_clean', 'infection', 'spill', 'terminal'] as const;
const AREA_TYPES = ['room', 'ward', 'ot', 'icu', 'common_area', 'toilet'] as const;
const PRIORITIES = ['emergency', 'high', 'routine'] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', verified: 'bg-teal-100 text-teal-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  emergency: 'bg-red-600 text-white', high: 'bg-amber-100 text-amber-700', routine: 'bg-gray-100 text-gray-600',
};
const TYPE_COLORS: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-700', discharge: 'bg-blue-100 text-blue-700',
  deep_clean: 'bg-purple-100 text-purple-700', infection: 'bg-red-100 text-red-700',
  spill: 'bg-amber-100 text-amber-700', terminal: 'bg-red-200 text-red-800',
};

function HousekeepingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('board');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const hk = useHousekeepingTasks(centreId);
  const sched = useHousekeepingSchedules(centreId);

  // New task form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ taskType: 'routine', areaType: 'room', areaName: '', priority: 'routine', infectionType: '', notes: '' });

  // Filter
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Schedule form
  const [showSchedAdd, setShowSchedAdd] = useState(false);
  const [schedForm, setSchedForm] = useState({ areaName: '', areaType: 'room', frequency: 'daily', shift: 'morning', assignedTeam: '', checklist: '' });

  // Discharge queue — auto-detect beds in housekeeping status
  const [dischargeBeds, setDischargeBeds] = useState<any[]>([]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_beds')
      .select('id, bed_number, room:hmis_rooms(name, ward:hmis_wards(name))')
      .eq('status', 'housekeeping')
      .then(({ data }: any) => setDischargeBeds(data || []));
  }, [centreId, hk.tasks]);

  const filteredTasks = hk.tasks.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (typeFilter === 'all' || t.task_type === typeFilter)
  );

  const addTask = async () => {
    if (!form.areaName) { flash('Area name required'); return; }
    await hk.createTask({
      taskType: form.taskType, areaType: form.areaType, areaName: form.areaName,
      priority: form.priority, staffId, infectionType: form.infectionType || undefined,
      notes: form.notes || undefined,
    });
    setForm({ taskType: 'routine', areaType: 'room', areaName: '', priority: 'routine', infectionType: '', notes: '' });
    setShowAdd(false); flash('Task created');
  };

  const createDischargeTask = async (bed: any) => {
    const areaName = `${bed.room?.ward?.name || 'Ward'} — ${bed.room?.name || 'Room'} — Bed ${bed.bed_number}`;
    await hk.createTask({
      taskType: 'discharge', areaType: 'room', areaName,
      priority: 'high', staffId, bedId: bed.id,
    });
    flash(`Discharge cleaning created for Bed ${bed.bed_number}`);
  };

  const addSchedule = async () => {
    if (!schedForm.areaName) { flash('Area name required'); return; }
    const checklist = schedForm.checklist.split('\n').filter(Boolean).map(item => ({ item: item.trim(), done: false }));
    const team = schedForm.assignedTeam.split(',').map(s => s.trim()).filter(Boolean);
    await sched.addSchedule({
      area_name: schedForm.areaName, area_type: schedForm.areaType,
      frequency: schedForm.frequency, shift: schedForm.shift,
      assigned_team: team, checklist,
    });
    setSchedForm({ areaName: '', areaType: 'room', frequency: 'daily', shift: 'morning', assignedTeam: '', checklist: '' });
    setShowSchedAdd(false); flash('Schedule added');
  };

  const timeSince = (dt: string) => {
    const mins = Math.round((Date.now() - new Date(dt).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Housekeeping</h1><p className="text-xs text-gray-500">Task management, discharge cleaning, schedules</p></div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-red-600">{hk.stats.pending}</div><div className="text-[10px] text-gray-500">Pending</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-blue-600">{hk.stats.inProgress}</div><div className="text-[10px] text-gray-500">In Progress</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-amber-600">{hk.stats.overdue}</div><div className="text-[10px] text-gray-500">Overdue</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-teal-600">{hk.stats.avgTAT}m</div><div className="text-[10px] text-gray-500">Avg TAT</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-purple-600">{hk.stats.discharge}</div><div className="text-[10px] text-gray-500">Discharge Queue</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['board', 'Task Board'], ['discharge', 'Discharge Queue'], ['schedules', 'Schedules']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-xs font-medium rounded-lg ${tab === k ? 'bg-white shadow text-teal-700' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {/* ===== TASK BOARD ===== */}
      {tab === 'board' && <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {['all', 'pending', 'in_progress', 'completed', 'verified'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); hk.load(s); }} className={`px-2 py-1 text-[10px] rounded-lg border ${statusFilter === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}>{s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-1 border rounded-lg text-[10px]">
            <option value="all">All Types</option>
            {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{showAdd ? 'Cancel' : '+ New Task'}</button>
        </div>

        {showAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">New Housekeeping Task</h3>
          <div className="grid grid-cols-4 gap-2">
            <select value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
            <select value={form.areaType} onChange={e => setForm(f => ({ ...f, areaType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {AREA_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
            <input value={form.areaName} onChange={e => setForm(f => ({ ...f, areaName: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Area name *" />
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          {form.taskType === 'infection' && <input value={form.infectionType} onChange={e => setForm(f => ({ ...f, infectionType: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Infection type (e.g., MRSA, C.diff, COVID)" />}
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Notes (optional)" />
          <button onClick={addTask} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg">Create Task</button>
        </div>}

        {/* Task list */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Area</th><th className="p-2">Type</th><th className="p-2">Priority</th>
              <th className="p-2">Assigned</th><th className="p-2">Requested</th><th className="p-2">Status</th><th className="p-2">Actions</th>
            </tr></thead>
            <tbody>{filteredTasks.slice(0, 50).map(t => (
              <tr key={t.id} className={`border-b hover:bg-gray-50 ${t.priority === 'emergency' ? 'bg-red-50' : ''}`}>
                <td className="p-2"><div className="font-medium">{t.area_name}</div><div className="text-[10px] text-gray-400 capitalize">{t.area_type.replace('_', ' ')}</div></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${TYPE_COLORS[t.task_type]}`}>{t.task_type.replace('_', ' ')}</span></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span></td>
                <td className="p-2 text-center text-gray-500">{t.assignee?.full_name || '—'}</td>
                <td className="p-2 text-center text-gray-400">{timeSince(t.requested_at)}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                <td className="p-2 text-center">
                  <div className="flex gap-1 justify-center">
                    {t.status === 'pending' && <button onClick={() => hk.updateTask(t.id, { status: 'in_progress' })} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] rounded">Start</button>}
                    {t.status === 'in_progress' && <button onClick={() => hk.updateTask(t.id, { status: 'completed' })} className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] rounded">Complete</button>}
                    {t.status === 'completed' && <button onClick={() => hk.updateTask(t.id, { status: 'verified', staffId } as any)} className="px-2 py-0.5 bg-teal-100 text-teal-700 text-[9px] rounded">Verify</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {filteredTasks.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{hk.loading ? 'Loading...' : 'No tasks'}</div>}
        </div>
      </div>}

      {/* ===== DISCHARGE QUEUE ===== */}
      {tab === 'discharge' && <div className="space-y-3">
        {dischargeBeds.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="font-bold text-sm text-amber-800 mb-2">Beds Awaiting Cleaning ({dischargeBeds.length})</h3>
          <div className="grid grid-cols-4 gap-2">
            {dischargeBeds.map((bed: any) => (
              <div key={bed.id} className="bg-white rounded-xl border p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">Bed {bed.bed_number}</div>
                  <div className="text-[10px] text-gray-400">{bed.room?.ward?.name} — {bed.room?.name}</div>
                </div>
                <button onClick={() => createDischargeTask(bed)} className="px-2 py-1 bg-teal-600 text-white text-[9px] rounded">Assign</button>
              </div>
            ))}
          </div>
        </div>}
        {dischargeBeds.length === 0 && <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center text-sm text-green-700">No beds awaiting discharge cleaning</div>}

        {/* Active discharge tasks */}
        <h3 className="font-bold text-sm">Active Discharge Tasks</h3>
        <div className="grid grid-cols-3 gap-3">
          {hk.tasks.filter(t => t.task_type === 'discharge' && t.status !== 'verified').map(t => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 space-y-2 ${t.status === 'pending' ? 'border-l-4 border-l-red-500' : t.status === 'in_progress' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{t.area_name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
              </div>
              <div className="text-[10px] text-gray-400">Requested {timeSince(t.requested_at)} · {t.assignee?.full_name || 'Unassigned'}</div>
              {/* Checklist */}
              {t.checklist && t.checklist.length > 0 && <div className="space-y-0.5">
                {t.checklist.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <span className={`w-3 h-3 rounded border flex items-center justify-center ${c.done ? 'bg-green-100 border-green-400 text-green-600' : 'border-gray-300'}`}>{c.done ? '✓' : ''}</span>
                    <span className={c.done ? 'text-gray-400 line-through' : ''}>{c.item}</span>
                  </div>
                ))}
              </div>}
              <div className="flex gap-1 pt-1">
                {t.status === 'pending' && <button onClick={() => hk.updateTask(t.id, { status: 'in_progress' })} className="px-2 py-1 bg-blue-600 text-white text-[9px] rounded flex-1">Start Cleaning</button>}
                {t.status === 'in_progress' && <button onClick={() => hk.updateTask(t.id, { status: 'completed' })} className="px-2 py-1 bg-green-600 text-white text-[9px] rounded flex-1">Mark Clean</button>}
                {t.status === 'completed' && <button onClick={() => hk.updateTask(t.id, { status: 'verified', staffId } as any)} className="px-2 py-1 bg-teal-600 text-white text-[9px] rounded flex-1">Verify & Release Bed</button>}
              </div>
            </div>
          ))}
          {hk.tasks.filter(t => t.task_type === 'discharge' && t.status !== 'verified').length === 0 && <div className="col-span-3 text-center py-8 text-gray-400 text-sm">No active discharge cleaning tasks</div>}
        </div>
      </div>}

      {/* ===== SCHEDULES ===== */}
      {tab === 'schedules' && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Cleaning Schedules ({sched.schedules.length})</h3>
          <button onClick={() => setShowSchedAdd(!showSchedAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{showSchedAdd ? 'Cancel' : '+ Add Schedule'}</button>
        </div>

        {showSchedAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">New Cleaning Schedule</h3>
          <div className="grid grid-cols-4 gap-2">
            <input value={schedForm.areaName} onChange={e => setSchedForm(f => ({ ...f, areaName: e.target.value }))} className="col-span-2 px-3 py-2 border rounded-lg text-sm" placeholder="Area name *" />
            <select value={schedForm.areaType} onChange={e => setSchedForm(f => ({ ...f, areaType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {AREA_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
            <select value={schedForm.frequency} onChange={e => setSchedForm(f => ({ ...f, frequency: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="every_shift">Every Shift</option><option value="twice_daily">Twice Daily</option>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={schedForm.shift} onChange={e => setSchedForm(f => ({ ...f, shift: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="all">All Shifts</option><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
            </select>
            <input value={schedForm.assignedTeam} onChange={e => setSchedForm(f => ({ ...f, assignedTeam: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Team members (comma-separated)" />
          </div>
          <textarea value={schedForm.checklist} onChange={e => setSchedForm(f => ({ ...f, checklist: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} placeholder="Checklist (one per line)&#10;Mop floors&#10;Clean surfaces&#10;Restock supplies" />
          <button onClick={addSchedule} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg">Save Schedule</button>
        </div>}

        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Area</th><th className="p-2">Type</th><th className="p-2">Frequency</th>
              <th className="p-2">Shift</th><th className="p-2">Team</th><th className="p-2">Checklist</th><th className="p-2">Actions</th>
            </tr></thead>
            <tbody>{sched.schedules.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{s.area_name}</td>
                <td className="p-2 text-center capitalize">{s.area_type.replace('_', ' ')}</td>
                <td className="p-2 text-center capitalize">{s.frequency.replace('_', ' ')}</td>
                <td className="p-2 text-center capitalize">{s.shift || 'All'}</td>
                <td className="p-2 text-center text-gray-500">{(s.assigned_team || []).join(', ') || '—'}</td>
                <td className="p-2 text-center">{(s.checklist || []).length} items</td>
                <td className="p-2 text-center"><button onClick={() => sched.deleteSchedule(s.id)} className="text-red-500 text-[9px] hover:text-red-700">Remove</button></td>
              </tr>
            ))}</tbody>
          </table>
          {sched.schedules.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{sched.loading ? 'Loading...' : 'No schedules. Add one above.'}</div>}
        </div>
      </div>}
    </div>
  );
}

export default function HousekeepingPage() {
  return <RoleGuard module="settings"><HousekeepingInner /></RoleGuard>;
}
