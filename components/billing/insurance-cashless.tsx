// components/billing/insurance-cashless.tsx
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';

interface Props {
  claims: any[]; loading: boolean; stats: any; centreId: string; staffId: string;
  onInitPreAuth: (data: any, staffId: string) => Promise<void>;
  onUpdateStatus: (claimId: string, status: string, data?: any) => Promise<void>;
  onLoad: (filters?: any) => void; onFlash: (m: string) => void;
}

// ============================================================
// Constants
// ============================================================
const CLAIM_STATUSES = [
  'preauth_initiated','preauth_submitted','preauth_approved','preauth_rejected','preauth_enhancement',
  'admitted','claim_submitted','query_raised','query_responded',
  'approved','partially_approved','settled','rejected','cancelled'
] as const;

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

const COMMON_DIAGNOSES = [
  { code: 'I25.1', display: 'Coronary artery disease' },
  { code: 'I21.0', display: 'Acute MI — anterior wall' },
  { code: 'K80.2', display: 'Cholelithiasis' },
  { code: 'K35.8', display: 'Acute appendicitis' },
  { code: 'M17.1', display: 'Primary osteoarthritis — knee' },
  { code: 'M16.1', display: 'Primary osteoarthritis — hip' },
  { code: 'G40.9', display: 'Epilepsy, unspecified' },
  { code: 'I63.9', display: 'Cerebral infarction' },
  { code: 'N20.0', display: 'Calculus of kidney' },
  { code: 'O82', display: 'Caesarean delivery' },
  { code: 'J18.9', display: 'Pneumonia, unspecified' },
  { code: 'K40.9', display: 'Inguinal hernia' },
  { code: 'E11.9', display: 'Type 2 diabetes mellitus' },
  { code: 'N40', display: 'BPH — Benign prostatic hyperplasia' },
  { code: 'S72.0', display: 'Fracture of neck of femur' },
];

const COMMON_PROCEDURES = [
  'Coronary Angiography','PTCA with Stenting','CABG','Valve Replacement',
  'Lap Cholecystectomy','Appendectomy','Hernia Repair',
  'Total Knee Replacement','Total Hip Replacement','Spine Surgery',
  'Craniotomy','VP Shunt','LSCS','Hysterectomy',
  'TURP','PCNL','DJ Stenting','Nephrectomy',
];

const QUERY_REASONS = [
  'Additional documents required','Diagnosis mismatch','Policy not active',
  'Treatment not covered under plan','Sum insured exhausted','Pre-existing condition',
  'Waiting period not completed','Investigation reports pending',
  'Discharge summary incomplete','Bill clarification needed',
];

// ============================================================
// Helpers
// ============================================================
const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
const daysSince = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

function stColor(s: string): string {
  if (s === 'settled') return 'bg-green-100 text-green-700';
  if (s?.includes('approved')) return 'bg-green-100 text-green-700';
  if (s?.includes('rejected') || s === 'cancelled') return 'bg-red-100 text-red-700';
  if (s?.includes('query')) return 'bg-amber-100 text-amber-700';
  if (s?.includes('submitted') || s === 'admitted') return 'bg-blue-100 text-blue-700';
  if (s?.includes('enhancement')) return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
}

function tatColor(days: number): string {
  if (days > 30) return 'text-red-700 font-bold';
  if (days > 15) return 'text-amber-700 font-semibold';
  if (days > 7) return 'text-amber-600';
  return 'text-gray-500';
}

