// components/ipd/smart-mar.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  records: any[]; meds: any[]; admissionId: string; staffId: string;
  onAdminister: (recordId: string, staffId: string) => Promise<void>;
  onHold: (recordId: string, reason: string) => Promise<void>;
  onFlash: (m: string) => void;
}

const TIME_SLOTS = ['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','00:00','02:00','04:00'];

export default function SmartMAR({ records, meds, admissionId, staffId, onAdminister, onHold, onFlash }: Props) {
  const [selectedTime, setSelectedTime] = useState('');
  const [showHoldDialog, setShowHoldDialog] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('');

  // Active meds for MAR display
  const activeMeds = useMemo(() => meds.filter(m => m.status === 'active'), [meds]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const given = records.filter(r => r.status === 'given').length;
    const held = records.filter(r => r.status === 'held').length;
    const scheduled = records.filter(r => r.status === 'scheduled').length;
    const missed = records.filter(r => r.status === 'missed').length;
    const overdue = records.filter(r => {
      if (r.status !== 'scheduled') return false;
      const scheduledTime = new Date(r.scheduled_time);
      return scheduledTime.getTime() < Date.now() - 30 * 60 * 1000; // >30 min late
    }).length;
    const compliance = total > 0 ? Math.round((given / (given + held + missed)) * 100) : 100;
    return { total, given, held, scheduled, missed, overdue, compliance };
  }, [records]);

  // Group records by medication
  const groupedByMed = useMemo(() => {
    const groups: Record<string, any[]> = {};
    records.forEach(r => {
      const medName = r.medication?.drug_name || 'Unknown';
      if (!groups[medName]) groups[medName] = [];
      groups[medName].push(r);
    });
    return groups;
  }, [records]);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'given': return <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">✓</span>;
      case 'held': return <span className="w-6 h-6 rounded-full bg-yellow-400 text-white flex items-center justify-center text-xs font-bold">H</span>;
      case 'missed': return <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✗</span>;
      case 'scheduled': return <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">○</span>;
      default: return <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">—</span>;
    }
  };

  const isOverdue = (r: any) => {
    if (r.status !== 'scheduled') return false;
    return new Date(r.scheduled_time).getTime() < Date.now() - 30 * 60 * 1000;
  };

  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Medication Administration Record</h2>

      {/* Stats bar */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        <div className="bg-white rounded-xl border p-2.5 text-center">
          <div className="text-[10px] text-gray-400">Compliance</div>
          <div className={`text-lg font-bold ${stats.compliance >= 90 ? 'text-green-700' : stats.compliance >= 70 ? 'text-yellow-700' : 'text-red-700'}`}>{stats.compliance}%</div>
        </div>
        <div className="bg-green-50 rounded-xl p-2.5 text-center">
          <div className="text-[10px] text-gray-400">Given</div>
          <div className="text-lg font-bold text-green-700">{stats.given}</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-2.5 text-center">
          <div className="text-[10px] text-gray-400">Held</div>
          <div className="text-lg font-bold text-yellow-700">{stats.held}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <div className="text-[10px] text-gray-400">Scheduled</div>
          <div className="text-lg font-bold text-gray-700">{stats.scheduled}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2.5 text-center">
          <div className="text-[10px] text-gray-400">Missed</div>
          <div className="text-lg font-bold text-red-700">{stats.missed}</div>
        </div>
        <div className={`rounded-xl p-2.5 text-center ${stats.overdue > 0 ? 'bg-red-100 border border-red-300' : 'bg-gray-50'}`}>
          <div className="text-[10px] text-gray-400">Overdue</div>
          <div className={`text-lg font-bold ${stats.overdue > 0 ? 'text-red-700 animate-pulse' : 'text-gray-400'}`}>{stats.overdue}</div>
        </div>
      </div>

      {/* Active meds list */}
      {activeMeds.length > 0 && <div className="bg-white rounded-xl border p-3 mb-4">
        <h3 className="text-xs font-medium text-gray-500 mb-2">Active Medications ({activeMeds.length})</h3>
        <div className="grid grid-cols-2 gap-1.5">{activeMeds.map((m: any) => (
          <div key={m.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-gray-50 rounded">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-medium">{m.drug_name}</span>
            <span className="text-gray-400">{m.dose} | {m.route} | {m.frequency}</span>
            {m.is_stat && <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[9px] font-bold">STAT</span>}
            {m.is_prn && <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[9px]">PRN</span>}
          </div>
        ))}</div>
      </div>}

      {/* MAR grid */}
      {records.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No scheduled medications for today. Add medication orders first.</div> :
      <div className="space-y-2">
        {/* Per-medication rows */}
        {Object.entries(groupedByMed).map(([medName, recs]) => {
          const firstRec = recs[0];
          const med = firstRec?.medication;
          return (
            <div key={medName} className="bg-white rounded-xl border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{medName}</span>
                  <span className="text-xs text-gray-400">{med?.dose} | {med?.route?.toUpperCase()} | {med?.frequency}</span>
                  {med?.is_stat && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold">STAT</span>}
                </div>
              </div>

              {/* Dose timeline */}
              <div className="space-y-1.5">{recs.map((r: any) => {
                const time = new Date(r.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                const overdue = isOverdue(r);

                return (
                  <div key={r.id} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${overdue ? 'bg-red-50 border border-red-200' : r.status === 'given' ? 'bg-green-50' : ''}`}>
                    {statusIcon(r.status)}
                    <span className={`text-xs font-mono w-14 ${overdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{time}</span>
                    <span className={`text-xs flex-1 ${r.status === 'given' ? 'text-green-700' : r.status === 'held' ? 'text-yellow-700' : overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {r.status === 'given' ? `Given by ${r.administered_by_name || 'staff'} at ${r.administered_time ? new Date(r.administered_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}` :
                       r.status === 'held' ? `Held — ${r.hold_reason || 'No reason'}` :
                       r.status === 'missed' ? 'MISSED' :
                       overdue ? 'OVERDUE — administer now' : 'Scheduled'}
                    </span>
                    {r.status === 'scheduled' && <div className="flex gap-1">
                      <button onClick={async () => { await onAdminister(r.id, staffId); onFlash(`${medName} administered`); }}
                        className={`px-3 py-1 text-xs rounded-lg font-medium ${overdue ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white'}`}>Give</button>
                      <button onClick={() => { setShowHoldDialog(r.id); setHoldReason(''); }}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-lg">Hold</button>
                    </div>}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })}

        {/* Hold dialog */}
        {showHoldDialog && <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowHoldDialog(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Hold Medication</h3>
            <label className="text-xs text-gray-500">Reason for holding *</label>
            <div className="flex flex-wrap gap-1 my-2">{['Patient NPO','Hypotension','Bradycardia','Vomiting','Labs pending','Doctor order','Patient refused','Hypoglycemia','Renal function','Allergic reaction'].map(r => (
              <button key={r} onClick={() => setHoldReason(r)}
                className={`px-2 py-0.5 rounded border text-[10px] ${holdReason === r ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-white text-gray-500 border-gray-200'}`}>{r}</button>
            ))}</div>
            <input type="text" value={holdReason} onChange={e => setHoldReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" placeholder="Or type reason..." />
            <div className="flex gap-2">
              <button onClick={async () => { if (holdReason && showHoldDialog) { await onHold(showHoldDialog, holdReason); setShowHoldDialog(null); onFlash('Medication held'); } }}
                disabled={!holdReason} className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">Hold</button>
              <button onClick={() => setShowHoldDialog(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>}
      </div>}
    </div>
  );
}
