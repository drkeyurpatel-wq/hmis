'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useOPDQueue, useDoctors, type OPDVisit } from '@/lib/revenue/hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function OPDPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { visits, loading, stats, createVisit, updateStatus } = useOPDQueue(centreId);
  const doctors = useDoctors(centreId);

  // New visit form
  const [showNew, setShowNew] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [visitType, setVisitType] = useState('new');
  const [complaint, setComplaint] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');

  // Patient search
  useEffect(() => {
    if (searchQ.length < 2 || !sb()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${searchQ}%,first_name.ilike.%${searchQ}%,last_name.ilike.%${searchQ}%,phone_primary.ilike.%${searchQ}%`)
        .eq('is_active', true).limit(8);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const handleCreateVisit = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    setCreating(true);
    await createVisit(selectedPatient.id, selectedDoctor, visitType, complaint);
    setShowNew(false); setSelectedPatient(null); setSelectedDoctor(''); setComplaint(''); setSearchQ('');
    setCreating(false);
  };

  const filtered = visits.filter(v => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (doctorFilter !== 'all' && v.doctor.id !== doctorFilter) return false;
    return true;
  });

  const statusColor = (s: string) => s === 'waiting' ? 'bg-yellow-100 text-yellow-800' : s === 'with_doctor' ? 'bg-blue-100 text-blue-800' : s === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">OPD Queue</h1><p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ New Visit</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[['Total', stats.total, 'bg-gray-50'], ['Waiting', stats.waiting, 'bg-yellow-50'], ['With Doctor', stats.withDoctor, 'bg-blue-50'], ['Completed', stats.completed, 'bg-green-50']].map(([label, val, bg]) => (
          <div key={label as string} className={`${bg} rounded-xl p-4`}><div className="text-xs text-gray-500">{label as string}</div><div className="text-2xl font-bold">{val as number}</div></div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all','All'],['waiting','Waiting'],['with_doctor','With Doctor'],['completed','Completed']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 text-xs rounded-lg border ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'}`}>{l}</button>
        ))}
        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="text-xs border rounded-lg px-3 py-1.5 ml-auto">
          <option value="all">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      </div>

      {/* Queue Table */}
      {loading ? <div className="text-center py-8 text-gray-400">Loading queue...</div> : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border"><p className="text-gray-400">No visits today</p><p className="text-xs text-gray-300 mt-1">Click "+ New Visit" to register a patient</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left p-3 font-medium text-gray-500">Token</th>
              <th className="text-left p-3 font-medium text-gray-500">Patient</th>
              <th className="text-left p-3 font-medium text-gray-500">Doctor</th>
              <th className="text-left p-3 font-medium text-gray-500">Chief Complaint</th>
              <th className="text-left p-3 font-medium text-gray-500">Status</th>
              <th className="text-left p-3 font-medium text-gray-500">Time</th>
              <th className="p-3 font-medium text-gray-500">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="p-3"><span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-bold">T-{String(v.tokenNumber).padStart(3, '0')}</span></td>
                  <td className="p-3"><div className="font-medium">{v.patient.name}</div><div className="text-xs text-gray-400">{v.patient.uhid} | {v.patient.age}/{v.patient.gender}</div></td>
                  <td className="p-3"><div className="text-sm">{v.doctor.name}</div><div className="text-xs text-gray-400">{v.doctor.department}</div></td>
                  <td className="p-3 text-xs text-gray-600 max-w-[200px] truncate">{v.chiefComplaint || '—'}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(v.status)}`}>{v.status.replace('_', ' ')}</span></td>
                  <td className="p-3 text-xs text-gray-400">{v.checkInTime ? new Date(v.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {v.status === 'waiting' && <button onClick={() => updateStatus(v.id, 'with_doctor')} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100">Start</button>}
                      {v.status === 'with_doctor' && <>
                        <a href={`/emr-v2?patient=${v.patient.id}`} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded hover:bg-green-100">EMR</a>
                        <button onClick={() => updateStatus(v.id, 'completed')} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded hover:bg-gray-100">Done</button>
                      </>}
                      {v.status === 'completed' && <a href={`/billing?patient=${v.patient.id}`} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded hover:bg-purple-100">Bill</a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Visit Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New OPD Visit</h2>
            <div className="space-y-4">
              {/* Patient search */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Patient *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                    <div><div className="font-medium text-sm">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                    <div className="text-xs text-gray-500">{selectedPatient.uhid} | {selectedPatient.age_years}/{selectedPatient.gender}</div></div>
                    <button onClick={() => setSelectedPatient(null)} className="text-xs text-red-500">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder="Search by UHID, name, or phone..." value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {searchResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {searchResults.map(p => <button key={p.id} onClick={() => { setSelectedPatient(p); setSearchResults([]); setSearchQ(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">
                        <span className="font-medium">{p.first_name} {p.last_name}</span> <span className="text-gray-400">{p.uhid} | {p.age_years}/{p.gender} | {p.phone_primary}</span>
                      </button>)}</div>}
                  </div>
                )}
              </div>
              {/* Doctor */}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Doctor *</label>
                <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select doctor...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} — {d.specialisation || d.designation}</option>)}
                </select>
              </div>
              {/* Type */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Visit Type</label>
                  <select value={visitType} onChange={e => setVisitType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="new">New</option><option value="followup">Follow-up</option><option value="referral">Referral</option><option value="emergency">Emergency</option>
                  </select></div>
              </div>
              {/* Complaint */}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Chief Complaint</label>
                <input type="text" placeholder="Brief complaint..." value={complaint} onChange={e => setComplaint(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreateVisit} disabled={!selectedPatient || !selectedDoctor || creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{creating ? 'Creating...' : 'Create Visit & Assign Token'}</button>
                <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OPDPage() { return <RoleGuard module="opd"><OPDPageInner /></RoleGuard>; }
