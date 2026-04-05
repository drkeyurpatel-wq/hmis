'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDutyRoster, type RosterEntry } from '@/lib/duty-roster/duty-roster-hooks';
import { sb } from '@/lib/supabase/browser';

const SHIFT_COLORS: Record<string, string> = { morning: 'bg-green-200 text-green-800', afternoon: 'bg-amber-200 text-amber-800', night: 'bg-indigo-200 text-indigo-800', general: 'bg-blue-200 text-blue-800', off: 'bg-gray-100 text-gray-500', leave: 'bg-red-100 text-red-600', custom: 'bg-purple-200 text-purple-800' };
const SHIFT_SHORT: Record<string, string> = { morning: 'M', afternoon: 'A', night: 'N', general: 'G', off: 'O', leave: 'L', custom: 'C' };

type Tab = 'roster' | 'gaps' | 'config';

function Inner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const dr = useDutyRoster(centreId);

  const [tab, setTab] = useState<Tab>('roster');
  const [showSwaps, setShowSwaps] = useState(false);
  const [configView, setConfigView] = useState<'generate'|'requirements'|'summary'>('generate');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Date range for roster view
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [wardFilter, setWardFilter] = useState('all');

  // Staff + Ward lists
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; staff_type: string }[]>([]);
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_staff').select('id, full_name, staff_type').eq('is_active', true).order('full_name').then(({ data }) => setStaffList(data || []));
    sb().from('hmis_wards').select('id, name').eq('centre_id', centreId).eq('is_active', true).order('name').then(({ data }) => setWards(data || []));
  }, [centreId]);

  // Load roster when month changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const from = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const to = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${daysInMonth}`;
    dr.loadRoster(from, to);
  }, [viewYear, viewMonth, dr.loadRoster]);

  // Generate form
  const [genWard, setGenWard] = useState('');
  const [genStaff, setGenStaff] = useState<string[]>([]);
  const [genRotation, setGenRotation] = useState('M,M,A,A,N,N,O');

  const handleGenerate = async () => {
    if (!genWard || genStaff.length === 0) { flash('Select ward and staff'); return; }
    const rotation = genRotation.split(',').map(s => s.trim().toUpperCase());
    await dr.generateMonthRoster(genWard, viewYear, viewMonth, genStaff, rotation, staffId);
    flash(`Roster generated for ${genStaff.length} staff`);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    dr.loadRoster(`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`, `${viewYear}-${String(viewMonth).padStart(2, '0')}-${daysInMonth}`);
    setTab('roster');
  };

  // Requirement form
  const [reqWard, setReqWard] = useState('');
  const [reqShift, setReqShift] = useState('');
  const [reqType, setReqType] = useState('nurse');
  const [reqCount, setReqCount] = useState('1');

  // Grid data: rows = staff, cols = days
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dayOfWeek = (d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(viewYear, viewMonth - 1, d).getDay()];

  const rosterGrid = useMemo(() => {
    // Group by staff_id
    const byStaff: Record<string, Record<string, RosterEntry>> = {};
    roster_filtered().forEach(r => {
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = {};
      byStaff[r.staff_id][r.roster_date] = r;
    });
    return byStaff;
  }, [dr.roster, wardFilter]);

  function roster_filtered() {
    if (wardFilter === 'all') return dr.roster;
    return dr.roster.filter(r => r.ward_id === wardFilter);
  }

  const staffInRoster = useMemo(() => {
    const ids = [...new Set(roster_filtered().map(r => r.staff_id))];
    return ids.map(id => {
      const entry = roster_filtered().find(r => r.staff_id === id);
      return { id, name: (entry?.staff as any)?.full_name || '?', type: (entry?.staff as any)?.staff_type || '' };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [dr.roster, wardFilter]);

  // Inline edit
  const handleCellClick = async (staffIdTarget: string, day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentEntry = rosterGrid[staffIdTarget]?.[dateStr];
    const types = ['morning', 'afternoon', 'night', 'general', 'off', 'leave'];
    const currentIdx = types.indexOf(currentEntry?.shift_type || 'off');
    const nextType = types[(currentIdx + 1) % types.length];
    const shift = dr.shifts.find(s => s.shift_code === SHIFT_SHORT[nextType]?.toUpperCase());
    await dr.assignShift({
      staff_id: staffIdTarget, ward_id: wardFilter !== 'all' ? wardFilter : (wards[0]?.id || ''),
      shift_id: shift?.id, roster_date: dateStr, shift_type: nextType, created_by: staffId,
    });
    const dIM = new Date(viewYear, viewMonth, 0).getDate();
    dr.loadRoster(`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`, `${viewYear}-${String(viewMonth).padStart(2, '0')}-${dIM}`);
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Duty Roster</h1>
        <div className="flex gap-1 flex-wrap">
          {(['roster','gaps','swaps','generate','requirements','summary'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {t === 'roster' ? 'Roster' : t === 'gaps' ? `Gaps (${dr.coverageGaps.length})` : false ? '' : false ? '' : false ? '' : 'Summary'}
            </button>
          ))}
        </div>
      </div>

      {/* Month/Ward selector */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <select className="border rounded px-2 py-1.5 text-sm" value={viewMonth} onChange={e => setViewMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="border rounded px-2 py-1.5 text-sm w-20" value={viewYear} onChange={e => setViewYear(+e.target.value)} />
        <select className="border rounded px-2 py-1.5 text-sm" value={wardFilter} onChange={e => setWardFilter(e.target.value)}>
          <option value="all">All Wards</option>
          {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <div className="flex gap-1 ml-4 text-xs">
          {Object.entries(SHIFT_COLORS).map(([k, cls]) => (
            <span key={k} className={`px-2 py-0.5 rounded ${cls}`}>{SHIFT_SHORT[k] || k} = {k}</span>
          ))}
        </div>
      </div>

      {/* Roster Grid */}
      {tab === 'roster' && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          {dr.loading ? <p className="p-4 text-gray-400 text-sm">Loading...</p> : staffInRoster.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No roster data for this month. Use Auto-Generate to create one.</p>
          ) : (
            <table className="text-xs min-w-max">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sticky left-0 bg-gray-50 z-10 min-w-[140px]">Staff</th>
                  {dayHeaders.map(d => {
                    const dow = dayOfWeek(d);
                    const isSun = dow === 'Sun';
                    return <th key={d} className={`text-center p-1 min-w-[32px] ${isSun ? 'bg-red-50' : ''}`}>{d}<br /><span className="text-[9px] text-gray-400">{dow}</span></th>;
                  })}
                  <th className="text-center p-2 min-w-[50px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {staffInRoster.map(s => {
                  const entries = rosterGrid[s.id] || {};
                  const workDays = Object.values(entries).filter(e => e.shift_type !== 'off' && e.shift_type !== 'leave').length;
                  return (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sticky left-0 bg-white z-10 font-medium whitespace-nowrap">{s.name}<br /><span className="text-[9px] text-gray-400">{s.type}</span></td>
                      {dayHeaders.map(d => {
                        const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const entry = entries[dateStr];
                        const type = entry?.shift_type || '';
                        return (
                          <td key={d} className="text-center p-0.5 cursor-pointer" onClick={() => handleCellClick(s.id, d)}>
                            {type ? (
                              <span className={`inline-block w-7 h-6 leading-6 rounded text-[10px] font-bold ${SHIFT_COLORS[type] || 'bg-gray-100'}`}>
                                {SHIFT_SHORT[type] || '?'}
                              </span>
                            ) : <span className="text-gray-200">·</span>}
                          </td>
                        );
                      })}
                      <td className="text-center p-2 font-semibold">{workDays}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Coverage Gaps */}
      {tab === 'gaps' && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Coverage Gaps</h2>
          {dr.coverageGaps.length === 0 ? <p className="text-green-600 text-sm">No coverage gaps detected ✓</p> : (
            <div className="space-y-2">
              {dr.coverageGaps.map((g, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                  <span className="text-red-600 text-xs font-bold">ALERT</span>
                  <div>
                    <div className="font-medium">{g.ward} — {g.shift} ({g.date})</div>
                    <div className="text-sm text-red-600">{g.staffType}: {g.assigned} assigned, needs {g.required}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Swap Requests */}
      {tab === 'gaps' && showSwaps && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Pending Swap Requests</h2>
          {dr.swaps.length === 0 ? <p className="text-gray-500 text-sm">No pending swap requests.</p> : (
            <div className="space-y-2">
              {dr.swaps.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{(s.requester as any)?.full_name} ↔ {(s.target as any)?.full_name}</div>
                    <div className="text-sm text-gray-500">{s.swap_date} · {s.reason || 'No reason'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => { await dr.approveSwap(s.id, staffId); flash('Swap approved'); dr.loadSwaps(); }}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm">Approve</button>
                    <button onClick={async () => { await dr.rejectSwap(s.id, staffId); flash('Swap rejected'); dr.loadSwaps(); }}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auto-Generate */}
      {tab === 'config' && configView === 'generate' && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Auto-Generate Monthly Roster</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500">Ward *</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={genWard} onChange={e => setGenWard(e.target.value)}>
                <option value="">Select ward...</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Rotation Pattern (comma-separated shift codes)</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={genRotation} onChange={e => setGenRotation(e.target.value)} placeholder="M,M,A,A,N,N,O" />
              <p className="text-[10px] text-gray-400 mt-1">M=Morning, A=Afternoon, N=Night, G=General, O=Off. Each staff starts offset by 1 day.</p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500">Select Staff (multi-select)</label>
            <div className="border rounded max-h-48 overflow-y-auto p-2">
              {staffList.filter(s => s.staff_type === 'nurse' || s.staff_type === 'doctor' || s.staff_type === 'technician').map(s => (
                <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={genStaff.includes(s.id)} onChange={e => {
                    setGenStaff(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                  }} />
                  <span className="text-sm">{s.full_name} <span className="text-gray-400">({s.staff_type})</span></span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleGenerate} disabled={!genWard || genStaff.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
            Generate {MONTHS[viewMonth - 1]} {viewYear} Roster
          </button>
        </div>
      )}

      {/* Staffing Requirements */}
      {tab === 'config' && configView === 'requirements' && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Minimum Staffing Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
            <select className="border rounded px-2 py-1.5 text-sm" value={reqWard} onChange={e => setReqWard(e.target.value)}>
              <option value="">Ward...</option>{wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className="border rounded px-2 py-1.5 text-sm" value={reqShift} onChange={e => setReqShift(e.target.value)}>
              <option value="">Shift...</option>{dr.shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
            </select>
            <select className="border rounded px-2 py-1.5 text-sm" value={reqType} onChange={e => setReqType(e.target.value)}>
              <option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="technician">Technician</option><option value="support">Support</option>
            </select>
            <input type="number" min="1" className="border rounded px-2 py-1.5 text-sm" value={reqCount} onChange={e => setReqCount(e.target.value)} placeholder="Min count" />
            <button onClick={async () => { if (reqWard && reqShift) { await dr.saveRequirement({ ward_id: reqWard, shift_id: reqShift, staff_type: reqType, min_count: +reqCount }); flash('Saved'); dr.loadRequirements(); } }} className="bg-blue-600 text-white rounded text-sm">Save</button>
          </div>
          {dr.requirements.length > 0 && (
            <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-2">Ward</th><th className="text-left p-2">Shift</th><th className="text-left p-2">Staff Type</th><th className="text-center p-2">Min</th></tr></thead>
              <tbody>{dr.requirements.map(r => (
                <tr key={r.id} className="border-t"><td className="p-2">{(r.ward as any)?.name}</td><td className="p-2">{(r.shift as any)?.shift_name}</td><td className="p-2">{r.staff_type}</td><td className="p-2 text-center font-semibold">{r.min_count}</td></tr>
              ))}</tbody></table>
          )}
        </div>
      )}

      {/* Summary */}
      {tab === 'config' && configView === 'summary' && (
        <div className="bg-white border rounded-lg p-4 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">Staff Summary — {MONTHS[viewMonth - 1]} {viewYear}</h2>
          {Object.keys(dr.staffSummary).length === 0 ? <p className="text-gray-500 text-sm">No data.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-2">Staff</th><th className="text-center p-2">Work Days</th><th className="text-center p-2">Off</th><th className="text-center p-2">Leave</th>
                <th className="text-center p-2">Morning</th><th className="text-center p-2">Afternoon</th><th className="text-center p-2">Night</th><th className="text-center p-2">OT (hrs)</th>
              </tr></thead>
              <tbody>
                {Object.entries(dr.staffSummary).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, s]) => (
                  <tr key={id} className="border-t">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2 text-center">{s.totalDays}</td>
                    <td className="p-2 text-center">{s.offDays}</td>
                    <td className="p-2 text-center">{s.leaveDays}</td>
                    <td className="p-2 text-center">{s.shifts.morning || 0}</td>
                    <td className="p-2 text-center">{s.shifts.afternoon || 0}</td>
                    <td className="p-2 text-center">{s.shifts.night || 0}</td>
                    <td className="p-2 text-center">{(s.overtimeMin / 60).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function DutyRosterPage() {
  return <RoleGuard module="settings"><Inner /></RoleGuard>;
}
