// @ts-nocheck
// HEALTH1 HMIS — PRE-AUTH DETAIL
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Send, MessageSquare, CheckCircle2, XCircle, AlertTriangle, Clock, Upload, FileText, Plus, IndianRupee, RefreshCw, Edit2, ChevronRight, TrendingUp, X } from 'lucide-react';
import type { PreAuth } from '@/lib/billing/billing-v2-types';
import { PREAUTH_STATUS_COLORS, PAYOR_TYPE_LABELS } from '@/lib/billing/billing-v2-types';

function StatusTimeline({ preAuth }: { preAuth: PreAuth }) {
  const steps = [
    { status: 'DRAFT', label: 'Draft', date: preAuth.created_at, icon: FileText },
    { status: 'SUBMITTED', label: 'Submitted', date: preAuth.submitted_at, icon: Send },
    { status: 'QUERY', label: 'Query', date: null, icon: MessageSquare },
    { status: 'APPROVED', label: 'Approved', date: preAuth.approval_date, icon: CheckCircle2 },
  ];
  const statusOrder = ['DRAFT', 'SUBMITTED', 'QUERY', 'APPROVED'];
  const currentIdx = statusOrder.indexOf(preAuth.status);
  return (<div className="flex items-center gap-1">
    {steps.map((step, idx) => {
      const isCompleted = idx < currentIdx || (preAuth.status === step.status && ['APPROVED','ENHANCED'].includes(preAuth.status));
      const isCurrent = preAuth.status === step.status;
      const isRejected = preAuth.status === 'REJECTED' && idx >= currentIdx;
      const StepIcon = step.icon;
      return (<div key={step.status} className="flex items-center">
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isCurrent ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : isRejected ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
          <StepIcon className="h-3 w-3" /> {step.label}
          {step.date && <span className="text-[9px] opacity-70">{new Date(step.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
        </div>
        {idx < steps.length - 1 && <div className={`w-6 h-0.5 ${isCompleted ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
      </div>);
    })}
  </div>);
}

export default function PreAuthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const preAuthId = params.preAuthId as string;
  const [preAuth, setPreAuth] = useState<PreAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [approvalRef, setApprovalRef] = useState('');
  const [approvedDays, setApprovedDays] = useState(0);
  const [showQueryResponse, setShowQueryResponse] = useState(false);
  const [queryResponse, setQueryResponse] = useState('');
  const [showEnhancement, setShowEnhancement] = useState(false);
  const [enhancementAmount, setEnhancementAmount] = useState(0);
  const [enhancementReason, setEnhancementReason] = useState('');

  const loadPreAuth = useCallback(async () => {
    try { setLoading(true); const res = await fetch(`/api/billing/pre-auths/${preAuthId}`);
      if (res.ok) { const data = await res.json(); setPreAuth(data); setApprovedAmount(data.requested_amount); setApprovedDays(data.requested_stay_days || 0); }
    } catch {} setLoading(false);
  }, [preAuthId]);
  useEffect(() => { loadPreAuth(); }, [loadPreAuth]);

  const handleSubmit = async () => { setActionLoading(true); try { await fetch(`/api/billing/pre-auths/${preAuthId}/submit`, { method: 'POST' }); await loadPreAuth(); } catch {} setActionLoading(false); };
  const handleApprove = async () => { setActionLoading(true); try { await fetch(`/api/billing/pre-auths/${preAuthId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved_amount: approvedAmount, approved_stay_days: approvedDays, approval_reference: approvalRef }) }); setShowApproveForm(false); await loadPreAuth(); } catch {} setActionLoading(false); };
  const handleQueryResponse = async () => { setActionLoading(true); try { await fetch(`/api/billing/pre-auths/${preAuthId}/query-response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: queryResponse }) }); setShowQueryResponse(false); setQueryResponse(''); await loadPreAuth(); } catch {} setActionLoading(false); };
  const handleEnhancement = async () => { setActionLoading(true); try { await fetch(`/api/billing/pre-auths/${preAuthId}/enhance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enhancement_amount: enhancementAmount, reason: enhancementReason }) }); setShowEnhancement(false); await loadPreAuth(); } catch {} setActionLoading(false); };

  if (loading || !preAuth) return (<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-gray-400" /></div>);

  const statusColor = PREAUTH_STATUS_COLORS[preAuth.status];
  const tatHours = preAuth.submitted_at ? Math.round((Date.now() - new Date(preAuth.submitted_at).getTime()) / 3600000) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/billing/insurance')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
            <div><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /><h1 className="text-lg font-bold text-[#0A2540]">Pre-Authorization</h1><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{preAuth.status.replace(/_/g, ' ')}</span></div>
            <p className="text-xs text-gray-500 mt-0.5">{preAuth.pre_auth_number || 'Draft'} - {preAuth.insurance_company?.company_name || 'Insurance'} - Policy: {preAuth.policy_number}</p></div>
          </div>
          <div className="flex items-center gap-2">
            {preAuth.status === 'DRAFT' && <button onClick={handleSubmit} disabled={actionLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Send className="h-4 w-4" /> Submit to TPA</button>}
            {preAuth.status === 'QUERY' && <button onClick={() => setShowQueryResponse(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"><MessageSquare className="h-4 w-4" /> Respond to Query</button>}
            {['SUBMITTED','QUERY'].includes(preAuth.status) && <button onClick={() => setShowApproveForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Record Approval</button>}
            {preAuth.status === 'APPROVED' && <button onClick={() => setShowEnhancement(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"><TrendingUp className="h-4 w-4" /> Request Enhancement</button>}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 max-w-4xl">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <StatusTimeline preAuth={preAuth} />
          {tatHours !== null && <p className={`text-xs mt-3 ${tatHours > 48 ? 'text-red-600 font-bold' : 'text-gray-500'}`}><Clock className="h-3 w-3 inline mr-1" />TAT: {tatHours < 24 ? `${tatHours} hours` : `${Math.round(tatHours / 24)} days`}{tatHours > 48 && ' — OVERDUE'}</p>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{l:'Requested',v:preAuth.requested_amount,c:'border-l-blue-400'},{l:'Approved',v:preAuth.approved_amount,c:'border-l-emerald-400',clr:'text-emerald-700'},{l:'Enhancement',v:preAuth.enhancement_approved_amount,c:'border-l-purple-400',clr:'text-purple-700'},{l:'Stay Days',v:preAuth.approved_stay_days||preAuth.requested_stay_days,c:'border-l-amber-400',isNum:true}].map(card => (
            <div key={card.l} className={`rounded-lg border border-gray-200 bg-white p-3.5 border-l-4 ${card.c}`}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase">{card.l}</p>
              <p className={`text-lg font-bold font-mono mt-1 ${card.clr || 'text-gray-900'}`}>{card.v != null ? (card.isNum ? card.v : `₹${(card.v as number).toLocaleString('en-IN')}`) : '—'}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Clinical Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-medium text-gray-500 mb-1">Diagnosis</p><div className="space-y-1">{(preAuth.diagnosis_codes || []).map((d, idx) => <div key={idx} className="flex items-center gap-2"><span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{d.code}</span><span className="text-xs text-gray-700">{d.description}</span></div>)}</div></div>
            <div><p className="text-xs font-medium text-gray-500 mb-1">Procedures</p><div className="space-y-1">{(preAuth.procedure_codes || []).map((p, idx) => <div key={idx} className="flex items-center gap-2"><span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.code}</span><span className="text-xs text-gray-700">{p.description}</span></div>)}{(!preAuth.procedure_codes || preAuth.procedure_codes.length === 0) && <span className="text-xs text-gray-400">None specified</span>}</div></div>
          </div>
          {preAuth.clinical_notes && <div><p className="text-xs font-medium text-gray-500 mb-1">Clinical Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{preAuth.clinical_notes}</p></div>}
          {preAuth.pmjay_package_code && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3"><p className="text-xs font-bold text-amber-800">PMJAY Package</p><p className="text-sm text-amber-700">{preAuth.pmjay_package_code} — {preAuth.pmjay_package_name || ''}</p></div>}
        </div>

        {preAuth.query_details && <div className="bg-white rounded-xl border border-orange-200 p-5 space-y-3"><h3 className="text-sm font-bold text-orange-800 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> TPA Query</h3><p className="text-sm text-gray-700 bg-orange-50 rounded-lg p-3">{preAuth.query_details}</p>{preAuth.query_response && <div><p className="text-xs font-medium text-gray-500 mb-1">Our Response</p><p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{preAuth.query_response}</p></div>}</div>}
        {preAuth.status === 'REJECTED' && preAuth.rejection_reason && <div className="bg-white rounded-xl border border-red-200 p-5"><h3 className="text-sm font-bold text-red-800 flex items-center gap-2"><XCircle className="h-4 w-4" /> Rejection Reason</h3><p className="text-sm text-red-700 mt-2">{preAuth.rejection_reason}</p></div>}

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">Documents</h3><button className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"><Upload className="h-3 w-3" /> Upload</button></div>
          <div className="grid grid-cols-2 gap-2">{(preAuth.documents || []).map((doc, idx) => <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5"><FileText className="h-4 w-4 text-gray-400" /><div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{doc.type}</p><p className="text-[10px] text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString('en-IN')}</p></div></div>)}{(!preAuth.documents || preAuth.documents.length === 0) && <p className="text-xs text-gray-400 col-span-2">No documents uploaded yet</p>}</div>
        </div>
      </div>

      {showApproveForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Record Pre-Auth Approval</h3><button onClick={() => setShowApproveForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
        <div className="p-5 space-y-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Approved Amount</label><input type="number" min={0} value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-200" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Stay Days</label><input type="number" min={0} value={approvedDays} onChange={(e) => setApprovedDays(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-200" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Reference</label><input type="text" value={approvalRef} onChange={(e) => setApprovalRef(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" /></div>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2"><button onClick={() => setShowApproveForm(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={handleApprove} disabled={actionLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Confirm</button></div>
      </div></div>}

      {showQueryResponse && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Respond to TPA Query</h3><button onClick={() => setShowQueryResponse(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
        <div className="p-5 space-y-4">
          {preAuth.query_details && <div className="rounded-lg bg-orange-50 p-3"><p className="text-xs font-bold text-orange-800 mb-1">Query:</p><p className="text-sm text-orange-700">{preAuth.query_details}</p></div>}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Your Response</label><textarea value={queryResponse} onChange={(e) => setQueryResponse(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Type response..." /></div>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2"><button onClick={() => setShowQueryResponse(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={handleQueryResponse} disabled={actionLoading || !queryResponse.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Send</button></div>
      </div></div>}

      {showEnhancement && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Request Enhancement</h3><button onClick={() => setShowEnhancement(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Current approved: <strong>₹{(preAuth.approved_amount || 0).toLocaleString('en-IN')}</strong></p></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Additional Amount</label><input type="number" min={0} value={enhancementAmount} onChange={(e) => setEnhancementAmount(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-200" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason</label><textarea value={enhancementReason} onChange={(e) => setEnhancementReason(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" placeholder="Extended stay, additional procedure..." /></div>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2"><button onClick={() => setShowEnhancement(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={handleEnhancement} disabled={actionLoading || enhancementAmount <= 0} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">Submit</button></div>
      </div></div>}
    </div>
  );
}
