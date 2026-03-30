'use client';
import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEMR } from '@/lib/emr/use-emr';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { printEncounterSummary, openPrintWindow } from '@/components/ui/shared';
import { LOGO_SVG } from '@/lib/config/logo';
import { HOSPITAL } from '@/lib/config/hospital';
import { smartPostLabCharge, smartPostRadiologyCharge } from '@/lib/bridge/cross-module-bridge';
import PatientBanner from '@/components/emr-v2/patient-banner';
import VitalsPanel from '@/components/emr-v2/vitals-panel';
import { SmartComplaintBuilder, generateComplaintText, type ActiveComplaint } from '@/components/emr/smart-complaint-builder';
import { SmartExamBuilder, type ExamFindings, generateExamText } from '@/components/emr/smart-exam-builder';
import DiagnosisBuilder from '@/components/emr-v2/diagnosis-builder';
import PrescriptionBuilder from '@/components/emr-v2/prescription-builder';
import InvestigationPanel from '@/components/emr-v2/investigation-panel';
import AICopilot from '@/components/emr-v2/ai-copilot';
import PatientImagingPanel from '@/components/radiology/patient-imaging-panel';
import PatientLabHistory from '@/components/lab/patient-lab-history';

// Types matching component interfaces
interface Patient { id: string; name: string; age: string; gender: string; uhid: string; phone: string; allergies: string[]; bloodGroup: string; }
interface VitalValues { systolic: string; diastolic: string; heartRate: string; spo2: string; temperature: string; weight: string; height: string; respiratoryRate: string; isAlert: boolean; onO2: boolean; }
interface DiagnosisEntry { code: string; name: string; type: 'primary' | 'secondary' | 'differential'; notes: string; }
interface RxEntry { drug: string; generic: string; dose: string; route: string; frequency: string; duration: string; instructions: string; isSOS: boolean; category: string; }
interface InvestigationEntry { name: string; type: 'lab' | 'radiology'; urgency: 'routine' | 'urgent' | 'stat'; notes: string; }

type Step = 'vitals' | 'complaints' | 'exam' | 'diagnosis' | 'rx' | 'investigations' | 'followup' | 'review';

const STEPS: { key: Step; label: string; short: string }[] = [
  { key: 'vitals', label: 'Vitals', short: 'V' },
  { key: 'complaints', label: 'Chief Complaints', short: 'CC' },
  { key: 'exam', label: 'Physical Exam', short: 'PE' },
  { key: 'diagnosis', label: 'Diagnosis', short: 'Dx' },
  { key: 'rx', label: 'Prescription', short: 'Rx' },
  { key: 'investigations', label: 'Investigations', short: 'Ix' },
  { key: 'followup', label: 'Follow-up & Advice', short: 'F/U' },
  { key: 'review', label: 'Review & Sign', short: '✓' },
];

function EMRInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedPatient = searchParams.get('patient');
  const opdVisitId = searchParams.get('visit');
  const emr = useEMR();
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';
  const centreId = activeCentreId || '';

  // Single page — no step state needed
  const [patient, setPatient] = useState<Patient>({ id: '', name: '', age: '--', gender: '--', uhid: 'H1-00000', phone: '', allergies: [], bloodGroup: '' });
  const [showSearch, setShowSearch] = useState(!preselectedPatient);
  const [searchQ, setSearchQ] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Clinical data
  const [vitals, setVitals] = useState<VitalValues>({ systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '', weight: '', height: '', respiratoryRate: '', isAlert: true, onO2: false });
  const [complaints, setComplaints] = useState<ActiveComplaint[]>([]);
  const [examFindings, setExamFindings] = useState<ExamFindings>({});
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [prescriptions, setPrescriptions] = useState<RxEntry[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationEntry[]>([]);
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [referral, setReferral] = useState({ department: '', doctor: '', reason: '', urgency: 'routine' });

  // Past encounters
  const [showHistory, setShowHistory] = useState(false);
  const [showImaging, setShowImaging] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load preselected patient
  useEffect(() => {
    if (preselectedPatient) selectPatientById(preselectedPatient);
  }, [preselectedPatient]);

  // Auto-mark OPD visit as "with_doctor" when EMR opens from queue
  useEffect(() => {
    if (opdVisitId && sb()) {
      sb().from('hmis_opd_visits').update({ status: 'with_doctor', consultation_start: new Date().toISOString() }).eq('id', opdVisitId).in('status', ['waiting', 'checked_in']);
    }
  }, [opdVisitId]);

  const selectPatientById = async (id: string) => {
    if (!sb()) return;
    const { data: pt } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary, blood_group').eq('id', id).single();
    if (!pt) return;
    const { data: allergies } = await sb().from('hmis_patient_allergies').select('allergen').eq('patient_id', id);

    // CRITICAL: Reset ALL clinical form state before loading new patient
    // Without this, data from Patient A bleeds into Patient B
    setVitals({ systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '', weight: '', height: '', respiratoryRate: '', isAlert: true, onO2: false });
    setComplaints([]);
    setExamFindings({});
    setDiagnoses([]);
    setPrescriptions([]);
    setInvestigations([]);
    setAdvice('');
    setFollowUpDate('');
    setReferral({ department: '', doctor: '', reason: '', urgency: 'routine' });
    // Reset scroll to top

    setPatient({
      id: pt.id, name: `${pt.first_name} ${pt.last_name || ''}`.trim(), age: pt.age_years?.toString() || '--',
      gender: pt.gender || '--', uhid: pt.uhid, phone: pt.phone_primary || '',
      allergies: (allergies || []).map((a: any) => a.allergen), bloodGroup: pt.blood_group || '',
    });
    emr.selectPatient(id);
    setShowSearch(false);
  };

  // Save encounter
  const saveEncounter = async (sign: boolean = false) => {
    if (!patient.id) { flash('Select a patient first'); return; }
    setSaving(true);

    const encounterData = {
      patientId: patient.id,
      vitals: { ...vitals },
      complaints: complaints.map(c => ({ complaint: c.template.name, text: generateComplaintText(c), values: c.values })),
      examination: generateExamText(examFindings),
      diagnoses: diagnoses.map(d => ({ ...d })),
      prescriptions: prescriptions.map(p => ({ ...p })),
      investigations: investigations.map(i => ({ ...i })),
      advice, followUpDate, referral: referral.department ? referral : undefined,
    };

    const result = await emr.saveEncounter(encounterData as any);
    if (result.success) {
      // On sign (final save), create real orders in downstream modules
      if (sign && sb() && centreId) {
        const encounterId = result.id || null;
        const clinicalIndication = diagnoses.map(d => d.name).join(', ');

        // Create lab orders — resolve test_id from hmis_lab_test_master so worklist picks them up
        const labInvs = investigations.filter(i => i.type === 'lab');
        for (const inv of labInvs) {
          // Lookup test_id by name (exact → fuzzy)
          let testId: string | null = null;
          const { data: testExact } = await sb().from('hmis_lab_test_master')
            .select('id').ilike('test_name', inv.name).eq('is_active', true).limit(1).maybeSingle();
          if (testExact) { testId = testExact.id; }
          else {
            const keyword = inv.name.split(/[\s\-\/\(\)]+/).filter((w: string) => w.length > 2)[0];
            if (keyword) {
              const { data: testFuzzy } = await sb().from('hmis_lab_test_master')
                .select('id').ilike('test_name', `%${keyword}%`).eq('is_active', true).limit(1).maybeSingle();
              if (testFuzzy) testId = testFuzzy.id;
            }
          }
          const { data: labOrder } = await sb().from('hmis_lab_orders').insert({
            centre_id: centreId, patient_id: patient.id,
            test_id: testId, test_name: inv.name,
            encounter_id: encounterId,
            clinical_info: clinicalIndication || inv.notes || null,
            status: 'ordered', ordered_by: staffId,
            priority: inv.urgency === 'stat' ? 'stat' : inv.urgency === 'urgent' ? 'urgent' : 'routine',
          }).select('id').maybeSingle();
          await smartPostLabCharge({
            centreId, patientId: patient.id, testName: inv.name, staffId,
            labOrderId: labOrder?.id,
          });
        }

        // Create radiology orders — resolve test_id from hmis_radiology_test_master
        const radInvs = investigations.filter(i => i.type === 'radiology');
        for (const inv of radInvs) {
          const modality = inv.name.split(' ')[0] || inv.name;
          const bodyPart = inv.name.replace(/^(X-Ray|CT|MRI|USG|HRCT|2D)\s*/i, '').trim() || inv.name;
          // Lookup test_id
          let radTestId: string | null = null;
          const { data: radExact } = await sb().from('hmis_radiology_test_master')
            .select('id').ilike('test_name', inv.name).eq('is_active', true).limit(1).maybeSingle();
          if (radExact) { radTestId = radExact.id; }
          else {
            const { data: radFuzzy } = await sb().from('hmis_radiology_test_master')
              .select('id').ilike('test_name', `%${bodyPart}%`).eq('modality', modality).eq('is_active', true).limit(1).maybeSingle();
            if (radFuzzy) radTestId = radFuzzy.id;
          }
          const accession = `RAD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
          const { data: radOrder } = await sb().from('hmis_radiology_orders').insert({
            centre_id: centreId, patient_id: patient.id,
            test_id: radTestId, test_name: inv.name,
            accession_number: accession,
            modality, body_part: bodyPart,
            encounter_id: encounterId,
            clinical_indication: clinicalIndication || inv.notes || null,
            status: 'ordered', ordered_by: staffId,
            urgency: inv.urgency === 'stat' ? 'stat' : 'routine',
          }).select('id').maybeSingle();
          await smartPostRadiologyCharge({
            centreId, patientId: patient.id, testName: inv.name, staffId,
            radiologyOrderId: radOrder?.id,
          });
        }

        // Create pharmacy dispensing record — linked to encounter
        if (prescriptions.length > 0) {
          await sb().from('hmis_pharmacy_dispensing').insert({
            centre_id: centreId, patient_id: patient.id,
            encounter_id: encounterId,
            prescription_data: prescriptions.map(p => ({
              drug: p.drug, generic: p.generic, dose: p.dose,
              route: p.route, frequency: p.frequency, duration: p.duration,
              instructions: p.instructions,
            })),
            status: 'pending',
          });

          // Also insert individual prescriptions for tracking/refills
          const rxRows = prescriptions.map(p => ({
            centre_id: centreId, patient_id: patient.id,
            drug_name: p.drug,
            dosage: p.dose, route: p.route,
            frequency: p.frequency, duration_days: parseInt(p.duration) || 0,
            instructions: p.instructions || '',
          }));
          await sb().from('hmis_prescriptions').insert(rxRows);
        }

        const orderCount = labInvs.length + radInvs.length;
        const rxCount = prescriptions.length;
        const parts = [];
        if (labInvs.length > 0) parts.push(`${labInvs.length} lab`);
        if (radInvs.length > 0) parts.push(`${radInvs.length} radiology`);
        if (rxCount > 0) parts.push(`${rxCount} Rx to pharmacy`);
        if (parts.length > 0) flash(`Signed + ${parts.join(' + ')} orders created`);
      }

      flash(sign ? 'Encounter signed & saved' : (result.offline ? 'Saved offline — will sync' : 'Encounter saved'));
      if (sign) {
        // Auto-complete OPD visit if opened from queue
        if (opdVisitId && sb()) {
          await sb().from('hmis_opd_visits').update({
            status: 'completed',
            consultation_end: new Date().toISOString(),
          }).eq('id', opdVisitId);
        }

        // Reset for next patient
        setPatient({ id: '', name: '', age: '--', gender: '--', uhid: 'H1-00000', phone: '', allergies: [], bloodGroup: '' });
        setVitals({ systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '', weight: '', height: '', respiratoryRate: '', isAlert: true, onO2: false });
        setComplaints([]); setExamFindings({}); setDiagnoses([]); setPrescriptions([]); setInvestigations([]);
        setAdvice(''); setFollowUpDate('');
        setShowSearch(true);

        // Navigate back to OPD queue if came from there
        if (opdVisitId) {
          router.push('/opd');
        }
      }
    } else { flash('Save failed — try again'); }
    setSaving(false);
  };

  // Step navigation
  const stepIdx = 0; // Single page layout



  // Filled indicators
  const filled = {
    vitals: !!(vitals.systolic || vitals.heartRate),
    complaints: complaints.length > 0,
    exam: Object.keys(examFindings).length > 0,
    diagnosis: diagnoses.length > 0,
    rx: prescriptions.length > 0,
    investigations: investigations.length > 0,
    followup: !!(followUpDate || advice),
    review: false,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Patient Banner */}
      <PatientBanner patient={patient} onSearch={() => setShowSearch(true)} />

      {/* Patient Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => { if (patient.id) setShowSearch(false); else router.back(); }}>
          <div className="bg-white rounded-xl w-[500px] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Search Patient</h3>
              <button onClick={() => { if (patient.id) setShowSearch(false); else router.back(); }}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                ← {patient.id ? 'Close' : 'Back'}
              </button>
            </div>
            <input type="text" value={searchQ} onChange={e => { setSearchQ(e.target.value); emr.searchPatient(e.target.value); }}
              className="w-full px-4 py-3 border rounded-xl text-sm" placeholder="Type UHID, name, or phone..." autoFocus />
            {emr.searchResults.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto border rounded-lg">{emr.searchResults.map((p: any) => (
                <button key={p.id} onClick={() => { selectPatientById(p.id); setSearchQ(''); }}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b flex justify-between">
                  <div><span className="font-medium">{p.first_name} {p.last_name}</span><span className="text-xs text-gray-400 ml-2">{p.uhid}</span></div>
                  <span className="text-xs text-gray-500">{p.age_years}y {p.gender} {p.phone_primary ? `| ${p.phone_primary}` : ''}</span>
                </button>
              ))}</div>
            )}
            {/* Today's queue */}
            {emr.todayQueue.length > 0 && !searchQ && (
              <div className="mt-3"><div className="text-xs text-gray-500 mb-1">Today's Queue ({emr.todayQueue.length})</div>
                <div className="max-h-48 overflow-y-auto border rounded-lg">{emr.todayQueue.map((q: any) => (
                  <button key={q.id} onClick={() => { selectPatientById(q.patient_id || q.id); }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b text-xs">
                    <span className="font-medium">{q.patient_name || q.name}</span>
                    <span className="text-gray-400 ml-2">{q.uhid || q.token}</span>
                    {q.status && <span className={`ml-2 px-1 py-0.5 rounded text-[9px] ${q.status === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{q.status}</span>}
                  </button>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main layout: content + sidebar */}
      <div className="flex gap-3">
        {/* Content area — single page scroll */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Quick nav + right panel toggles */}
          <div className="sticky top-14 z-10 bg-gray-50/95 backdrop-blur-sm py-2 -mx-1 px-1 flex items-center justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {STEPS.map(s => (
                <a key={s.key} href={`#section-${s.key}`}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg whitespace-nowrap transition-colors ${filled[s.key] ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'}`}>
                  {s.short}
                  {filled[s.key] && <span className="ml-1 text-green-500">✓</span>}
                </a>
              ))}
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              {patient.id && <button onClick={() => setShowHistory(!showHistory)} className={`px-2 py-1 text-[10px] rounded border ${showHistory ? 'bg-teal-600 text-white' : 'bg-white'}`}>History</button>}
              {patient.id && <button onClick={() => setShowImaging(!showImaging)} className={`px-2 py-1 text-[10px] rounded border ${showImaging ? 'bg-teal-600 text-white' : 'bg-white'}`}>Imaging</button>}
              {patient.id && <button onClick={() => setShowLab(!showLab)} className={`px-2 py-1 text-[10px] rounded border ${showLab ? 'bg-teal-600 text-white' : 'bg-white'}`}>Lab</button>}
              <button onClick={() => setShowCopilot(!showCopilot)} className={`px-2 py-1 text-[10px] rounded border ${showCopilot ? 'bg-purple-600 text-white' : 'bg-white text-purple-700'}`}>AI Copilot</button>
            </div>
          </div>

          {/* All sections — vertical scroll */}
          <div id="section-vitals"><VitalsPanel vitals={vitals} onChange={setVitals} /></div>

          <div id="section-complaints" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Chief Complaints</h3>
            <SmartComplaintBuilder complaints={complaints} setComplaints={setComplaints} />
          </div>

          <div id="section-exam" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Examination</h3>
            <SmartExamBuilder findings={examFindings} setFindings={setExamFindings} />
          </div>

          <div id="section-diagnosis" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Diagnosis</h3>
            <DiagnosisBuilder diagnoses={diagnoses} onChange={setDiagnoses} />
          </div>

          <div id="section-rx" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prescription</h3>
            <PrescriptionBuilder prescriptions={prescriptions} onChange={setPrescriptions} allergies={patient.allergies} patientId={patient.id} staffId={staffId} centreId={centreId} onFlash={flash} />
          </div>

          <div id="section-investigations" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Investigations</h3>
            <InvestigationPanel investigations={investigations} onChange={setInvestigations} />
          </div>

          <div id="section-followup" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Follow-up & Advice</h3>
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Follow-up Date</label>
                  <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <div className="flex gap-1 mt-1">{[3, 7, 14, 30].map(d => (
                    <button key={d} onClick={() => { const dt = new Date(); dt.setDate(dt.getDate() + d); setFollowUpDate(dt.toISOString().split('T')[0]); }}
                      className="px-2 py-0.5 bg-gray-100 rounded text-[10px] hover:bg-blue-100">{d}d</button>
                  ))}</div>
                </div>
                <div><label className="text-xs text-gray-500">Referral (if needed)</label>
                  <input type="text" value={referral.department} onChange={e => setReferral(r => ({ ...r, department: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Department (e.g., Cardiology)" />
                  {referral.department && <input type="text" value={referral.reason} onChange={e => setReferral(r => ({ ...r, reason: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="Reason for referral" />}
                </div>
              </div>
              <div><label className="text-xs text-gray-500">Advice / Patient Instructions</label>
                <textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Diet advice, activity restrictions, warning signs to watch for, medication reminders..." />
                <div className="flex flex-wrap gap-1 mt-1">{['Drink plenty of fluids', 'Avoid oily/spicy food', 'Complete full course of antibiotics', 'Rest for 3 days', 'Monitor temperature', 'Visit ER if symptoms worsen', 'Avoid driving on this medication', 'Follow-up with reports'].map(a => (
                  <button key={a} onClick={() => setAdvice(prev => prev ? prev + '\n' + a : a)} className="px-2 py-0.5 bg-gray-100 rounded text-[9px] hover:bg-blue-100">{a}</button>
                ))}</div>
              </div>
            </div>
          </div>

          <div id="section-review" className="pt-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Review & Sign</h3>
            <div className="bg-white rounded-xl border p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Vitals</div>
                  {vitals.systolic && <div>BP: {vitals.systolic}/{vitals.diastolic} mmHg</div>}
                  {vitals.heartRate && <div>HR: {vitals.heartRate} bpm</div>}
                  {vitals.spo2 && <div>SpO₂: {vitals.spo2}%</div>}
                  {vitals.temperature && <div>Temp: {vitals.temperature}°F</div>}
                  {!vitals.systolic && !vitals.heartRate && <div className="text-gray-400">Not recorded</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Complaints ({complaints.length})</div>
                  {complaints.map((c, i) => <div key={i}>{generateComplaintText(c)}</div>)}
                  {!complaints.length && <div className="text-gray-400">None</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Examination</div>
                  {Object.keys(examFindings).length > 0 ? <div className="whitespace-pre-line text-xs">{generateExamText(examFindings).substring(0, 200)}</div> : <div className="text-gray-400">Not done</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Diagnosis ({diagnoses.length})</div>
                  {diagnoses.map((d, i) => <div key={i}><span className={`text-[9px] px-1 rounded ${d.type === 'primary' ? 'bg-blue-100 text-teal-700' : 'bg-gray-100'}`}>{d.type}</span> {d.name} ({d.code})</div>)}
                  {!diagnoses.length && <div className="text-gray-400">None</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Prescription ({prescriptions.length})</div>
                  {prescriptions.map((p, i) => <div key={i}>{p.drug} {p.dose} {p.frequency} × {p.duration}</div>)}
                  {!prescriptions.length && <div className="text-gray-400">None</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-1">Investigations ({investigations.length})</div>
                  {investigations.map((inv, i) => <div key={i}>{inv.name} <span className={inv.urgency === 'stat' ? 'text-red-600' : ''}>[{inv.urgency}]</span></div>)}
                  {!investigations.length && <div className="text-gray-400">None</div>}
                </div>
              </div>
              {advice && <div className="bg-gray-50 rounded-lg p-3 text-xs"><div className="font-bold text-gray-700 mb-1">Advice</div><div className="whitespace-pre-line">{advice}</div></div>}
              {followUpDate && <div className="text-xs"><span className="font-bold text-gray-700">Follow-up:</span> {new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</div>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => saveEncounter(false)} disabled={saving} className="px-6 py-2.5 bg-gray-200 text-sm rounded-lg disabled:opacity-40">{saving ? 'Saving...' : 'Save Draft'}</button>
                <button onClick={() => saveEncounter(true)} disabled={saving || !complaints.length}
                  className="px-8 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">{saving ? 'Signing...' : 'Sign & Complete'}</button>
                {prescriptions.length > 0 && <button onClick={() => {
                  const rxRows = prescriptions.map((p, i) =>
                    `<tr><td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px">${i+1}</td><td style="padding:4px 6px;border:1px solid #ddd;font-size:10px"><b>${p.drug}</b> (${p.generic}) ${p.dose}</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px">${p.route}</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px">${p.frequency}</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px">${p.duration}</td><td style="padding:4px 6px;border:1px solid #ddd;font-size:9px">${p.instructions}</td></tr>`
                  ).join('');
                  const dxLine = diagnoses.map(d => `${d.name} (${d.code})`).join(', ');
                  openPrintWindow(`<div style="max-width:600px;margin:0 auto;font-family:Segoe UI,Arial;color:#1a1a1a">
                    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #1e40af;padding-bottom:8px;margin-bottom:10px">
                      <img src="${LOGO_SVG}" style="width:140px;height:auto" alt="Health1" />
                      <div style="flex:1">
                        <div style="font-size:8px;color:#666">${HOSPITAL.address}</div>
                        <div style="font-size:8px;color:#666">Ph: ${HOSPITAL.phone} | GSTIN: ${HOSPITAL.gstin}</div>
                      </div>
                      <div style="font-size:12px;font-weight:700;color:#dc2626">&#x211E; PRESCRIPTION</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;padding:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:10px">
                      <div><b>Patient:</b> ${patient.name}</div><div><b>UHID:</b> ${patient.uhid}</div>
                      <div><b>Age/Sex:</b> ${patient.age}/${patient.gender}</div><div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
                      <div><b>Doctor:</b> Dr. ${staff?.full_name || ''}</div>${dxLine ? `<div><b>Dx:</b> ${dxLine}</div>` : ''}
                    </div>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr style="background:#eff6ff">
                      <th style="padding:4px;border:1px solid #ddd;font-size:9px;width:30px">#</th><th style="padding:4px;border:1px solid #ddd;text-align:left;font-size:9px">Medication</th><th style="padding:4px;border:1px solid #ddd;font-size:9px">Route</th><th style="padding:4px;border:1px solid #ddd;font-size:9px">Freq</th><th style="padding:4px;border:1px solid #ddd;font-size:9px">Duration</th><th style="padding:4px;border:1px solid #ddd;font-size:9px">Instructions</th>
                    </tr></thead><tbody>${rxRows}</tbody></table>
                    ${advice ? `<div style="font-size:9px;padding:6px;background:#fef3c7;border:1px solid #fbbf24;border-radius:4px;margin-bottom:8px"><b>Advice:</b> ${advice}</div>` : ''}
                    ${followUpDate ? `<div style="font-size:9px;margin-bottom:8px"><b>Follow-up:</b> ${new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</div>` : ''}
                    <div style="margin-top:40px;text-align:right;font-size:10px"><div style="border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:200px">Dr. ${staff?.full_name || ''}<br/>${staff?.specialisation || ''}</div></div>
                  </div>`, `Rx-${patient.uhid}`);
                }} className="px-4 py-2.5 bg-amber-500 text-white text-sm rounded-lg">Print Rx Pad</button>}
                <button onClick={() => {
                  printEncounterSummary({
                    patientName: patient.name, uhid: patient.uhid, ageGender: `${patient.age}/${patient.gender}`,
                    doctorName: staff?.full_name || '', date: new Date().toLocaleDateString('en-IN'),
                    encounterType: 'OPD', status: 'Completed',
                    vitals: { systolic: vitals.systolic, diastolic: vitals.diastolic, heartRate: vitals.heartRate, spo2: vitals.spo2, temperature: vitals.temperature, weight: vitals.weight },
                    complaints: complaints.map(c => generateComplaintText(c)),
                    examFindings: Object.entries(examFindings).map(([sys, vals]) => ({ system: sys, findings: JSON.stringify(vals) })),
                    diagnoses: diagnoses.map(d => ({ code: d.code, label: d.name, type: d.type })),
                    investigations: investigations.map(inv => ({ name: inv.name, urgency: inv.urgency })),
                    prescriptions: prescriptions.map(p => ({ brand: p.drug, generic: p.generic, strength: p.dose, dose: p.dose, frequency: p.frequency, duration: p.duration, instructions: p.instructions })),
                    advice: advice ? [advice] : [], followUp: followUpDate || '',
                  }, HOSPITAL);
                }} className="px-4 py-2.5 bg-teal-600 text-white text-sm rounded-lg">Print Summary</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        {(showHistory || showImaging || showLab || showCopilot) && (
          <div className="w-80 flex-shrink-0 space-y-3">
            {showHistory && <div className="bg-white rounded-xl border p-3 max-h-96 overflow-y-auto">
              <h3 className="text-xs font-bold text-gray-500 mb-2">Past Encounters ({emr.pastEncounters.length})</h3>
              {emr.pastEncounters.length === 0 ? <div className="text-xs text-gray-400">No past encounters</div> :
              emr.pastEncounters.slice(0, 10).map((enc: any) => (
                <div key={enc.id} className="border-b py-2 last:border-0">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">{new Date(enc.date || enc.encounter_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <button onClick={async () => { const data = await emr.cloneEncounter(enc.id); if (data) flash('Encounter cloned'); }}
                      className="text-teal-600 hover:underline">Clone</button>
                  </div>
                  <div className="text-xs font-medium">{enc.diagnosis || enc.chief_complaint || 'Encounter'}</div>
                  {enc.doctor && <div className="text-[10px] text-gray-400">{enc.doctor}</div>}
                </div>
              ))}
            </div>}

            {showImaging && patient.id && <div className="max-h-96 overflow-y-auto"><PatientImagingPanel patientId={patient.id} compact /></div>}

            {showLab && patient.id && <div className="max-h-96 overflow-y-auto"><PatientLabHistory patientId={patient.id} compact /></div>}

            {showCopilot && <AICopilot
              patient={{ name: patient.name, age: patient.age, gender: patient.gender, allergies: patient.allergies }}
              vitals={vitals} complaints={complaints.map(c => generateComplaintText(c))}
              examFindings={Object.entries(examFindings).map(([sys, vals]) => ({ system: sys, ...vals }))}
              diagnoses={diagnoses.map(d => ({ code: d.code, label: d.name, type: d.type }))}
              investigations={investigations}
              prescriptions={prescriptions.map(p => `${p.drug} ${p.dose} ${p.frequency}`)}
              advice={advice ? advice.split('\n') : []}
              followUp={followUpDate}
              isOpen={showCopilot} onClose={() => setShowCopilot(false)}
              onAddDiagnosis={(dx) => setDiagnoses(prev => [...prev, { code: dx.code, name: dx.label, type: 'differential' as const, notes: '' }])}
              onAddInvestigation={(name) => setInvestigations(prev => [...prev, { name, type: 'lab' as const, urgency: 'routine' as const, notes: '' }])}
            />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EMRv2Page() {
  return <Suspense fallback={<div className="max-w-7xl mx-auto p-4 animate-pulse"><div className="h-12 bg-gray-200 rounded-xl mb-4" /><div className="h-64 bg-gray-200 rounded-xl" /></div>}>
    <EMRInner />
  </Suspense>;
}
