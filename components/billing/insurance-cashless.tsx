// components/billing/insurance-cashless.tsx
'use client';
import React, { useState, useMemo } from 'react';

interface Props {
  claims: any[]; loading: boolean; stats: any; centreId: string; staffId: string;
  onInitPreAuth: (data: any, staffId: string) => Promise<void>;
  onUpdateStatus: (claimId: string, status: string, data?: any) => Promise<void>;
  onLoad: (filters?: any) => void; onFlash: (m: string) => void;
}

const CLAIM_STATUSES = ['preauth_initiated','preauth_submitted','preauth_approved','preauth_rejected','preauth_enhancement','admitted','claim_submitted','query_raised','query_responded','approved','partially_approved','settled','rejected','cancelled'];
const STATUS_FLOW: Record<string, string[]> = {
  preauth_initiated: ['preauth_submitted','cancelled'],
  preauth_submitted: ['preauth_approved','preauth_rejected','query_raised'],
  preauth_approved: ['admitted','preauth_enhancement'],
  preauth_rejected: ['preauth_submitted','cancelled'],
  preauth_enhancement: ['preauth_approved','preauth_rejected'],
  admitted: ['claim_submitted'],
  claim_submitted: ['approved','partially_approved','query_raised','rejected'],
  query_raised: ['query_responded'],
  query_responded: ['approved','partially_approved','rejected'],
  approved: ['settled'],
  partially_approved: ['settled'],
};

