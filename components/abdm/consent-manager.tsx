'use client';
import React, { useState, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// HIE-CM Consent Manager — Request & view health records
// ============================================================

interface ConsentRequest {
  id: string;
  consent_request_id: string;
  patient_abha_address: string;
  hip_id?: string;
  hip_name?: string;
  purpose: string;
  hi_types: string[];
  date_range_from: string;
  date_range_to: string;
  expiry_date: string;
  status: string;
  consent_artefact_ids?: string[];
  created_at: string;
  requested_by: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  CAREMGT: 'Care Management',
  BTG: 'Break the Glass',
  PUBHLTH: 'Public Health',
  HPAYMT: 'Healthcare Payment',
  DSRCH: 'Disease Research',
  PATRQT: 'Patient Requested',
};

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700',
  GRANTED: 'bg-green-100 text-green-700',
  DENIED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REVOKED: 'bg-orange-100 text-orange-700',
};

const HI_TYPE_LABELS: Record<string, string> = {
  Prescription: 'Prescriptions',
  DiagnosticReport: 'Lab Reports',
  OPConsultation: 'OPD Consultations',
  DischargeSummary: 'Discharge Summaries',
  ImmunizationRecord: 'Immunizations',
  HealthDocumentRecord: 'Health Documents',
  WellnessRecord: 'Wellness Records',
};

interface Props {
  patientAbhaAddress: string;
  patientName: string;
  staffId: string;
  centreId: string;
}

export default function ConsentManager({ patientAbhaAddress, patientName, staffId, centreId }: Props) {
  const [requests, setRequests] = useState<ConsentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Form
  const [purpose, setPurpose] = useState('CAREMGT');
  const [hiTypes, setHiTypes] = useState<string[]>(['OPConsultation', 'Prescription', 'DiagnosticReport']);
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [hipId, setHipId] = useState('');
  const [hipName, setHipName] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!patientAbhaAddress || !sb()) return;
    loadRequests();
  }, [patientAbhaAddress]);

  const loadRequests = async () => {
    setLoading(true);
    const { data } = await sb().from('hmis_abdm_consent_requests')
      .select('*')
      .eq('patient_abha_address', patientAbhaAddress)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  const submitRequest = async () => {
    if (!hiTypes.length) { setError('Select at least one health info type'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/abdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_consent_request',
          request: {
            patientAbhaAddress,
            purpose,
            hiTypes,
            dateRange: { from: dateFrom, to: dateTo },
            expiryDate,
            hipId: hipId || undefined,
            hipName: hipName || undefined,
          },
          staffId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash('Consent request sent to patient');
      setShowNew(false);
      loadRequests();
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  const toggleHiType = (t: string) => {
    setHiTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Health Information Exchange</h3>
          <p className="text-[10px] text-gray-500">Request health records from other facilities via ABDM consent flow</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">
          {showNew ? 'Cancel' : '+ Request Records'}
        </button>
      </div>

      {/* New consent request form */}
      {showNew && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500">Purpose *</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs">
                {Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 mb-1 block">Health Information Types *</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(HI_TYPE_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => toggleHiType(k)}
                  className={`px-2.5 py-1 rounded-full text-[10px] border ${hiTypes.includes(k) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500">Records From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500">Records To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500">HIP ID (optional)</label>
              <input type="text" value={hipId} onChange={e => setHipId(e.target.value)} placeholder="Specific facility HFR ID" className="w-full px-2 py-2 border rounded-lg text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500">HIP Name (optional)</label>
              <input type="text" value={hipName} onChange={e => setHipName(e.target.value)} placeholder="Facility name" className="w-full px-2 py-2 border rounded-lg text-xs" />
            </div>
          </div>

          <button onClick={submitRequest} disabled={submitting || !hiTypes.length}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">
            {submitting ? 'Sending...' : 'Send Consent Request'}
          </button>
          <p className="text-[9px] text-gray-400">Patient will receive this request on their PHR app for approval.</p>
        </div>
      )}

      {/* Consent request list */}
      {/* Health records empty state */}
      {!loading && requests.length === 0 && !showNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
          No health records linked via ABDM. Records will appear here once ABHA integration is active.
        </div>
      )}

      {/* Consent request list */}
      {loading ? (
        <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />
      ) : requests.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl px-4">
          <div className="text-sm text-gray-500 font-medium">No consent requests</div>
          <div className="text-xs text-gray-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            ABDM consent management will be available after sandbox registration (HFR ID: IN2410013685). Once active, you can request health records from other facilities via the ABDM consent flow.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">{r.consent_request_id?.slice(0, 8)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>
                    {r.status}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-500">Purpose:</span> {PURPOSE_LABELS[r.purpose] || r.purpose}
                {r.hip_name && <span className="ml-2 text-gray-400">from {r.hip_name}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(r.hi_types || []).map(t => (
                  <span key={t} className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">{HI_TYPE_LABELS[t] || t}</span>
                ))}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Records: {r.date_range_from} to {r.date_range_to} | Expires: {r.expiry_date}
              </div>
              {r.consent_artefact_ids?.length ? (
                <div className="text-[10px] text-green-600 mt-1">
                  {r.consent_artefact_ids.length} consent artefact(s) received
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
