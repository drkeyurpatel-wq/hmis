// components/billing/integration-hub.tsx
'use client';
import React, { useState } from 'react';

interface Props {
  entries: any[]; stats: { pending: number; synced: number; failed: number }; centreId: string; staffId: string;
  onPush: (source: string, target: string, entityType: string, entityId: string, syncData: any) => Promise<void>;
  onMarkSynced: (id: string, externalRef: string) => Promise<void>;
  onLoad: (source?: string) => void; onFlash: (m: string) => void;
}

const SYSTEMS = [
  { id: 'vpms', name: 'VPMS', desc: 'Vendor Payment Management', url: 'vendor app', icon: '🏢', color: 'bg-purple-100 text-purple-700',
    flows: ['Bill finalized → create payable in VPMS','Vendor payment → reconcile against bill','Purchase order → auto-charge consumables'] },
  { id: 'medpay', name: 'MedPay', desc: 'Doctor Payout System', url: 'medpay.drkeyurpatel.workers.dev', icon: '👨‍⚕️', color: 'bg-blue-100 text-blue-700',
    flows: ['Professional fee item → doctor payout entry','IPD bill → split surgeon/anaesthetist/assistant fees','Monthly reconciliation report'] },
  { id: 'cashflow', name: 'CashFlow', desc: 'Daily Financial Tracking', url: 'h1cashflow.drkeyurpatel.workers.dev', icon: '💰', color: 'bg-green-100 text-green-700',
    flows: ['Daily collection → push to CashFlow centre income','Payment mode split → cash/UPI/card breakup','Insurance settlement → push to CashFlow receivable'] },
  { id: 'tally', name: 'Tally', desc: 'Accounting Integration', url: 'Tally ERP', icon: '📊', color: 'bg-orange-100 text-orange-700',
    flows: ['Bill finalized → journal entry','Payment collected → receipt voucher','Advance collected → advance receipt voucher','Refund → credit note + payment voucher'] },
];

const ENTITY_TYPES = ['bill','payment','advance','refund','settlement','doctor_payout','vendor_payment','daily_collection'];

export default function IntegrationHub({ entries, stats, centreId, staffId, onPush, onMarkSynced, onLoad, onFlash }: Props) {
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [extRef, setExtRef] = useState('');

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const syncColor = (s: string) => s === 'synced' ? 'bg-green-100 text-green-700' : s === 'failed' ? 'bg-red-100 text-red-700' : s === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 mb-2">
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 text-center"><div className="text-[10px] text-yellow-600">Pending Sync</div><div className="text-2xl font-bold text-yellow-700">{stats.pending}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div className="text-[10px] text-green-600">Synced</div><div className="text-2xl font-bold text-green-700">{stats.synced}</div></div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div className="text-[10px] text-red-600">Failed</div><div className="text-2xl font-bold text-red-700">{stats.failed}</div></div>
      </div>

      {/* System cards */}
      <div className="grid grid-cols-2 gap-3">
        {SYSTEMS.map(sys => {
          const sysEntries = entries.filter(e => e.source_system === sys.id || e.target_system === sys.id);
          const pending = sysEntries.filter(e => e.sync_status === 'pending').length;
          return <div key={sys.id} className="bg-white rounded-xl border p-4" onClick={() => { setSourceFilter(sys.id); onLoad(sys.id); }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><span className="text-xl">{sys.icon}</span><div><div className="font-semibold text-sm">{sys.name}</div><div className="text-[10px] text-gray-400">{sys.desc}</div></div></div>
              {pending > 0 && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">{pending} pending</span>}
            </div>
            <div className="text-[10px] text-gray-500 space-y-0.5">{sys.flows.map((f, i) => <div key={i}>→ {f}</div>)}</div>
            <div className="mt-2 text-[10px] text-gray-400">{sys.url}</div>
          </div>;
        })}
      </div>

      {/* Sync queue */}
      <h3 className="text-sm font-semibold">Sync Queue {sourceFilter && <span className="text-gray-400 font-normal">— {sourceFilter}</span>}</h3>
      {entries.length === 0 ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No integration entries</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Source → Target</th><th className="p-2">Entity</th><th className="p-2">ID</th><th className="p-2">External Ref</th><th className="p-2">Status</th><th className="p-2">Time</th><th className="p-2">Action</th>
      </tr></thead><tbody>{entries.map(e => (
        <tr key={e.id} className="border-b hover:bg-gray-50">
          <td className="p-2"><span className="font-medium">{e.source_system}</span> → <span>{e.target_system}</span></td>
          <td className="p-2 text-center">{e.entity_type}</td>
          <td className="p-2 text-center font-mono text-[10px]">{e.entity_id?.substring(0, 8)}</td>
          <td className="p-2 text-center">{e.external_ref || '—'}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${syncColor(e.sync_status)}`}>{e.sync_status}</span></td>
          <td className="p-2 text-center text-[10px] text-gray-400">{e.synced_at ? new Date(e.synced_at).toLocaleDateString('en-IN') : '—'}</td>
          <td className="p-2 text-center">{e.sync_status === 'pending' && <button onClick={() => { setSelectedEntry(e); }} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">Mark Synced</button>}</td>
        </tr>
      ))}</tbody></table></div>}

      {/* Mark synced modal */}
      {selectedEntry && <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
        <span className="text-xs">External reference for {selectedEntry.entity_type}:</span>
        <input type="text" value={extRef} onChange={e => setExtRef(e.target.value)} className="px-2 py-1 border rounded text-xs" placeholder="e.g., Tally voucher #, VPMS PO#..." />
        <button onClick={async () => { await onMarkSynced(selectedEntry.id, extRef); setSelectedEntry(null); setExtRef(''); onFlash('Marked as synced'); }} className="px-3 py-1 bg-green-600 text-white text-xs rounded">Confirm</button>
        <button onClick={() => setSelectedEntry(null)} className="px-2 py-1 bg-gray-100 text-xs rounded">Cancel</button>
      </div>}
    </div>
  );
}
