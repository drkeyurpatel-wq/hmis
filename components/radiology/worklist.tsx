// components/radiology/worklist.tsx
// Main radiology worklist — filterable, sortable, with actions
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRadiologyWorklist, type RadiologyOrder, type WorklistFilters } from '@/lib/radiology/radiology-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const MOD_COLORS: Record<string, string> = { XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700', USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700', MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700' };
const urgColor = (u: string) => u === 'stat' ? 'bg-red-600 text-white' : u === 'urgent' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600';
const stColor = (s: string) => s === 'verified' ? 'bg-green-100 text-green-700' : s === 'reported' ? 'bg-blue-100 text-blue-700' : s === 'in_progress' ? 'bg-purple-100 text-purple-700' : s === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
const fmtTat = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
const tatColor = (mins: number, expected: number) => mins <= expected ? 'text-green-700' : mins <= expected * 1.5 ? 'text-amber-700' : 'text-red-700 font-bold';

interface Props {
  centreId: string;
  modalities: string[];
  onSelectOrder: (order: RadiologyOrder) => void;
  onLinkStudy: (order: RadiologyOrder) => void;
  onFlash: (msg: string) => void;
  pacsConfig?: any;
}

export default function RadiologyWorklist({ centreId, modalities, onSelectOrder, onLinkStudy, onFlash, pacsConfig }: Props) {
  const worklist = useRadiologyWorklist(centreId);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const applyFilters = (overrides?: Partial<WorklistFilters>) => {
    const f: WorklistFilters = {
      status: overrides?.status ?? statusFilter,
      modality: overrides?.modality ?? modalityFilter,
      urgency: overrides?.urgency ?? urgencyFilter,
      dateFrom: dateFilter,
      dateTo: dateFilter,
      search: searchText,
      ...overrides,
    };
    worklist.load(f);
  };

  // Technician list for assignment
  const [technicians, setTechnicians] = useState<any[]>([]);
  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_staff').select('id, full_name').eq('is_active', true)
      .ilike('designation', '%technician%').order('full_name').limit(50)
      .then(({ data }: any) => setTechnicians(data || []));
  }, []);

  return (
    <div className="space-y-3">
      {/* Search + Date + Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilters({ search: searchText })}
          placeholder="Search patient, UHID, accession..." className="px-3 py-1.5 border rounded-lg text-xs w-56" />
        <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); applyFilters({ dateFrom: e.target.value, dateTo: e.target.value }); }}
          className="px-3 py-1.5 border rounded-lg text-xs" />
        <button onClick={() => { setDateFilter(''); applyFilters({ dateFrom: undefined, dateTo: undefined }); }}
          className="px-2 py-1.5 border rounded-lg text-xs bg-gray-50">All Dates</button>
        <button onClick={() => applyFilters()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">Refresh</button>
      </div>

      {/* Status / modality / urgency filter chips */}
      <div className="flex gap-1 flex-wrap">
        {['all', 'ordered', 'scheduled', 'in_progress', 'reported', 'verified'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); applyFilters({ status: s }); }}
            className={`px-2 py-1 rounded text-[10px] border ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</button>
        ))}
        <span className="border-l mx-1" />
        {['all', ...modalities].map(m => (
          <button key={m} onClick={() => { setModalityFilter(m); applyFilters({ modality: m }); }}
            className={`px-2 py-1 rounded text-[10px] border ${modalityFilter === m ? 'bg-blue-600 text-white' : m !== 'all' ? MOD_COLORS[m] || 'bg-white' : 'bg-white'}`}>{m === 'all' ? 'All Mod' : m}</button>
        ))}
        <span className="border-l mx-1" />
        {['all', 'stat', 'urgent', 'routine'].map(u => (
          <button key={u} onClick={() => { setUrgencyFilter(u); applyFilters({ urgency: u }); }}
            className={`px-2 py-1 rounded text-[10px] border ${urgencyFilter === u ? 'bg-blue-600 text-white' : 'bg-white'}`}>{u === 'all' ? 'All Urg' : u.toUpperCase()}</button>
        ))}
      </div>

      {/* Table */}
      {worklist.loading ? <div className="py-8 text-center text-gray-400 animate-pulse">Loading worklist...</div> :
      worklist.orders.length === 0 ? <div className="py-8 bg-white rounded-xl border text-center text-gray-400 text-sm">No orders found</div> :
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[1000px]"><thead><tr className="bg-gray-50 border-b text-gray-500">
          <th className="p-2 text-left font-medium w-24">Accession</th>
          <th className="p-2 text-left font-medium">Patient</th>
          <th className="p-2 font-medium">Test</th>
          <th className="p-2 font-medium w-14">Mod</th>
          <th className="p-2 font-medium w-14">Urg</th>
          <th className="p-2 font-medium w-20">Status</th>
          <th className="p-2 font-medium w-16">Images</th>
          <th className="p-2 font-medium w-16">Report</th>
          <th className="p-2 font-medium w-20">TAT</th>
          <th className="p-2 font-medium w-36">Actions</th>
        </tr></thead><tbody>{worklist.orders.map(o => {
          const tat = o.tat_minutes || (o.status !== 'verified' && o.status !== 'reported' ? Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) : 0);
          const expectedTat = (o.test?.tat_hours || 24) * 60;
          const hasStradus = !!(o.stradus_viewer_url || o.pacs_study_uid);
          const hasReport = o.report && o.report.length > 0;
          const stradusUrl = o.stradus_viewer_url || (pacsConfig?.viewer_url && o.pacs_study_uid ? `${pacsConfig.viewer_url}?StudyInstanceUID=${o.pacs_study_uid}` : null);

          return (
            <tr key={o.id} className={`border-b hover:bg-blue-50 ${o.urgency === 'stat' ? 'bg-red-50/50' : ''} ${o.report?.[0]?.is_critical ? 'bg-red-50/70' : ''}`}>
              <td className="p-2 font-mono text-[10px] text-gray-500">{o.accession_number || '—'}</td>
              <td className="p-2">
                <div className="font-medium">{o.patient?.first_name} {o.patient?.last_name}</div>
                <div className="text-[10px] text-gray-400">{o.patient?.uhid} | {o.patient?.age_years}y {o.patient?.gender}</div>
              </td>
              <td className="p-2 text-center">{o.test?.test_name}{o.is_contrast && <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-0.5 rounded">C+</span>}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${MOD_COLORS[o.modality] || 'bg-gray-100'}`}>{o.modality}</span></td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${urgColor(o.urgency)}`}>{o.urgency?.toUpperCase()}</span></td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(o.status)}`}>{o.status?.replace('_', ' ')}</span></td>
              <td className="p-2 text-center">
                {stradusUrl ? (
                  <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-[10px]">View</a>
                ) : (
                  <button onClick={() => onLinkStudy(o)} className="text-[10px] text-amber-600 hover:underline">Link</button>
                )}
              </td>
              <td className="p-2 text-center">
                {hasReport ? <span className={`text-[9px] px-1 py-0.5 rounded ${o.report?.[0]?.is_critical ? 'bg-red-600 text-white' : o.report?.[0]?.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.report?.[0]?.is_critical ? 'CRIT' : o.report?.[0]?.status === 'verified' ? '✓' : 'R'}</span> : <span className="text-[10px] text-gray-300">—</span>}
              </td>
              <td className="p-2 text-center">{tat > 0 ? <span className={tatColor(tat, expectedTat)}>{fmtTat(tat)}</span> : '—'}</td>
              <td className="p-2 text-center space-x-1">
                {o.status === 'ordered' && <button onClick={async () => { await worklist.updateStatus(o.id, 'in_progress'); onFlash('Started'); }} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">Start</button>}
                {['ordered', 'in_progress'].includes(o.status) && <button onClick={() => onLinkStudy(o)} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">Link</button>}
                <button onClick={() => onSelectOrder(o)} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px]">Detail</button>
              </td>
            </tr>
          );
        })}</tbody></table>
      </div>}
    </div>
  );
}