// ============================================================
// Main Component
// ============================================================
export default function InsuranceCashless({ claims, loading, stats, centreId, staffId, onInitPreAuth, onUpdateStatus, onLoad, onFlash }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showNewPreAuth, setShowNewPreAuth] = useState(false);

  // Pre-Auth form state
  const [paForm, setPaForm] = useState({
    patientSearch: '', patientId: '', patientName: '',
    insurerId: '', tpaId: '', policyNumber: '',
    diagnosisCode: '', diagnosisDisplay: '', procedureName: '',
    estimatedAmount: '', roomType: 'semi_private', expectedLOS: 3,
    admissionDate: new Date().toISOString().split('T')[0],
    doctorName: '', remarks: '',
  });
  const [paError, setPaError] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [tpas, setTpas] = useState<any[]>([]);
  const [diagSearch, setDiagSearch] = useState('');

  // Status update state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [approvedAmt, setApprovedAmt] = useState('');
  const [settledAmt, setSettledAmt] = useState('');
  const [tdsAmt, setTdsAmt] = useState('');
  const [disallowAmt, setDisallowAmt] = useState('');
  const [disallowReason, setDisallowReason] = useState('');
  const [queryReason, setQueryReason] = useState('');
  const [utrNumber, setUtrNumber] = useState('');

  // Load insurers + TPAs
  useEffect(() => {
    if (!sb()) return;
    sb()!.from('hmis_insurers').select('id, name, nhcx_code').eq('is_active', true).order('name').then(({ data }: any) => setInsurers(data || []));
    sb()!.from('hmis_tpas').select('id, name, nhcx_code').eq('is_active', true).order('name').then(({ data }: any) => setTpas(data || []));
  }, []);

  // Patient search
  useEffect(() => {
    if (paForm.patientSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${paForm.patientSearch}%,first_name.ilike.%${paForm.patientSearch}%,phone_primary.ilike.%${paForm.patientSearch}%`)
        .eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [paForm.patientSearch]);

  // Diagnosis search
  const diagResults = useMemo(() => {
    if (diagSearch.length < 2) return [];
    const q = diagSearch.toLowerCase();
    return COMMON_DIAGNOSES.filter(d => d.code.toLowerCase().includes(q) || d.display.toLowerCase().includes(q));
  }, [diagSearch]);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    if (statusFilter === 'all') return claims;
    if (statusFilter === 'active') return claims.filter(c => !['settled', 'rejected', 'cancelled'].includes(c.status));
    return claims.filter(c => c.status === statusFilter);
  }, [claims, statusFilter]);

  // TAT analytics
  const tatAnalytics = useMemo(() => {
    const activeClaims = claims.filter(c => !['settled', 'rejected', 'cancelled'].includes(c.status));
    const tats = activeClaims.map(c => daysSince(c.created_at));
    return {
      count: activeClaims.length,
      avgDays: tats.length > 0 ? Math.round(tats.reduce((s, d) => s + d, 0) / tats.length) : 0,
      maxDays: tats.length > 0 ? Math.max(...tats) : 0,
      over30: tats.filter(d => d > 30).length,
      over15: tats.filter(d => d > 15 && d <= 30).length,
    };
  }, [claims]);

  // Next available statuses for selected claim
  const nextStatuses = selectedClaim ? (STATUS_FLOW[selectedClaim.status] || []) : [];

  // ---- SUBMIT PRE-AUTH ----
  const submitPreAuth = async () => {
    setPaError('');
    if (!paForm.patientId) { setPaError('Select a patient'); return; }
    if (!paForm.insurerId) { setPaError('Select an insurer'); return; }
    if (!paForm.policyNumber.trim()) { setPaError('Enter policy number'); return; }
    if (!paForm.diagnosisCode) { setPaError('Select a diagnosis (ICD-10)'); return; }
    if (!paForm.procedureName.trim()) { setPaError('Enter procedure name'); return; }
    if (!paForm.estimatedAmount || parseFloat(paForm.estimatedAmount) <= 0) { setPaError('Enter estimated amount (must be > 0)'); return; }
    if (!paForm.doctorName.trim()) { setPaError('Enter treating doctor name'); return; }

    const estAmt = parseFloat(paForm.estimatedAmount);
    if (isNaN(estAmt)) { setPaError('Estimated amount must be a valid number'); return; }

    await onInitPreAuth({
      patient_id: paForm.patientId,
      insurer_id: paForm.insurerId,
      tpa_id: paForm.tpaId || null,
      policy_number: paForm.policyNumber,
      claimed_amount: estAmt,
      diagnosis_codes: [{ code: paForm.diagnosisCode, display: paForm.diagnosisDisplay }],
      procedure_name: paForm.procedureName,
      room_type: paForm.roomType,
      expected_los: paForm.expectedLOS,
      admission_date: paForm.admissionDate,
      doctor_name: paForm.doctorName,
      remarks: paForm.remarks,
    }, staffId);

    onFlash('Pre-auth initiated');
    setShowNewPreAuth(false);
    setPaForm({ patientSearch: '', patientId: '', patientName: '', insurerId: '', tpaId: '', policyNumber: '', diagnosisCode: '', diagnosisDisplay: '', procedureName: '', estimatedAmount: '', roomType: 'semi_private', expectedLOS: 3, admissionDate: new Date().toISOString().split('T')[0], doctorName: '', remarks: '' });
  };

  // ---- UPDATE STATUS ----
  const updateClaimStatus = async () => {
    if (!selectedClaim || !newStatus) return;
    const data: any = {};
    if (statusNote) data.remarks = statusNote;
    if (queryReason && newStatus === 'query_raised') data.query_reason = queryReason;
    if (approvedAmt && ['approved', 'partially_approved'].includes(newStatus)) {
      const amt = parseFloat(approvedAmt);
      if (isNaN(amt) || amt < 0) { onFlash('Invalid approved amount'); return; }
      data.approved_amount = amt;
      // Validate: approved cannot exceed claimed
      if (selectedClaim.claimed_amount && amt > parseFloat(selectedClaim.claimed_amount)) {
        onFlash('Approved amount cannot exceed claimed amount'); return;
      }
    }
    if (settledAmt && newStatus === 'settled') {
      const sAmt = parseFloat(settledAmt);
      if (isNaN(sAmt) || sAmt < 0) { onFlash('Invalid settled amount'); return; }
      data.settled_amount = sAmt;
    }
    if (tdsAmt) {
      const t = parseFloat(tdsAmt);
      if (!isNaN(t)) data.tds_amount = t;
    }
    if (disallowAmt) {
      const d = parseFloat(disallowAmt);
      if (!isNaN(d)) data.disallowance_amount = d;
    }
    if (disallowReason) data.disallowance_reason = disallowReason;
    if (utrNumber) data.utr_number = utrNumber;

    await onUpdateStatus(selectedClaim.id, newStatus, data);
    setSelectedClaim(null); setNewStatus(''); setStatusNote(''); setApprovedAmt('');
    setSettledAmt(''); setTdsAmt(''); setDisallowAmt(''); setDisallowReason('');
    setQueryReason(''); setUtrNumber('');
    onFlash(`Status updated: ${newStatus.replace(/_/g, ' ')}`);
  };

  return (
    <div className="space-y-4">
      {/* ---- KPI Strip ---- */}
      <div className="grid grid-cols-8 gap-2">
        {[
          ['Active', tatAnalytics.count, 'text-blue-700', 'bg-blue-50'],
          ['Pre-Auth', stats.preauth, 'text-amber-700', 'bg-amber-50'],
          ['Approved', stats.approved, 'text-green-700', 'bg-green-50'],
          ['Pending', stats.pending, 'text-amber-700', 'bg-amber-50'],
          ['Settled', stats.settled, 'text-green-700', 'bg-green-50'],
          ['Rejected', stats.rejected, 'text-red-700', 'bg-red-50'],
          ['Avg TAT', `${tatAnalytics.avgDays}d`, tatAnalytics.avgDays > 20 ? 'text-red-700' : 'text-blue-700', 'bg-white'],
          ['Claimed', `₹${fmt(stats.totalClaimed)}`, 'text-gray-700', 'bg-white'],
        ].map(([label, val, tc, bg], i) => (
          <div key={i} className={`rounded-xl border p-2 text-center ${bg}`}>
            <div className="text-[9px] text-gray-500 uppercase">{label as string}</div>
            <div className={`text-lg font-bold ${tc}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* ---- TAT Warning ---- */}
      {tatAnalytics.over30 > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-red-700"><span className="font-bold">{tatAnalytics.over30} claim{tatAnalytics.over30 > 1 ? 's' : ''}</span> pending over 30 days (oldest: {tatAnalytics.maxDays}d). Follow up immediately.</span>
        </div>
      )}

      {/* ---- Filters + New PreAuth ---- */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['all','active','preauth_initiated','preauth_submitted','preauth_approved','admitted','claim_submitted','query_raised','approved','settled','rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); if (s !== 'all' && s !== 'active') onLoad({ status: s }); else onLoad(); }}
            className={`px-2 py-1 rounded text-[10px] border transition-colors ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
            {s === 'all' ? 'All' : s === 'active' ? 'Active' : s.replace(/_/g, ' ')}
          </button>
        ))}
        <button onClick={() => setShowNewPreAuth(!showNewPreAuth)} className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">
          {showNewPreAuth ? 'Cancel' : '+ New Pre-Auth'}
        </button>
      </div>

      {/* ---- NEW PRE-AUTH FORM ---- */}
      {showNewPreAuth && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-bold text-sm">Initiate Pre-Authorization</h3>

        {/* Patient */}
        <div className="grid grid-cols-3 gap-3">
          <div className="relative">
            <label className="text-xs text-gray-500">Patient *</label>
            {paForm.patientId ? (
              <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-sm font-medium">{paForm.patientName}</span>
                <button onClick={() => setPaForm(f => ({...f, patientId: '', patientName: '', patientSearch: ''}))} className="text-xs text-red-500">Change</button>
              </div>
            ) : (
              <>
                <input type="text" value={paForm.patientSearch} onChange={e => setPaForm(f => ({...f, patientSearch: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID / name / phone" />
                {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {patResults.map(p => (
                    <button key={p.id} onClick={() => { setPaForm(f => ({...f, patientId: p.id, patientName: `${p.first_name} ${p.last_name} (${p.uhid})`, patientSearch: ''})); setPatResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">
                      {p.first_name} {p.last_name} — {p.uhid} — {p.age_years}y {p.gender}
                    </button>
                  ))}
                </div>}
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Insurer *</label>
            <select value={paForm.insurerId} onChange={e => setPaForm(f => ({...f, insurerId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select insurer</option>
              {insurers.map(ins => <option key={ins.id} value={ins.id}>{ins.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">TPA (if applicable)</label>
            <select value={paForm.tpaId} onChange={e => setPaForm(f => ({...f, tpaId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Direct / No TPA</option>
              {tpas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Policy + Diagnosis */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Policy Number *</label>
            <input type="text" value={paForm.policyNumber} onChange={e => setPaForm(f => ({...f, policyNumber: e.target.value}))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., POL-1234567890" />
          </div>
          <div className="relative">
            <label className="text-xs text-gray-500">Primary Diagnosis (ICD-10) *</label>
            {paForm.diagnosisCode ? (
              <div className="bg-green-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-sm"><span className="font-mono text-green-700">{paForm.diagnosisCode}</span> — {paForm.diagnosisDisplay}</span>
                <button onClick={() => { setPaForm(f => ({...f, diagnosisCode: '', diagnosisDisplay: ''})); setDiagSearch(''); }} className="text-xs text-red-500">Change</button>
              </div>
            ) : (
              <>
                <input type="text" value={diagSearch} onChange={e => setDiagSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search ICD-10 code or description..." />
                {diagResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {diagResults.map(d => (
                    <button key={d.code} onClick={() => { setPaForm(f => ({...f, diagnosisCode: d.code, diagnosisDisplay: d.display})); setDiagSearch(''); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
                      <span className="font-mono text-blue-600">{d.code}</span> — {d.display}
                    </button>
                  ))}
                </div>}
              </>
            )}
          </div>
          <div className="relative">
            <label className="text-xs text-gray-500">Procedure *</label>
            <input type="text" value={paForm.procedureName} onChange={e => setPaForm(f => ({...f, procedureName: e.target.value}))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search procedure..." list="proc-list" />
            <datalist id="proc-list">{COMMON_PROCEDURES.map(p => <option key={p} value={p} />)}</datalist>
          </div>
        </div>

        {/* Amounts + Details */}
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500">Estimated Amount (₹) *</label>
            <input type="number" value={paForm.estimatedAmount} onChange={e => setPaForm(f => ({...f, estimatedAmount: e.target.value}))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 150000" min="1" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Room Type</label>
            <div className="flex gap-0.5 mt-1">{['general','semi_private','private','deluxe','icu'].map(r => (
              <button key={r} onClick={() => setPaForm(f => ({...f, roomType: r}))}
                className={`flex-1 py-1.5 rounded text-[9px] border ${paForm.roomType === r ? 'bg-blue-600 text-white' : 'bg-white'}`}>{r.replace('_', ' ')}</button>
            ))}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Expected LOS (days)</label>
            <div className="flex gap-0.5 mt-1">{[1,2,3,5,7,10,14].map(d => (
              <button key={d} onClick={() => setPaForm(f => ({...f, expectedLOS: d}))}
                className={`flex-1 py-1.5 rounded text-[9px] border ${paForm.expectedLOS === d ? 'bg-blue-600 text-white' : 'bg-white'}`}>{d}</button>
            ))}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Admission Date</label>
            <input type="date" value={paForm.admissionDate} onChange={e => setPaForm(f => ({...f, admissionDate: e.target.value}))}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Treating Doctor *</label>
            <input type="text" value={paForm.doctorName} onChange={e => setPaForm(f => ({...f, doctorName: e.target.value}))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Dr. ..." />
          </div>
        </div>

        {paError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{paError}</div>}
        <button onClick={submitPreAuth} className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium">Submit Pre-Authorization</button>
      </div>}

      {/* ---- SELECTED CLAIM DETAIL ---- */}
      {selectedClaim && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{selectedClaim.patient?.first_name} {selectedClaim.patient?.last_name}
              <span className="text-xs text-gray-400 ml-2">{selectedClaim.patient?.uhid}</span></div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="font-mono text-gray-400">{selectedClaim.claim_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(selectedClaim.status)}`}>{selectedClaim.status?.replace(/_/g, ' ')}</span>
              <span>{selectedClaim.insurer?.name}</span>
              {selectedClaim.tpa?.name && <span className="text-gray-400">via {selectedClaim.tpa.name}</span>}
              <span className={tatColor(daysSince(selectedClaim.created_at))}>{daysSince(selectedClaim.created_at)}d TAT</span>
            </div>
          </div>
          <button onClick={() => setSelectedClaim(null)} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Close</button>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-5 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
          <div><span className="text-gray-500 block">Claimed</span><span className="font-bold text-lg">₹{fmt(selectedClaim.claimed_amount)}</span></div>
          <div><span className="text-gray-500 block">Approved</span><span className="font-bold text-lg text-green-700">{selectedClaim.approved_amount ? `₹${fmt(selectedClaim.approved_amount)}` : '—'}</span></div>
          <div><span className="text-gray-500 block">Settled</span><span className="font-bold text-lg text-blue-700">{selectedClaim.settled_amount ? `₹${fmt(selectedClaim.settled_amount)}` : '—'}</span></div>
          <div><span className="text-gray-500 block">TDS</span><span>{selectedClaim.tds_amount ? `₹${fmt(selectedClaim.tds_amount)}` : '—'}</span></div>
          <div><span className="text-gray-500 block">Disallowance</span><span className="text-red-600">{selectedClaim.disallowance_amount ? `₹${fmt(selectedClaim.disallowance_amount)}` : '—'}</span></div>
        </div>

        {/* Status update panel */}
        {nextStatuses.length > 0 && <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-blue-700">Update Claim Status</div>
          <div className="flex gap-1.5 flex-wrap">{nextStatuses.map(s => (
            <button key={s} onClick={() => setNewStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${newStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}</div>

          {/* Conditional fields based on new status */}
          {newStatus === 'query_raised' && <div>
            <label className="text-xs text-gray-500">Query reason</label>
            <div className="flex gap-1 flex-wrap mt-1">{QUERY_REASONS.map(r => (
              <button key={r} onClick={() => setQueryReason(r)}
                className={`px-2 py-1 rounded text-[10px] border ${queryReason === r ? 'bg-amber-500 text-white' : 'bg-white'}`}>{r}</button>
            ))}</div>
          </div>}

          {['approved', 'partially_approved'].includes(newStatus) && <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Approved amount (₹) *</label>
              <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Amount approved by insurer" /></div>
            <div><label className="text-xs text-gray-500">Disallowance reason (if partial)</label>
              <input type="text" value={disallowReason} onChange={e => setDisallowReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>}

          {newStatus === 'settled' && <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Settled amount (₹) *</label>
              <input type="number" value={settledAmt} onChange={e => setSettledAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">TDS deducted (₹)</label>
              <input type="number" value={tdsAmt} onChange={e => setTdsAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Disallowance (₹)</label>
              <input type="number" value={disallowAmt} onChange={e => setDisallowAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">UTR Number</label>
              <input type="text" value={utrNumber} onChange={e => setUtrNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>}

          <div className="flex gap-2">
            <input type="text" value={statusNote} onChange={e => setStatusNote(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Notes / remarks..." />
            <button onClick={updateClaimStatus} disabled={!newStatus} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">Update</button>
          </div>
        </div>}
      </div>}

      {/* ---- CLAIMS TABLE ---- */}
      {loading ? <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Loading claims...</div> :
      filteredClaims.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No claims found{statusFilter !== 'all' ? ` with status "${statusFilter.replace(/_/g, ' ')}"` : ''}</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b text-gray-500">
            <th className="p-2 text-left font-medium">Claim #</th>
            <th className="p-2 text-left font-medium">Patient</th>
            <th className="p-2 font-medium">Insurer</th>
            <th className="p-2 font-medium">TPA</th>
            <th className="p-2 text-right font-medium">Claimed</th>
            <th className="p-2 text-right font-medium">Approved</th>
            <th className="p-2 text-right font-medium">Settled</th>
            <th className="p-2 font-medium">Status</th>
            <th className="p-2 font-medium">TAT</th>
          </tr></thead>
          <tbody>{filteredClaims.map(c => {
            const tat = daysSince(c.created_at);
            return (
              <tr key={c.id} className={`border-b cursor-pointer transition-colors ${selectedClaim?.id === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setSelectedClaim(c)}>
                <td className="p-2 font-mono text-[10px]">{c.claim_number}</td>
                <td className="p-2"><span className="font-medium">{c.patient?.first_name} {c.patient?.last_name}</span><span className="text-[10px] text-gray-400 ml-1">{c.patient?.uhid}</span></td>
                <td className="p-2 text-center text-[10px]">{c.insurer?.name || '—'}</td>
                <td className="p-2 text-center text-[10px]">{c.tpa?.name || '—'}</td>
                <td className="p-2 text-right font-medium">₹{fmt(c.claimed_amount)}</td>
                <td className="p-2 text-right text-green-700">{c.approved_amount ? `₹${fmt(c.approved_amount)}` : '—'}</td>
                <td className="p-2 text-right text-blue-700">{c.settled_amount ? `₹${fmt(c.settled_amount)}` : '—'}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(c.status)}`}>{c.status?.replace(/_/g, ' ')}</span></td>
                <td className={`p-2 text-center ${tatColor(tat)}`}>{tat}d</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>}
    </div>
  );
}
