// components/billing/cashless-workflow.tsx
'use client';
import React, { useState } from 'react';

interface Props { preAuths: any[]; claims: any[]; stats: any; loading: boolean; onUpdatePreAuth: (id: string, update: any) => Promise<void>; onUpdateClaim: (id: string, update: any) => Promise<void>; onFlash: (m: string) => void; }

const PA_STATUS_COLOR: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', query: 'bg-orange-100 text-orange-700', enhancement_pending: 'bg-blue-100 text-blue-700' };
const CL_STATUS_COLOR: Record<string, string> = { submitted: 'bg-yellow-100 text-yellow-700', under_review: 'bg-blue-100 text-blue-700', query: 'bg-orange-100 text-orange-700', approved: 'bg-green-100 text-green-700', settled: 'bg-green-200 text-green-800', rejected: 'bg-red-100 text-red-700', appealed: 'bg-purple-100 text-purple-700' };

export default function CashlessWorkflow({ preAuths, claims, stats, loading, onUpdatePreAuth, onUpdateClaim, onFlash }: Props) {
  const [subTab, setSubTab] = useState<'preauth'|'claims'>('preauth');
  const [editPA, setEditPA] = useState<string | null>(null);
  const [editCL, setEditCL] = useState<string | null>(null);
  const [paForm, setPaForm] = useState({ status: '', approvedAmount: '', preAuthNumber: '', remarks: '' });
  const [clForm, setClForm] = useState({ status: '', approvedAmount: '', settledAmount: '', tdsAmount: '', disallowanceAmount: '', disallowanceReason: '', utrNumber: '' });
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-2 text-center"><div className="text-[10px] text-yellow-600">Pre-Auth Pending</div><div className="text-xl font-bold text-yellow-700">{stats.pendingPreAuths}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-2 text-center"><div className="text-[10px] text-green-600">Pre-Auth Approved</div><div className="text-xl font-bold text-green-700">{stats.approvedPreAuths}</div></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-2 text-center"><div className="text-[10px] text-blue-600">Claims Pending</div><div className="text-xl font-bold text-blue-700">{stats.pendingClaims}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-2 text-center"><div className="text-[10px] text-green-600">Claims Settled</div><div className="text-xl font-bold text-green-700">{stats.settledClaims}</div></div>
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[10px] text-gray-500">Total Claimed</div><div className="text-lg font-bold">₹{fmt(stats.totalClaimed)}</div></div>
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[10px] text-gray-500">Total Settled</div><div className="text-lg font-bold text-green-700">₹{fmt(stats.totalSettled)}</div></div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-3">{[['preauth','Pre-Authorizations ('+preAuths.length+')'],['claims','Claims ('+claims.length+')']].map(([k,l]) => (
        <button key={k} onClick={() => setSubTab(k as any)} className={`px-4 py-2 rounded-lg text-xs font-medium ${subTab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
      ))}</div>

      {/* Pre-Auth List */}
      {subTab === 'preauth' && <div className="space-y-2">
        {preAuths.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No pre-authorization requests</div> :
        preAuths.map(pa => (
          <div key={pa.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{pa.admission?.patient?.first_name} {pa.admission?.patient?.last_name}</span>
                <span className="text-xs text-gray-400">{pa.admission?.patient?.uhid}</span>
                <span className="font-mono text-xs text-gray-400">{pa.admission?.ipd_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${PA_STATUS_COLOR[pa.status] || 'bg-gray-100'}`}>{pa.status?.replace('_',' ')}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">Requested: ₹{fmt(pa.requested_amount)}</div>
                {pa.approved_amount && <div className="text-xs text-green-600">Approved: ₹{fmt(pa.approved_amount)}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">{pa.insurance?.insurer?.name}</span>
              {pa.insurance?.tpa?.name && <span className="bg-purple-50 px-1.5 py-0.5 rounded text-purple-700">TPA: {pa.insurance.tpa.name}</span>}
              {pa.insurance?.scheme && <span className="bg-green-50 px-1.5 py-0.5 rounded text-green-700">{pa.insurance.scheme.toUpperCase()}</span>}
              <span>Policy: {pa.insurance?.policy_number}</span>
              {pa.pre_auth_number && <span className="font-mono">PA#: {pa.pre_auth_number}</span>}
              <span>{new Date(pa.submitted_at).toLocaleDateString('en-IN')}</span>
            </div>
            {pa.remarks && <div className="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-1.5">{pa.remarks}</div>}

            {/* Update form */}
            {editPA === pa.id ? (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div><label className="text-[10px] text-gray-500">Status</label>
                    <select value={paForm.status} onChange={e => setPaForm(f => ({...f, status: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
                      <option value="">Select...</option>{['approved','rejected','query','enhancement_pending'].map(s => <option key={s}>{s.replace('_',' ')}</option>)}</select></div>
                  <div><label className="text-[10px] text-gray-500">Approved Amount</label>
                    <input type="number" value={paForm.approvedAmount} onChange={e => setPaForm(f => ({...f, approvedAmount: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  <div><label className="text-[10px] text-gray-500">Pre-Auth #</label>
                    <input type="text" value={paForm.preAuthNumber} onChange={e => setPaForm(f => ({...f, preAuthNumber: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  <div><label className="text-[10px] text-gray-500">Remarks</label>
                    <input type="text" value={paForm.remarks} onChange={e => setPaForm(f => ({...f, remarks: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { await onUpdatePreAuth(pa.id, { status: paForm.status, approvedAmount: paForm.approvedAmount ? parseFloat(paForm.approvedAmount) : undefined, preAuthNumber: paForm.preAuthNumber, remarks: paForm.remarks }); setEditPA(null); onFlash('Pre-auth updated'); }} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Update</button>
                  <button onClick={() => setEditPA(null)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-1">{pa.status === 'pending' && <button onClick={() => { setEditPA(pa.id); setPaForm({ status: 'approved', approvedAmount: String(pa.requested_amount), preAuthNumber: '', remarks: '' }); }} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded">Approve</button>}
                {pa.status !== 'rejected' && <button onClick={() => setEditPA(pa.id)} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded">Update Status</button>}
                {pa.status === 'approved' && <button onClick={() => { setEditPA(pa.id); setPaForm({ status: 'enhancement_pending', approvedAmount: '', preAuthNumber: pa.pre_auth_number || '', remarks: 'Enhancement requested' }); }} className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] rounded">Enhancement</button>}
              </div>
            )}
          </div>
        ))}
      </div>}

      {/* Claims List */}
      {subTab === 'claims' && <div className="space-y-2">
        {claims.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No claims submitted</div> :
        claims.map(cl => (
          <div key={cl.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{cl.bill?.patient?.first_name} {cl.bill?.patient?.last_name}</span>
                <span className="text-xs text-gray-400">{cl.bill?.patient?.uhid}</span>
                <span className="font-mono text-xs">{cl.claim_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${CL_STATUS_COLOR[cl.status]}`}>{cl.status?.replace('_',' ')}</span>
                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{cl.claim_type}</span>
              </div>
              <div className="text-right text-xs">
                <div>Claimed: <b>₹{fmt(cl.claimed_amount)}</b></div>
                {cl.approved_amount && <div className="text-green-600">Approved: ₹{fmt(cl.approved_amount)}</div>}
                {cl.settled_amount && <div className="text-green-700 font-bold">Settled: ₹{fmt(cl.settled_amount)}</div>}
                {cl.disallowance_amount && parseFloat(cl.disallowance_amount) > 0 && <div className="text-red-600">Disallowed: ₹{fmt(cl.disallowance_amount)}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Bill: {cl.bill?.bill_number}</span>
              {cl.preauth?.pre_auth_number && <span>PA#: {cl.preauth.pre_auth_number}</span>}
              {cl.utr_number && <span className="text-green-600 font-mono">UTR: {cl.utr_number}</span>}
              {cl.tds_amount && parseFloat(cl.tds_amount) > 0 && <span>TDS: ₹{fmt(cl.tds_amount)}</span>}
              {cl.disallowance_reason && <span className="text-red-500 max-w-xs truncate">{cl.disallowance_reason}</span>}
            </div>

            {editCL === cl.id ? (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div><label className="text-[10px] text-gray-500">Status</label>
                    <select value={clForm.status} onChange={e => setClForm(f => ({...f, status: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
                      {['under_review','query','approved','settled','rejected','appealed'].map(s => <option key={s}>{s.replace('_',' ')}</option>)}</select></div>
                  <div><label className="text-[10px] text-gray-500">Settled Amount</label>
                    <input type="number" value={clForm.settledAmount} onChange={e => setClForm(f => ({...f, settledAmount: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  <div><label className="text-[10px] text-gray-500">TDS</label>
                    <input type="number" value={clForm.tdsAmount} onChange={e => setClForm(f => ({...f, tdsAmount: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  <div><label className="text-[10px] text-gray-500">UTR #</label>
                    <input type="text" value={clForm.utrNumber} onChange={e => setClForm(f => ({...f, utrNumber: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-gray-500">Disallowance (₹)</label>
                    <input type="number" value={clForm.disallowanceAmount} onChange={e => setClForm(f => ({...f, disallowanceAmount: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  <div><label className="text-[10px] text-gray-500">Disallowance Reason</label>
                    <input type="text" value={clForm.disallowanceReason} onChange={e => setClForm(f => ({...f, disallowanceReason: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { const upd: any = {}; if (clForm.status) upd.status = clForm.status; if (clForm.settledAmount) upd.settledAmount = parseFloat(clForm.settledAmount); if (clForm.tdsAmount) upd.tdsAmount = parseFloat(clForm.tdsAmount); if (clForm.disallowanceAmount) upd.disallowanceAmount = parseFloat(clForm.disallowanceAmount); if (clForm.disallowanceReason) upd.disallowanceReason = clForm.disallowanceReason; if (clForm.utrNumber) upd.utrNumber = clForm.utrNumber; await onUpdateClaim(cl.id, upd); setEditCL(null); onFlash('Claim updated'); }} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Update Claim</button>
                  <button onClick={() => setEditCL(null)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-1">
                <button onClick={() => { setEditCL(cl.id); setClForm({ status: cl.status, approvedAmount: cl.approved_amount || '', settledAmount: '', tdsAmount: '', disallowanceAmount: '', disallowanceReason: '', utrNumber: '' }); }} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded">Update</button>
                {cl.status === 'query' && <button onClick={() => { setEditCL(cl.id); setClForm({ ...clForm, status: 'under_review' }); }} className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] rounded">Resolve Query</button>}
              </div>
            )}
          </div>
        ))}
      </div>}
    </div>
  );
}
