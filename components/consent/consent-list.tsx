// components/consent/consent-list.tsx
'use client';

import React, { useState } from 'react';
import { openPrintWindow } from '@/components/ui/shared';

interface Props {
  consents: any[];
  staffId: string;
  onRevoke: (consentId: string, reason: string, staffId: string) => Promise<void>;
  onFlash: (msg: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  surgical: 'bg-red-100 text-red-700',
  anesthesia: 'bg-purple-100 text-purple-700',
  transfusion: 'bg-orange-100 text-orange-700',
  procedure: 'bg-blue-100 text-blue-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function ConsentList({ consents, staffId, onRevoke, onFlash }: Props) {
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [viewConsent, setViewConsent] = useState<any>(null);

  const handleRevoke = async () => {
    if (!revokeId || !revokeReason.trim()) { onFlash('Please provide a reason for revocation'); return; }
    await onRevoke(revokeId, revokeReason.trim(), staffId);
    onFlash('Consent revoked');
    setRevokeId(null); setRevokeReason('');
  };

  const printConsentRecord = (c: any) => {
    openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;font-size:11px">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:8px;margin-bottom:12px">
        <div style="font-size:16px;font-weight:700;color:#0d9488">Hospital</div>
        <div style="font-size:9px;color:#666">Shilaj, Ahmedabad | NABH Accredited</div>
        <div style="font-size:14px;font-weight:700;margin-top:6px">${c.procedure_name || 'INFORMED CONSENT'}</div>
        ${!c.is_valid ? '<div style="color:red;font-weight:bold;margin-top:4px">*** REVOKED ***</div>' : ''}
      </div>
      <div style="font-size:10px;padding:6px;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:10px">
        <div><b>Type:</b> ${c.consent_type} | <b>Date:</b> ${new Date(c.signed_at || c.created_at).toLocaleString('en-IN')}</div>
        <div><b>Language:</b> ${c.consent_language || 'English'} | <b>Obtained by:</b> ${c.obtained_staff?.full_name || '—'}</div>
      </div>
      ${c.consent_html ? `<div style="margin-bottom:10px">${c.consent_html}</div>` : ''}
      ${c.risks_explained ? `<div style="margin-bottom:10px"><b>Risks Explained:</b> ${c.risks_explained}</div>` : ''}
      ${c.alternatives_explained ? `<div style="margin-bottom:10px"><b>Alternatives:</b> ${c.alternatives_explained}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px">
        <div style="text-align:center">
          <div style="height:60px;border-bottom:1px solid #333">${c.signature_data ? `<img src="${c.signature_data}" style="height:55px"/>` : ''}</div>
          <div style="font-size:9px;margin-top:4px"><b>Patient / Representative</b></div>
        </div>
        <div style="text-align:center">
          <div style="height:60px;border-bottom:1px solid #333">${c.witness_signature ? `<img src="${c.witness_signature}" style="height:55px"/>` : ''}</div>
          <div style="font-size:9px;margin-top:4px"><b>Witness</b><br/>${c.witness_name || ''} (${c.witness_relation || ''})</div>
        </div>
        <div style="text-align:center">
          <div style="height:60px;border-bottom:1px solid #333">${c.doctor_signature ? `<img src="${c.doctor_signature}" style="height:55px"/>` : ''}</div>
          <div style="font-size:9px;margin-top:4px"><b>Doctor</b></div>
        </div>
      </div>
      ${!c.is_valid ? `<div style="margin-top:15px;padding:8px;border:2px solid red;border-radius:4px;font-size:10px;color:red"><b>REVOKED</b> on ${c.revoked_at ? new Date(c.revoked_at).toLocaleString('en-IN') : '—'}<br/>Reason: ${c.revoke_reason || '—'}</div>` : ''}
      <div style="margin-top:15px;font-size:7px;color:#aaa;text-align:center">HMIS — Digital Consent Record</div>
    </div>`, `Consent — ${c.consent_type} — ${c.procedure_name || ''}`);
  };

  if (consents.length === 0) {
    return <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No consent forms signed yet</div>;
  }

  return (
    <div className="space-y-2">
      {/* Revoke modal */}
      {revokeId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-2">
          <h4 className="text-sm font-semibold text-red-700 mb-2">Revoke Consent</h4>
          <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)}
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mb-2" rows={2}
            placeholder="Reason for revocation (required)..." />
          <div className="flex gap-2">
            <button onClick={handleRevoke} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">Confirm Revoke</button>
            <button onClick={() => { setRevokeId(null); setRevokeReason(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* View detail */}
      {viewConsent && (
        <div className="bg-white rounded-xl border p-4 mb-2">
          <div className="flex justify-between items-start mb-3">
            <h4 className="text-sm font-semibold">{viewConsent.procedure_name || viewConsent.consent_type}</h4>
            <button onClick={() => setViewConsent(null)} className="text-xs text-gray-500">Close</button>
          </div>
          {viewConsent.consent_html && <div className="text-xs text-gray-600 mb-2" dangerouslySetInnerHTML={{ __html: viewConsent.consent_html }} />}
          {viewConsent.risks_explained && <div className="text-xs mb-2"><b className="text-red-600">Risks:</b> {viewConsent.risks_explained}</div>}
          {viewConsent.alternatives_explained && <div className="text-xs mb-2"><b className="text-blue-600">Alternatives:</b> {viewConsent.alternatives_explained}</div>}
          <div className="grid grid-cols-3 gap-4 mt-3">
            {viewConsent.signature_data && <div className="text-center">
              <img src={viewConsent.signature_data} alt="Patient signature" className="h-12 mx-auto border rounded" />
              <div className="text-[10px] text-gray-400 mt-1">Patient</div>
            </div>}
            {viewConsent.witness_signature && <div className="text-center">
              <img src={viewConsent.witness_signature} alt="Witness signature" className="h-12 mx-auto border rounded" />
              <div className="text-[10px] text-gray-400 mt-1">Witness: {viewConsent.witness_name}</div>
            </div>}
            {viewConsent.doctor_signature && <div className="text-center">
              <img src={viewConsent.doctor_signature} alt="Doctor signature" className="h-12 mx-auto border rounded" />
              <div className="text-[10px] text-gray-400 mt-1">Doctor</div>
            </div>}
          </div>
        </div>
      )}

      {/* Consent list */}
      {consents.map(c => (
        <div key={c.id} className={`bg-white rounded-lg border p-3 flex items-center justify-between ${!c.is_valid ? 'opacity-60 border-red-200' : ''}`}>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${CATEGORY_COLORS[c.consent_type] || 'bg-gray-100'}`}>
                {c.consent_type?.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="font-medium text-sm">{c.procedure_name || c.template?.name || c.consent_type}</span>
              {!c.is_valid && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-700 font-bold">REVOKED</span>}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {new Date(c.signed_at || c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {c.obtained_staff?.full_name && <span> | By: {c.obtained_staff.full_name}</span>}
              {c.witness_name && <span> | Witness: {c.witness_name} ({c.witness_relation})</span>}
              {c.consent_language && c.consent_language !== 'English' && <span> | Lang: {c.consent_language}</span>}
            </div>
            {!c.is_valid && c.revoke_reason && <div className="text-[10px] text-red-500 mt-0.5">Revoked: {c.revoke_reason}</div>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setViewConsent(c)} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200">View</button>
            <button onClick={() => printConsentRecord(c)} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Print</button>
            {c.is_valid && (
              <button onClick={() => setRevokeId(c.id)} className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100">Revoke</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