export default function InsuranceCashless({ claims, loading, stats, centreId, staffId, onInitPreAuth, onUpdateStatus, onLoad, onFlash }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [approvedAmt, setApprovedAmt] = useState('');
  const [settledAmt, setSettledAmt] = useState('');
  const [tdsAmt, setTdsAmt] = useState('');
  const [disallowReason, setDisallowReason] = useState('');

  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const stColor = (s: string) => {
    if (s?.includes('approved') || s === 'settled') return 'bg-green-100 text-green-700';
    if (s?.includes('rejected') || s === 'cancelled') return 'bg-red-100 text-red-700';
    if (s?.includes('query') || s?.includes('enhancement')) return 'bg-yellow-100 text-yellow-700';
    if (s?.includes('submitted') || s === 'admitted') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  const filteredClaims = statusFilter === 'all' ? claims : claims.filter(c => c.status === statusFilter);
  const nextStatuses = selectedClaim ? (STATUS_FLOW[selectedClaim.status] || []) : [];

  const updateClaim = async () => {
    if (!selectedClaim || !newStatus) return;
    const data: any = {};
    if (approvedAmt) data.approved_amount = parseFloat(approvedAmt);
    if (settledAmt) data.settled_amount = parseFloat(settledAmt);
    if (tdsAmt) data.tds_amount = parseFloat(tdsAmt);
    if (disallowReason) data.disallowance_reason = disallowReason;
    if (statusNote) data.remarks = statusNote;
    await onUpdateStatus(selectedClaim.id, newStatus, data);
    setSelectedClaim(null); setNewStatus(''); setStatusNote(''); setApprovedAmt(''); setSettledAmt(''); setTdsAmt(''); setDisallowReason('');
    onFlash(`Claim updated: ${newStatus.replace('_',' ')}`);
  };

  return (
    <div className="space-y-4">
      {/* Pipeline stats */}
      <div className="grid grid-cols-6 gap-2">
        {[['Pre-Auth', stats.preauth, 'bg-blue-50 text-blue-700'], ['Approved', stats.approved, 'bg-green-50 text-green-700'], ['Pending', stats.pending, 'bg-yellow-50 text-yellow-700'],
          ['Settled', stats.settled, 'bg-green-50 text-green-700'], ['Rejected', stats.rejected, 'bg-red-50 text-red-700'],
          ['Claimed ₹', stats.totalClaimed, 'bg-gray-50 text-gray-700']].map(([label, val, cls], i) => (
          <div key={i} className={`rounded-xl border p-2.5 text-center ${cls}`}><div className="text-[10px]">{label as string}</div><div className="text-lg font-bold">{typeof val === 'number' && val > 999 ? `₹${fmt(val)}` : val}</div></div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {['all','preauth_initiated','preauth_submitted','preauth_approved','admitted','claim_submitted','query_raised','approved','settled','rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); onLoad({ status: s }); }}
            className={`px-2 py-1 rounded text-[10px] border ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{s === 'all' ? 'All' : s.replace(/_/g,' ')}</button>
        ))}
      </div>

      {/* Selected claim detail */}
      {selectedClaim && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{selectedClaim.patient?.first_name} {selectedClaim.patient?.last_name} <span className="text-gray-400 text-xs">{selectedClaim.patient?.uhid}</span></div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="font-mono text-gray-400">{selectedClaim.claim_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(selectedClaim.status)}`}>{selectedClaim.status?.replace(/_/g,' ')}</span>
              <span>{selectedClaim.insurer?.name}</span>
              {selectedClaim.tpa?.name && <span className="text-gray-400">via {selectedClaim.tpa.name}</span>}
            </div>
          </div>
          <button onClick={() => setSelectedClaim(null)} className="text-xs text-gray-500">✕ Close</button>
        </div>

        <div className="grid grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
          <div><span className="text-gray-500">Claimed:</span> <span className="font-bold">₹{fmt(selectedClaim.claimed_amount)}</span></div>
          <div><span className="text-gray-500">Approved:</span> <span className="font-bold text-green-700">{selectedClaim.approved_amount ? `₹${fmt(selectedClaim.approved_amount)}` : '—'}</span></div>
          <div><span className="text-gray-500">Settled:</span> <span className="font-bold text-blue-700">{selectedClaim.settled_amount ? `₹${fmt(selectedClaim.settled_amount)}` : '—'}</span></div>
          <div><span className="text-gray-500">Bill:</span> <span className="font-mono">{selectedClaim.bill?.bill_number || '—'}</span></div>
        </div>

        {/* Status update */}
        {nextStatuses.length > 0 && <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-blue-700">Update Status</div>
          <div className="flex gap-1.5">{nextStatuses.map(s => (
            <button key={s} onClick={() => setNewStatus(s)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${newStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{s.replace(/_/g,' ')}</button>
          ))}</div>
          {(newStatus === 'approved' || newStatus === 'partially_approved') && <div className="grid grid-cols-2 gap-2 mt-2">
            <div><label className="text-[10px] text-gray-500">Approved amount</label>
              <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Disallowance reason</label>
              <input type="text" value={disallowReason} onChange={e => setDisallowReason(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="If partial..." /></div>
          </div>}
          {newStatus === 'settled' && <div className="grid grid-cols-3 gap-2 mt-2">
            <div><label className="text-[10px] text-gray-500">Settled amount *</label>
              <input type="number" value={settledAmt} onChange={e => setSettledAmt(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">TDS deducted</label>
              <input type="number" value={tdsAmt} onChange={e => setTdsAmt(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Disallowance</label>
              <input type="text" value={disallowReason} onChange={e => setDisallowReason(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          </div>}
          <div className="flex gap-2 mt-2">
            <input type="text" value={statusNote} onChange={e => setStatusNote(e.target.value)} className="flex-1 px-2 py-1.5 border rounded text-sm" placeholder="Notes / remarks..." />
            <button onClick={updateClaim} disabled={!newStatus} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">Update</button>
          </div>
        </div>}

        {/* NHCX Integration */}
        <NHCXActions claim={selectedClaim} onFlash={onFlash} />
      </div>}

      {/* Claims table */}
      {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading...</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Claim #</th><th className="p-2 text-left">Patient</th><th className="p-2">Insurer</th><th className="p-2">TPA</th><th className="p-2 text-right">Claimed</th><th className="p-2 text-right">Approved</th><th className="p-2 text-right">Settled</th><th className="p-2">Status</th><th className="p-2">Days</th>
      </tr></thead><tbody>{filteredClaims.map(c => {
        const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
        return <tr key={c.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedClaim(c)}>
          <td className="p-2 font-mono text-[10px]">{c.claim_number}</td>
          <td className="p-2 font-medium">{c.patient?.first_name} {c.patient?.last_name} <span className="text-[10px] text-gray-400">{c.patient?.uhid}</span></td>
          <td className="p-2 text-center text-[10px]">{c.insurer?.name || '—'}</td>
          <td className="p-2 text-center text-[10px]">{c.tpa?.name || '—'}</td>
          <td className="p-2 text-right">₹{fmt(c.claimed_amount)}</td>
          <td className="p-2 text-right text-green-600">{c.approved_amount ? `₹${fmt(c.approved_amount)}` : '—'}</td>
          <td className="p-2 text-right text-blue-600">{c.settled_amount ? `₹${fmt(c.settled_amount)}` : '—'}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(c.status)}`}>{c.status?.replace(/_/g,' ')}</span></td>
          <td className={`p-2 text-center ${days > 30 ? 'text-red-600 font-bold' : days > 15 ? 'text-yellow-600' : ''}`}>{days}d</td>
        </tr>;
      })}</tbody></table></div>}
    </div>
  );
}

// ============================================================
// NHCX ACTIONS — Submit claims to National Health Claims Exchange
// ============================================================
function NHCXActions({ claim, onFlash }: { claim: any; onFlash: (m: string) => void }) {
  const [nhcxLoading, setNhcxLoading] = useState(false);
  const [nhcxResult, setNhcxResult] = useState<any>(null);

  const canCheckEligibility = claim.status === 'preauth_initiated';
  const canSubmitPreAuth = ['preauth_initiated', 'preauth_submitted'].includes(claim.status);
  const canSubmitClaim = ['admitted', 'claim_submitted'].includes(claim.status);
  const hasNhcxId = !!claim.nhcx_correlation_id;

  const callNHCX = async (action: string) => {
    setNhcxLoading(true); setNhcxResult(null);
    try {
      const res = await fetch('/api/nhcx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          claimId: claim.id,
          patientId: claim.patient_id || claim.patient?.id,
          insurerId: claim.insurer_id,
          tpaId: claim.tpa_id,
        }),
      });
      const data = await res.json();
      setNhcxResult(data);
      if (data.success) {
        onFlash(`NHCX ${action.replace('_', ' ')}: Submitted successfully`);
      } else {
        onFlash(`NHCX Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setNhcxResult({ success: false, error: err.message });
      onFlash('NHCX connection failed');
    }
    setNhcxLoading(false);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🇮🇳</span>
          <span className="text-xs font-semibold text-indigo-700">NHCX — National Health Claims Exchange</span>
        </div>
        {hasNhcxId && <span className="text-[10px] font-mono text-indigo-500 bg-white px-2 py-0.5 rounded border">ID: {claim.nhcx_correlation_id?.substring(0, 12)}...</span>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {canCheckEligibility && <button onClick={() => callNHCX('coverage_check')} disabled={nhcxLoading}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-indigo-700">
          {nhcxLoading ? 'Sending...' : 'Check Eligibility via NHCX'}
        </button>}

        {canSubmitPreAuth && <button onClick={() => callNHCX('preauth_submit')} disabled={nhcxLoading}
          className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-purple-700">
          {nhcxLoading ? 'Submitting...' : 'Submit Pre-Auth to NHCX'}
        </button>}

        {canSubmitClaim && <button onClick={() => callNHCX('claim_submit')} disabled={nhcxLoading}
          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-green-700">
          {nhcxLoading ? 'Submitting...' : 'Submit Final Claim to NHCX'}
        </button>}

        {!canCheckEligibility && !canSubmitPreAuth && !canSubmitClaim && (
          <span className="text-[10px] text-gray-500">No NHCX actions available for current status ({claim.status?.replace(/_/g, ' ')})</span>
        )}
      </div>

      {nhcxResult && <div className={`rounded-lg p-2 text-xs ${nhcxResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {nhcxResult.success ? (
          <div>
            <span className="font-medium">Submitted to NHCX gateway.</span>
            {nhcxResult.correlationId && <span className="ml-2 font-mono text-[10px]">Correlation: {nhcxResult.correlationId}</span>}
            {nhcxResult.apiCallId && <span className="ml-2 font-mono text-[10px]">API Call: {nhcxResult.apiCallId}</span>}
            <div className="mt-1 text-[10px]">Response will arrive asynchronously via callback. Auto-updates claim status when insurer responds.</div>
          </div>
        ) : (
          <div><span className="font-medium">Failed:</span> {nhcxResult.error}</div>
        )}
      </div>}

      {claim.nhcx_submitted_at && <div className="text-[10px] text-indigo-500">
        Last NHCX submission: {new Date(claim.nhcx_submitted_at).toLocaleString('en-IN')}
        {claim.nhcx_responded_at && <span className="ml-2">| Response: {new Date(claim.nhcx_responded_at).toLocaleString('en-IN')}</span>}
      </div>}

      <div className="text-[9px] text-gray-400">
        FHIR R4 | HCX Protocol v0.9 | DHIS incentive: ₹500/claim | Sandbox: hcxbeta.nha.gov.in
      </div>
    </div>
  );
}