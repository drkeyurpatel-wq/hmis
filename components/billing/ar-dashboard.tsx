// components/billing/ar-dashboard.tsx
'use client';
import React, { useState } from 'react';

interface Props { entries: any[]; stats: any; loading: boolean; onFollowup: (arId: string, data: any, staffId: string) => Promise<void>; onWriteOff: (arId: string, amount: number, staffId: string) => Promise<void>; staffId: string; onFlash: (m: string) => void; }

const AR_TYPES = ['insurance_cashless','insurance_reimbursement','corporate_credit','govt_pmjay','govt_cghs','govt_echs','patient_credit'];
const BUCKETS = ['current','30','60','90','120','180','365','bad_debt'];
const FOLLOWUP_TYPES = ['call','email','letter','legal_notice','visit','portal_check','escalation'];

export default function ARDashboard({ entries, stats, loading, onFollowup, onWriteOff, staffId, onFlash }: Props) {
  const [filter, setFilter] = useState({ arType: 'all', status: 'all', bucket: 'all' });
  const [followupId, setFollowupId] = useState('');
  const [fuForm, setFuForm] = useState({ followup_type: 'call', contact_person: '', response: '', next_action: '', next_followup_date: '' });
  const [woId, setWoId] = useState('');
  const [woAmt, setWoAmt] = useState('');
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const stColor = (s: string) => s === 'open' ? 'bg-yellow-100 text-yellow-700' : s === 'partial' ? 'bg-blue-100 text-blue-700' : s === 'settled' ? 'bg-green-100 text-green-700' : s === 'written_off' ? 'bg-gray-100 text-gray-500' : s === 'disputed' ? 'bg-red-100 text-red-700' : 'bg-gray-100';
  const bucketColor = (b: string) => b === 'current' ? 'bg-green-100 text-green-700' : b === '30' ? 'bg-yellow-100 text-yellow-700' : b === '60' ? 'bg-orange-100 text-orange-700' : ['90','120'].includes(b) ? 'bg-red-100 text-red-700' : 'bg-red-200 text-red-800';

  const filtered = entries.filter(e => {
    if (filter.arType !== 'all' && e.ar_type !== filter.arType) return false;
    if (filter.status !== 'all' && e.status !== filter.status) return false;
    if (filter.bucket !== 'all' && e.aging_bucket !== filter.bucket) return false;
    return true;
  });

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Open Entries</div><div className="text-xl font-bold">{stats.totalOpen}</div></div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div className="text-[10px] text-red-600">Total Outstanding</div><div className="text-xl font-bold text-red-700">₹{fmt(stats.totalOutstanding)}</div></div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 text-center"><div className="text-[10px] text-orange-600">Overdue (90+ days)</div><div className="text-xl font-bold text-orange-700">₹{fmt(stats.overdue90)}</div></div>
        <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-500 mb-1">By Type</div>
          {Object.entries(stats.byType || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([t, v]: any) => (
            <div key={t} className="flex justify-between text-[10px]"><span className="text-gray-600">{t.replace('_',' ')}</span><span className="font-bold">₹{fmt(v)}</span></div>
          ))}</div>
      </div>

      {/* Aging buckets */}
      <div className="flex gap-2 mb-4">{BUCKETS.map(b => {
        const amt = (stats.byBucket || {})[b] || 0;
        return <div key={b} className={`flex-1 rounded-lg p-2 text-center ${amt > 0 ? bucketColor(b) : 'bg-gray-50 text-gray-300'}`}>
          <div className="text-[9px] font-medium">{b === 'current' ? '0-30d' : b === 'bad_debt' ? 'Bad Debt' : `${b}d`}</div>
          <div className="text-sm font-bold">{amt > 0 ? `₹${fmt(amt)}` : '—'}</div>
        </div>;
      })}</div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <select value={filter.arType} onChange={e => setFilter(f => ({...f, arType: e.target.value}))} className="px-2 py-1.5 border rounded-lg text-xs"><option value="all">All Types</option>{AR_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select>
        <select value={filter.status} onChange={e => setFilter(f => ({...f, status: e.target.value}))} className="px-2 py-1.5 border rounded-lg text-xs"><option value="all">All Status</option>{['open','partial','settled','written_off','disputed','legal'].map(s => <option key={s}>{s}</option>)}</select>
        <select value={filter.bucket} onChange={e => setFilter(f => ({...f, bucket: e.target.value}))} className="px-2 py-1.5 border rounded-lg text-xs"><option value="all">All Aging</option>{BUCKETS.map(b => <option key={b} value={b}>{b === 'current' ? '0-30d' : b === 'bad_debt' ? 'Bad Debt' : `${b}+ days`}</option>)}</select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} entries</span>
      </div>

      {/* AR entries */}
      {filtered.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No AR entries</div> :
      <div className="space-y-2">{filtered.map(e => (
        <div key={e.id} className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{e.patient?.first_name} {e.patient?.last_name}</span>
              <span className="text-xs text-gray-400">{e.patient?.uhid}</span>
              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{e.ar_type?.replace('_',' ')}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(e.status)}`}>{e.status}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${bucketColor(e.aging_bucket || 'current')}`}>{e.aging_bucket || 'current'}</span>
            </div>
            <div className="text-right text-xs">
              <div>Original: ₹{fmt(e.original_amount)}</div>
              <div className={`font-bold ${parseFloat(e.balance_amount) > 0 ? 'text-red-700' : 'text-green-700'}`}>Balance: ₹{fmt(e.balance_amount)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            {e.bill?.bill_number && <span>Bill: {e.bill.bill_number}</span>}
            {e.corporate?.company_name && <span>Corp: {e.corporate.company_name}</span>}
            {e.due_date && <span>Due: {e.due_date}</span>}
            {e.last_followup_date && <span>Last F/U: {e.last_followup_date}</span>}
          </div>

          {/* Follow-up form */}
          {followupId === e.id && <div className="mt-2 bg-blue-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-[10px] text-gray-500">Type</label>
                <div className="flex flex-wrap gap-0.5 mt-0.5">{FOLLOWUP_TYPES.map(t => (
                  <button key={t} onClick={() => setFuForm(f => ({...f, followup_type: t}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${fuForm.followup_type === t ? 'bg-blue-600 text-white' : 'bg-white'}`}>{t}</button>
                ))}</div></div>
              <div><label className="text-[10px] text-gray-500">Contact Person</label>
                <input type="text" value={fuForm.contact_person} onChange={ev => setFuForm(f => ({...f, contact_person: ev.target.value}))} className="w-full px-2 py-1 border rounded text-xs" /></div>
              <div><label className="text-[10px] text-gray-500">Next Follow-up</label>
                <input type="date" value={fuForm.next_followup_date} onChange={ev => setFuForm(f => ({...f, next_followup_date: ev.target.value}))} className="w-full px-2 py-1 border rounded text-xs" /></div>
            </div>
            <div><label className="text-[10px] text-gray-500">Response / Notes</label>
              <input type="text" value={fuForm.response} onChange={ev => setFuForm(f => ({...f, response: ev.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="What was the response?" /></div>
            <div className="flex gap-2">
              <button onClick={async () => { await onFollowup(e.id, fuForm, staffId); setFollowupId(''); onFlash('Follow-up logged'); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded">Save Follow-up</button>
              <button onClick={() => setFollowupId('')} className="px-3 py-1.5 bg-gray-100 text-xs rounded">Cancel</button>
            </div>
          </div>}

          {/* Write-off form */}
          {woId === e.id && <div className="mt-2 bg-red-50 rounded-lg p-3 flex gap-2 items-end">
            <div><label className="text-[10px] text-gray-500">Write-off Amount</label>
              <input type="number" value={woAmt} onChange={ev => setWoAmt(ev.target.value)} className="w-32 px-2 py-1.5 border rounded text-xs" placeholder={`Max: ₹${fmt(e.balance_amount)}`} /></div>
            <button onClick={async () => { if (!woAmt) return; await onWriteOff(e.id, parseFloat(woAmt), staffId); setWoId(''); setWoAmt(''); onFlash('Written off'); }} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded">Write Off</button>
            <button onClick={() => setWoId('')} className="px-3 py-1.5 bg-gray-100 text-xs rounded">Cancel</button>
          </div>}

          {followupId !== e.id && woId !== e.id && e.status !== 'settled' && e.status !== 'written_off' && (
            <div className="mt-2 flex gap-1">
              <button onClick={() => setFollowupId(e.id)} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded">Log Follow-up</button>
              <button onClick={() => setWoId(e.id)} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded">Write Off</button>
            </div>
          )}
        </div>
      ))}</div>}
    </div>
  );
}
