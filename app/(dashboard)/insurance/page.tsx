'use client';
import React, { useState } from 'react';
import { useInsurance, type PreAuthRequest, type Claim } from '@/lib/revenue/phase2-hooks';
import { useAuthStore } from '@/lib/store/auth';

export default function InsurancePage() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { preAuths, claims, loading, loadPreAuths, loadClaims, updatePreAuth } = useInsurance(centreId);
  const [tab, setTab] = useState<'preauth'|'claims'>('preauth');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPA, setSelectedPA] = useState<PreAuthRequest | null>(null);
  const [paForm, setPaForm] = useState({ approvedAmount: '', preAuthNumber: '', remarks: '' });

  const handleUpdatePA = async (status: string) => {
    if (!selectedPA) return;
    await updatePreAuth(selectedPA.id, { status, approvedAmount: paForm.approvedAmount ? parseFloat(paForm.approvedAmount) : undefined, preAuthNumber: paForm.preAuthNumber || undefined, remarks: paForm.remarks || undefined });
    setSelectedPA(null); setPaForm({ approvedAmount: '', preAuthNumber: '', remarks: '' });
  };

  const stColor = (s: string) => s === 'pending' ? 'bg-yellow-100 text-yellow-800' : s === 'approved' ? 'bg-green-100 text-green-800' : s === 'rejected' ? 'bg-red-100 text-red-800' : s === 'query' ? 'bg-purple-100 text-purple-800' : s === 'settled' ? 'bg-green-100 text-green-800' : s === 'submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';
  const pendingPA = preAuths.filter(p => p.status === 'pending').length;
  const approvedPA = preAuths.filter(p => p.status === 'approved').length;
  const totalApproved = preAuths.filter(p => p.approvedAmount).reduce((s, p) => s + (p.approvedAmount || 0), 0);
  const totalClaimed = claims.reduce((s, c) => s + c.claimedAmount, 0);
  const totalSettled = claims.reduce((s, c) => s + (c.settledAmount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Insurance & TPA</h1><p className="text-sm text-gray-500">Pre-auth management and claims tracking</p></div>
      </div>

      <div className="flex gap-2 mb-6">{[['preauth','Pre-Auth Requests'],['claims','Claims']].map(([k,l]) =>
        <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm rounded-lg border ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
      )}</div>

      {tab === 'preauth' && <>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{pendingPA}</div></div>
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Approved</div><div className="text-2xl font-bold text-green-700">{approvedPA}</div></div>
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total approved amt</div><div className="text-2xl font-bold text-blue-700">Rs.{totalApproved.toLocaleString('en-IN')}</div></div>
          <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total requests</div><div className="text-2xl font-bold">{preAuths.length}</div></div>
        </div>

        <div className="flex gap-6">
          <div className="w-1/2">
            {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
            preAuths.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No pre-auth requests</div> :
            <div className="space-y-2">{preAuths.map(p => (
              <div key={p.id} onClick={() => { setSelectedPA(p); setPaForm({ approvedAmount: p.approvedAmount?.toString() || '', preAuthNumber: p.preAuthNumber || '', remarks: p.remarks || '' }); }}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-400 ${selectedPA?.id === p.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm">{p.patientName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${stColor(p.status)}`}>{p.status}</span></div>
                <div className="text-xs text-gray-400">{p.ipdNumber} | {p.insurerName}</div>
                <div className="flex justify-between mt-1"><span className="text-sm">Requested: Rs.{p.requestedAmount.toLocaleString('en-IN')}</span>
                  {p.approvedAmount && <span className="text-sm text-green-600">Approved: Rs.{p.approvedAmount.toLocaleString('en-IN')}</span>}</div>
              </div>
            ))}</div>}
          </div>
          <div className="w-1/2">
            {!selectedPA ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select a pre-auth to review</div> : (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-lg mb-2">{selectedPA.patientName}</h3>
                <div className="text-xs text-gray-400 mb-4">{selectedPA.ipdNumber} | {selectedPA.insurerName} | Submitted: {new Date(selectedPA.submittedAt).toLocaleDateString('en-IN')}</div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm"><div className="flex justify-between"><span className="text-gray-500">Requested</span><span className="font-bold">Rs.{selectedPA.requestedAmount.toLocaleString('en-IN')}</span></div></div>
                <div className="space-y-3">
                  <div><label className="text-xs text-gray-500">Pre-auth Number</label>
                    <input type="text" value={paForm.preAuthNumber} onChange={e => setPaForm(f => ({...f, preAuthNumber: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-500">Approved Amount</label>
                    <input type="number" value={paForm.approvedAmount} onChange={e => setPaForm(f => ({...f, approvedAmount: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-500">Remarks</label>
                    <textarea value={paForm.remarks} onChange={e => setPaForm(f => ({...f, remarks: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handleUpdatePA('approved')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Approve</button>
                    <button onClick={() => handleUpdatePA('rejected')} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg">Reject</button>
                    <button onClick={() => handleUpdatePA('query')} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg">Query</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {tab === 'claims' && <>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total claimed</div><div className="text-2xl font-bold text-blue-700">Rs.{totalClaimed.toLocaleString('en-IN')}</div></div>
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Settled</div><div className="text-2xl font-bold text-green-700">Rs.{totalSettled.toLocaleString('en-IN')}</div></div>
          <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Claims</div><div className="text-2xl font-bold">{claims.length}</div></div>
        </div>
        {claims.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400">No claims</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-3 font-medium text-gray-500">Claim #</th><th className="text-left p-3 font-medium text-gray-500">Patient</th>
          <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-right p-3 font-medium text-gray-500">Claimed</th>
          <th className="text-right p-3 font-medium text-gray-500">Approved</th><th className="text-right p-3 font-medium text-gray-500">Settled</th>
          <th className="text-left p-3 font-medium text-gray-500">Status</th>
        </tr></thead><tbody>{claims.map(c => (
          <tr key={c.id} className="border-b hover:bg-gray-50">
            <td className="p-3 font-mono text-xs text-blue-600">{c.claimNumber || '--'}</td>
            <td className="p-3">{c.patientName}</td><td className="p-3 text-xs">{c.claimType}</td>
            <td className="p-3 text-right">Rs.{c.claimedAmount.toLocaleString('en-IN')}</td>
            <td className="p-3 text-right">{c.approvedAmount ? 'Rs.' + c.approvedAmount.toLocaleString('en-IN') : '--'}</td>
            <td className="p-3 text-right text-green-600">{c.settledAmount ? 'Rs.' + c.settledAmount.toLocaleString('en-IN') : '--'}</td>
            <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${stColor(c.status)}`}>{c.status}</span></td>
          </tr>
        ))}</tbody></table></div>}
      </>}
    </div>
  );
}
