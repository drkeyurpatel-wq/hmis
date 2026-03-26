// components/billing/ar-management.tsx
'use client';
import React, { useState } from 'react';

interface Props {
  entries: any[]; loading: boolean; aging: Record<string, { count: number; amount: number }>; totalOutstanding: number;
  staffId: string;
  onAddFollowup: (arId: string, data: any, staffId: string) => Promise<void>;
  onWriteOff: (arId: string, amount: number, staffId: string) => Promise<void>;
  onLoad: (filters?: any) => void; onFlash: (m: string) => void;
}

const AR_TYPES = ['all','insurance_cashless','insurance_reimbursement','corporate_credit','govt_pmjay','govt_cghs','govt_echs','govt_esi','patient_credit'];
const FOLLOWUP_TYPES = ['call','email','letter','legal_notice','visit','portal_check','escalation'];
const AGING_BUCKETS = [['current','0-30d','bg-green-100 text-green-700'],['30','31-60d','bg-yellow-100 text-yellow-700'],['60','61-90d','bg-orange-100 text-orange-700'],['90','91-120d','bg-red-100 text-red-700'],['120','121-180d','bg-red-200 text-red-800'],['180','181-365d','bg-red-300 text-red-900'],['365','365+d','bg-gray-800 text-white'],['bad_debt','Bad Debt','bg-black text-white']];

