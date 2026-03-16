// components/ipd/smart-mar.tsx
'use client';
import React, { useState, useMemo } from 'react';

interface Props {
  records: any[]; meds: any[]; admissionId: string; staffId: string;
  onAdminister: (recordId: string, staffId: string) => Promise<void>;
  onHold: (recordId: string, reason: string) => Promise<void>;
  onFlash: (m: string) => void;
}

const HOLD_REASONS = ['Patient NPO','Low BP','Bradycardia','Low SpO2','Patient refused','Vomiting','Lab values pending','Duplicate dose','Allergic reaction','Drug not available','Physician order'];
const TIME_SLOTS = ['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','00:00','02:00','04:00'];

export default function SmartMAR({ records, meds, admissionId, staffId, onAdminister, onHold, onFlash }: Props) {
  const [holdId, setHoldId] = useState('');
  const [holdReason, setHoldReason] = useState('');

  // Group active meds with their MAR status
  const activeMeds = meds.filter(m => m.status === 'active');

  // Scheduled entries for today
  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return records.filter(r => (r.scheduled_time || r.created_at || '').startsWith(today));
  }, [records]);

  const pendingCount = todayRecords.filter(r => r.status === 'scheduled').length;
  const givenCount = todayRecords.filter(r => r.status === 'given').length;
  const heldCount = todayRecords.filter(r => r.status === 'held').length;

  const stColor = (s: string) => s === 'given' ? 'bg-green-100 text-green-700' : s === 'held' ? 'bg-yellow-100 text-yellow-700' : s === 'missed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
  const routeColor = (r: string) => r === 'iv' ? 'bg-red-50 text-red-700' : r === 'sc' ? 'bg-blue-50 text-blue-700' : r === 'im' ? 'bg-purple-50 text-purple-700' : r === 'inhalation' ? 'bg-teal-50 text-teal-700' : 'bg-gray-50 text-gray-700';

  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Medication Administration Record</h2>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-500">Active Meds</div><div className="text-lg font-bold text-gray-700">{activeMeds.length}</div></div>
        <div className="bg-yellow-50 rounded-lg p-2 text-center"><div className="text-[10px] text-yellow-600">Due</div><div className="text-lg font-bold text-yellow-700">{pendingCount}</div></div>
        <div className="bg-green-50 rounded-lg p-2 text-center"><div className="text-[10px] text-green-600">Given</div><div className="text-lg font-bold text-green-700">{givenCount}</div></div>
        <div className="bg-red-50 rounded-lg p-2 text-center"><div className="text-[10px] text-red-600">Held</div><div className="text-lg font-bold text-red-700">{heldCount}</div></div>
      </div>

      {/* MAR Grid — medication × time */}
      {activeMeds.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No active medications. Order medications first.</div> :
      <div className="bg-white rounded-xl border overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[180px]">Medication</th>
            <th className="p-2 font-medium text-gray-500">Route</th>
            <th className="p-2 font-medium text-gray-500">Freq</th>
            {TIME_SLOTS.map(t => <th key={t} className="p-2 font-medium text-gray-400 text-center min-w-[50px]">{t}</th>)}
          </tr></thead>
          <tbody>{activeMeds.map((m: any) => {
            // Find MAR records for this med today
            const medRecords = todayRecords.filter(r => r.medication_id === m.id || r.medication?.drug_name === m.drug_name);
            return (
              <tr key={m.id} className="border-b">
                <td className="p-2 sticky left-0 bg-white">
                  <div className="font-medium">{m.drug_name}</div>
                  <div className="text-[10px] text-gray-400">{m.dose}</div>
                </td>
                <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${routeColor(m.route)}`}>{m.route?.toUpperCase()}</span></td>
                <td className="p-2 text-center text-gray-500">{m.frequency}</td>
                {TIME_SLOTS.map(t => {
                  const rec = medRecords.find((r: any) => (r.scheduled_time || '').includes(t));
                  return <td key={t} className="p-2 text-center">
                    {rec ? <span className={`w-5 h-5 inline-flex items-center justify-center rounded text-[9px] font-bold ${stColor(rec.status)}`}>{rec.status === 'given' ? '✓' : rec.status === 'held' ? 'H' : rec.status === 'missed' ? '✗' : '·'}</span> : <span className="text-gray-200">·</span>}
                  </td>;
                })}
              </tr>
            );
          })}</tbody>
        </table>
      </div>}

      {/* Scheduled doses list */}
      {todayRecords.length === 0 ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No MAR entries for today. Entries are created when medications are ordered.</div> :
      <div>
        <h3 className="text-xs text-gray-500 font-medium mb-2">Today's Doses ({todayRecords.length})</h3>
        <div className="space-y-1.5">{todayRecords.map((r: any) => (
          <div key={r.id} className={`bg-white rounded-lg border p-2.5 flex items-center justify-between ${r.status === 'scheduled' ? 'border-yellow-200' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${stColor(r.status)}`}>{r.status === 'given' ? '✓' : r.status === 'held' ? 'H' : r.status === 'missed' ? '✗' : '⏱'}</span>
              <div>
                <div className="font-medium text-sm">{r.medication?.drug_name || 'Unknown'} <span className="text-gray-400 font-normal">{r.medication?.dose}</span></div>
                <div className="text-[10px] text-gray-500">
                  <span className={`px-1 py-0.5 rounded ${routeColor(r.medication?.route)}`}>{r.medication?.route?.toUpperCase()}</span>
                  <span className="ml-1">{new Date(r.scheduled_time || r.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                  {r.administered_by_name && <span className="ml-2 text-green-600">by {r.administered_by_name}</span>}
                  {r.hold_reason && <span className="ml-2 text-yellow-700">Reason: {r.hold_reason}</span>}
                </div>
              </div>
            </div>
            {r.status === 'scheduled' && (
              holdId === r.id ? (
                <div className="flex items-center gap-1">
                  <select value={holdReason} onChange={e => setHoldReason(e.target.value)} className="text-[10px] border rounded px-1.5 py-1 max-w-[150px]">
                    <option value="">Hold reason...</option>
                    {HOLD_REASONS.map(hr => <option key={hr}>{hr}</option>)}
                  </select>
                  <button onClick={async () => { if (holdReason) { await onHold(r.id, holdReason); setHoldId(''); setHoldReason(''); onFlash('Dose held'); } }} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">Hold</button>
                  <button onClick={() => setHoldId('')} className="text-[10px] text-gray-400">✕</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button onClick={async () => { await onAdminister(r.id, staffId); onFlash('Dose administered ✓'); }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Give ✓</button>
                  <button onClick={() => setHoldId(r.id)}
                    className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs hover:bg-yellow-200">Hold</button>
                </div>
              )
            )}
          </div>
        ))}</div>
      </div>}

      {/* 5 Rights reminder */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div className="text-xs font-medium text-blue-700 mb-1">5 Rights of Medication Administration</div>
        <div className="flex gap-3 text-[10px] text-blue-600">
          <span>✓ Right Patient</span><span>✓ Right Drug</span><span>✓ Right Dose</span><span>✓ Right Route</span><span>✓ Right Time</span>
        </div>
      </div>
    </div>
  );
}