export default function ARManagement({ entries, loading, aging, totalOutstanding, staffId, onAddFollowup, onWriteOff, onLoad, onFlash }: Props) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedAR, setSelectedAR] = useState<any>(null);
  const [followForm, setFollowForm] = useState({ followup_type: 'call', contact_person: '', response: '', next_action: '', next_followup_date: '' });
  const [woAmount, setWoAmount] = useState('');

  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const typeColor = (t: string) => t.includes('insurance') ? 'bg-h1-teal-light text-h1-teal' : t.includes('corporate') ? 'bg-h1-navy-light text-h1-navy' : t.includes('govt') ? 'bg-green-100 text-green-700' : t.includes('patient') ? 'bg-gray-100 text-gray-700' : 'bg-gray-100';
  const stColor = (s: string) => s === 'settled' ? 'bg-green-100 text-green-700' : s === 'written_off' ? 'bg-gray-100 text-gray-500' : s === 'disputed' ? 'bg-red-100 text-red-700' : s === 'legal' ? 'bg-red-200 text-red-800' : s === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';

  const saveFollowup = async () => {
    if (!selectedAR) return;
    await onAddFollowup(selectedAR.id, followForm, staffId);
    setFollowForm({ followup_type: 'call', contact_person: '', response: '', next_action: '', next_followup_date: '' });
    onFlash('Follow-up logged');
  };

  return (
    <div className="space-y-4">
      {/* Aging pyramid */}
      <div className="grid grid-cols-8 gap-2">
        {AGING_BUCKETS.map(([bucket, label, cls]) => {
          const data = aging[bucket] || { count: 0, amount: 0 };
          return <div key={bucket} className={`rounded-xl border p-2.5 text-center ${cls}`}>
            <div className="text-[10px] font-medium">{label}</div>
            <div className="text-lg font-bold">{data.count}</div>
            <div className="text-[10px]">₹{fmt(data.amount)}</div>
          </div>;
        })}
      </div>

      <div className="bg-red-50 rounded-xl border border-red-200 p-3 flex justify-between items-center">
        <span className="text-sm font-medium text-red-700">Total Outstanding Receivables</span>
        <span className="text-2xl font-bold text-red-700">₹{fmt(totalOutstanding)}</span>
      </div>

      {/* Type filter */}
      <div className="flex gap-1 flex-wrap">{AR_TYPES.map(t => (
        <button key={t} onClick={() => { setTypeFilter(t); onLoad({ arType: t }); }}
          className={`px-2 py-1 rounded text-[10px] border ${typeFilter === t ? 'bg-h1-navy text-white' : 'bg-white border-gray-200'}`}>{t === 'all' ? 'All Types' : t.replace(/_/g,' ').replace('govt ','')}</button>
      ))}</div>

      {/* Selected AR detail + follow-up */}
      {selectedAR && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold">{selectedAR.patient?.first_name} {selectedAR.patient?.last_name} <span className="text-xs text-gray-400">{selectedAR.patient?.uhid}</span></div>
            <div className="flex gap-2 text-xs mt-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${typeColor(selectedAR.ar_type)}`}>{selectedAR.ar_type?.replace(/_/g,' ')}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(selectedAR.status)}`}>{selectedAR.status}</span>
              {selectedAR.bill?.bill_number && <span className="font-mono text-gray-400">{selectedAR.bill.bill_number}</span>}
              {selectedAR.corporate?.company_name && <span className="text-h1-navy">{selectedAR.corporate.company_name}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Outstanding</div>
            <div className="text-xl font-bold text-red-700">₹{fmt(selectedAR.balance_amount)}</div>
            <div className="text-[10px] text-gray-400">Original: ₹{fmt(selectedAR.original_amount)} | Collected: ₹{fmt(selectedAR.collected_amount)}</div>
          </div>
        </div>

        {/* Log follow-up */}
        <div className="bg-h1-teal-light border border-h1-teal/20 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-h1-teal">Log Follow-up</div>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[10px] text-gray-500">Type</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{FOLLOWUP_TYPES.map(t => (
                <button key={t} onClick={() => setFollowForm(f => ({...f, followup_type: t}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${followForm.followup_type === t ? 'bg-h1-navy text-white' : 'bg-white'}`}>{t}</button>
              ))}</div></div>
            <div><label className="text-[10px] text-gray-500">Contact person</label>
              <input type="text" value={followForm.contact_person} onChange={e => setFollowForm(f => ({...f, contact_person: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[10px] text-gray-500">Response/Outcome</label>
              <input type="text" value={followForm.response} onChange={e => setFollowForm(f => ({...f, response: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[10px] text-gray-500">Next follow-up</label>
              <input type="date" value={followForm.next_followup_date} onChange={e => setFollowForm(f => ({...f, next_followup_date: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <input type="text" value={followForm.next_action} onChange={e => setFollowForm(f => ({...f, next_action: e.target.value}))} className="flex-1 px-2 py-1.5 border rounded text-xs" placeholder="Next action..." />
            <button onClick={saveFollowup} className="px-3 py-1.5 bg-h1-navy text-white text-xs rounded-lg">Log Follow-up</button>
          </div>
        </div>

        {/* Write-off */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
          <span className="text-xs text-gray-500">Write-off:</span>
          <input type="number" value={woAmount} onChange={e => setWoAmount(e.target.value)} className="w-24 px-2 py-1 border rounded text-xs" placeholder="₹ amount" />
          <button onClick={async () => { if (woAmount) { await onWriteOff(selectedAR.id, parseFloat(woAmount), staffId); setWoAmount(''); onFlash('Written off'); } }} className="px-3 py-1 bg-gray-600 text-white text-xs rounded">Write-off</button>
          <button onClick={() => setSelectedAR(null)} className="px-3 py-1 bg-gray-100 text-xs rounded ml-auto">Close</button>
        </div>
      </div>}

      {/* AR table */}
      {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading...</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Patient</th><th className="p-2">Type</th><th className="p-2">Bill</th><th className="p-2 text-right">Original</th><th className="p-2 text-right">Collected</th><th className="p-2 text-right">W/O</th><th className="p-2 text-right font-bold">Balance</th><th className="p-2">Aging</th><th className="p-2">Status</th><th className="p-2">Last F/U</th>
      </tr></thead><tbody>{entries.map(e => (
        <tr key={e.id} className="border-b hover:bg-h1-teal-light cursor-pointer" onClick={() => setSelectedAR(e)}>
          <td className="p-2 font-medium">{e.patient?.first_name} {e.patient?.last_name} <span className="text-[10px] text-gray-400">{e.patient?.uhid}</span></td>
          <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${typeColor(e.ar_type)}`}>{e.ar_type?.replace(/_/g,' ').replace('govt ','').substring(0,15)}</span></td>
          <td className="p-2 text-center font-mono text-[10px]">{e.bill?.bill_number || '—'}</td>
          <td className="p-2 text-right">₹{fmt(e.original_amount)}</td>
          <td className="p-2 text-right text-green-600">{parseFloat(e.collected_amount) > 0 ? `₹${fmt(e.collected_amount)}` : '—'}</td>
          <td className="p-2 text-right text-gray-400">{parseFloat(e.written_off_amount) > 0 ? `₹${fmt(e.written_off_amount)}` : '—'}</td>
          <td className="p-2 text-right font-bold text-red-700">₹{fmt(e.balance_amount)}</td>
          <td className="p-2 text-center">{e.aging_bucket ? <span className={`px-1 py-0.5 rounded text-[9px] ${AGING_BUCKETS.find(b => b[0] === e.aging_bucket)?.[2] || 'bg-gray-100'}`}>{e.aging_bucket}</span> : '—'}</td>
          <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${stColor(e.status)}`}>{e.status}</span></td>
          <td className="p-2 text-center text-[10px] text-gray-400">{e.last_followup_date || '—'}</td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}
