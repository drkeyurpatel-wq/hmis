// components/emr/emr-page.tsx
// Main EMR single-page orchestrator
// Two-panel layout: Documentation (left) + Orders (right) on desktop
// Single column accordion on mobile
// Carries forward all CDSS, Smart Builders, downstream wiring from emr-v2
'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEMR } from '@/lib/emr/use-emr';
import { useAuthStore } from '@/lib/store/auth';
import { useScribe, type ScribeResponse } from '@/lib/emr/use-scribe';
import { sb } from '@/lib/supabase/browser';
import { printEncounterSummary } from '@/components/ui/shared';
import { smartPostLabCharge, smartPostRadiologyCharge } from '@/lib/bridge/cross-module-bridge';
import { generateComplaintText, type ActiveComplaint } from '@/components/emr/smart-complaint-builder';
import { generateExamText, type ExamFindings } from '@/components/emr/smart-exam-builder';

// New SP3 components
import PatientBannerV3 from './patient-banner-v3';
import VitalsCompact, { type VitalValues } from './vitals-compact';
import SectionCard from './section-card';
import ComplaintSection from './complaint-section';
import ExamSection from './exam-section';
import DiagnosisSection from './diagnosis-section';
import RxSection from './rx-section';
import InvestigationSection from './investigation-section';
import AdviceSection from './advice-section';
import ActionBar from './action-bar';
import RxPrint, { triggerRxPrint } from './rx-print';

// Sidebar panels (carry forward)
import PatientImagingPanel from '@/components/radiology/patient-imaging-panel';
import PatientLabHistory from '@/components/lab/patient-lab-history';
import AICopilot from '@/components/emr-v2/ai-copilot';

// Icons
import {
  Stethoscope, ClipboardList, Search as SearchIcon,
  FileHeart, Pill, FlaskConical, MessageSquareText
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Patient {
  id: string; name: string; age: string; gender: string;
  uhid: string; phone: string; allergies: string[]; bloodGroup: string;
}
interface DiagnosisEntry { code: string; name: string; type: 'primary' | 'secondary' | 'differential'; notes: string; }
interface RxEntry {
  drug: string; generic: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
  isSOS: boolean; category: string;
}
interface InvestigationEntry { name: string; type: 'lab' | 'radiology'; urgency: 'routine' | 'urgent' | 'stat'; notes: string; }

const EMPTY_PATIENT: Patient = { id: '', name: '', age: '--', gender: '--', uhid: 'H1-00000', phone: '', allergies: [], bloodGroup: '' };
const EMPTY_VITALS: VitalValues = { systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '', weight: '', height: '', respiratoryRate: '', isAlert: true, onO2: false };
const EMPTY_REFERRAL = { department: '', doctor: '', reason: '', urgency: 'routine' };

export default function EMRPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedPatient = searchParams.get('patient');
  const opdVisitId = searchParams.get('visit');
  const emr = useEMR();
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';
  const centreId = activeCentreId || '';

  // ── Patient state ──
  const [patient, setPatient] = useState<Patient>(EMPTY_PATIENT);
  const [showSearch, setShowSearch] = useState(!preselectedPatient);
  const [searchQ, setSearchQ] = useState('');
  const [encounterStart, setEncounterStart] = useState<number | null>(null);

  // ── Clinical data ──
  const [vitals, setVitals] = useState<VitalValues>(EMPTY_VITALS);
  const [complaints, setComplaints] = useState<ActiveComplaint[]>([]);
  const [complaintFreeText, setComplaintFreeText] = useState('');
  const [complaintMode, setComplaintMode] = useState<'builder' | 'freetext'>('builder');
  const [examFindings, setExamFindings] = useState<ExamFindings>({});
  const [examFreeText, setExamFreeText] = useState('');
  const [examMode, setExamMode] = useState<'builder' | 'freetext'>('builder');
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [prescriptions, setPrescriptions] = useState<RxEntry[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationEntry[]>([]);
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [referral, setReferral] = useState(EMPTY_REFERRAL);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showImaging, setShowImaging] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  // ── AI Scribe state ──
  const scribe = useScribe();
  const [scribeEnabled, setScribeEnabled] = useState(false);
  const [aiSuggested, setAiSuggested] = useState({
    complaints: false, exam: false, diagnosis: false,
    rx: false, investigations: false, advice: false,
  });

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const pendingAiReview = useMemo(() =>
    Object.values(aiSuggested).filter(Boolean).length,
  [aiSuggested]);

  // ── Section completion indicators ──
  const filled = useMemo(() => ({
    vitals: !!(vitals.systolic || vitals.heartRate),
    complaints: complaints.length > 0 || !!complaintFreeText,
    exam: Object.keys(examFindings).length > 0 || !!examFreeText,
    diagnosis: diagnoses.length > 0,
    rx: prescriptions.length > 0,
    investigations: investigations.length > 0,
    advice: !!(followUpDate || advice),
  }), [vitals, complaints, complaintFreeText, examFindings, examFreeText, diagnoses, prescriptions, investigations, followUpDate, advice]);

  // ── Patient loading ──
  useEffect(() => {
    if (preselectedPatient) selectPatientById(preselectedPatient);
  }, [preselectedPatient]);

  // Auto-mark OPD visit as "with_doctor"
  useEffect(() => {
    if (opdVisitId && sb()) {
      sb()!.from('hmis_opd_visits').update({ status: 'with_doctor', consultation_start: new Date().toISOString() })
        .eq('id', opdVisitId).in('status', ['waiting', 'checked_in']);
    }
  }, [opdVisitId]);

  const selectPatientById = async (id: string) => {
    if (!sb()) return;
    const { data: pt } = await sb()!.from('hmis_patients')
      .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, blood_group')
      .eq('id', id).single();
    if (!pt) return;
    const { data: allergies } = await sb()!.from('hmis_patient_allergies').select('allergen').eq('patient_id', id);

    // Reset ALL clinical state
    setVitals(EMPTY_VITALS);
    setComplaints([]); setComplaintFreeText(''); setComplaintMode('builder');
    setExamFindings({}); setExamFreeText(''); setExamMode('builder');
    setDiagnoses([]); setPrescriptions([]); setInvestigations([]);
    setAdvice(''); setFollowUpDate('');
    setReferral(EMPTY_REFERRAL);
    setAiSuggested({ complaints: false, exam: false, diagnosis: false, rx: false, investigations: false, advice: false });
    scribe.clearResult();

    setPatient({
      id: pt.id, name: `${pt.first_name} ${pt.last_name || ''}`.trim(),
      age: pt.age_years?.toString() || '--', gender: pt.gender || '--',
      uhid: pt.uhid, phone: pt.phone_primary || '',
      allergies: (allergies || []).map((a: any) => a.allergen),
      bloodGroup: pt.blood_group || '',
    });
    emr.selectPatient(id);
    setShowSearch(false);
    setEncounterStart(Date.now());
  };

  // ── AI Scribe: Apply results to fields ──
  useEffect(() => {
    if (!scribe.result) return;
    const r = scribe.result;
    const flags = { complaints: false, exam: false, diagnosis: false, rx: false, investigations: false, advice: false };

    if (r.complaints) {
      setComplaintFreeText(r.complaints);
      setComplaintMode('freetext');
      flags.complaints = true;
    }
    if (r.examination && r.examination.length > 0) {
      const examText = r.examination.map(e => `${e.system}: ${e.findings}`).join('\n');
      setExamFreeText(examText);
      setExamMode('freetext');
      flags.exam = true;
    }
    if (r.diagnoses && r.diagnoses.length > 0) {
      setDiagnoses(r.diagnoses.map(d => ({
        code: d.icd10 || '', name: d.name,
        type: (d.type as any) || 'primary', notes: '',
      })));
      flags.diagnosis = true;
    }
    if (r.prescriptions && r.prescriptions.length > 0) {
      setPrescriptions(r.prescriptions.map(p => ({
        drug: p.drug, generic: '', dose: p.dose || '',
        route: p.route || 'Oral', frequency: p.frequency || 'OD (once daily)',
        duration: p.duration || '5 days', instructions: p.instructions || '',
        isSOS: false, category: '',
      })));
      flags.rx = true;
    }
    if (r.advice) {
      setAdvice(r.advice);
      flags.advice = true;
    }
    if (r.followUp) {
      // Try to parse follow-up as a date
      try {
        const d = new Date(r.followUp);
        if (!isNaN(d.getTime())) {
          setFollowUpDate(d.toISOString().split('T')[0]);
        }
      } catch { /* ignore */ }
      flags.advice = true;
    }

    setAiSuggested(flags);
    flash('AI Scribe processed — review highlighted sections');
  }, [scribe.result]);

  // ── AI confirm handlers ──
  const confirmAi = (section: keyof typeof aiSuggested) => {
    setAiSuggested(prev => ({ ...prev, [section]: false }));
  };

  // ── Save encounter ──
  const saveEncounter = async (sign: boolean = false) => {
    if (!patient.id) { flash('Select a patient first'); return; }
    if (sign && pendingAiReview > 0) { flash('Review all AI-suggested sections before signing'); return; }
    setSaving(true);

    const complaintText = complaintMode === 'builder'
      ? complaints.map(c => generateComplaintText(c)).join('; ')
      : complaintFreeText;
    const examText = examMode === 'builder'
      ? generateExamText(examFindings)
      : examFreeText;

    const encounterData = {
      patientId: patient.id,
      vitals: { ...vitals },
      complaints: complaintMode === 'builder'
        ? complaints.map(c => ({ complaint: c.template.name, text: generateComplaintText(c), values: c.values }))
        : [{ complaint: 'Free text', text: complaintFreeText, values: {} }],
      examination: examText,
      diagnoses: diagnoses.map(d => ({ ...d })),
      prescriptions: prescriptions.map(p => ({ ...p })),
      investigations: investigations.map(i => ({ ...i })),
      advice, followUpDate,
      referral: referral.department ? referral : undefined,
    };

    const result = await emr.saveEncounter(encounterData as any);
    if (result.success) {
      if (sign && sb() && centreId) {
        const encounterId = result.id || null;
        const clinicalIndication = diagnoses.map(d => d.name).join(', ');

        // Lab orders
        const labInvs = investigations.filter(i => i.type === 'lab');
        for (const inv of labInvs) {
          let testId: string | null = null;
          const { data: testExact } = await sb()!.from('hmis_lab_test_master')
            .select('id').ilike('test_name', inv.name).eq('is_active', true).limit(1).maybeSingle();
          if (testExact) testId = testExact.id;
          else {
            const keyword = inv.name.split(/[\s\-\/\(\)]+/).filter((w: string) => w.length > 2)[0];
            if (keyword) {
              const { data: testFuzzy } = await sb()!.from('hmis_lab_test_master')
                .select('id').ilike('test_name', `%${keyword}%`).eq('is_active', true).limit(1).maybeSingle();
              if (testFuzzy) testId = testFuzzy.id;
            }
          }
          const { data: labOrder } = await sb()!.from('hmis_lab_orders').insert({
            centre_id: centreId, patient_id: patient.id, test_id: testId, test_name: inv.name,
            encounter_id: encounterId, clinical_info: clinicalIndication || inv.notes || null,
            status: 'ordered', ordered_by: staffId,
            priority: inv.urgency === 'stat' ? 'stat' : inv.urgency === 'urgent' ? 'urgent' : 'routine',
          }).select('id').maybeSingle();
          await smartPostLabCharge({ centreId, patientId: patient.id, testName: inv.name, staffId, labOrderId: labOrder?.id });
        }

        // Radiology orders
        const radInvs = investigations.filter(i => i.type === 'radiology');
        for (const inv of radInvs) {
          const modality = inv.name.split(' ')[0] || inv.name;
          const bodyPart = inv.name.replace(/^(X-Ray|CT|MRI|USG|HRCT|2D)\s*/i, '').trim() || inv.name;
          let radTestId: string | null = null;
          const { data: radExact } = await sb()!.from('hmis_radiology_test_master')
            .select('id').ilike('test_name', inv.name).eq('is_active', true).limit(1).maybeSingle();
          if (radExact) radTestId = radExact.id;
          else {
            const { data: radFuzzy } = await sb()!.from('hmis_radiology_test_master')
              .select('id').ilike('test_name', `%${bodyPart}%`).eq('modality', modality).eq('is_active', true).limit(1).maybeSingle();
            if (radFuzzy) radTestId = radFuzzy.id;
          }
          const accession = `RAD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
          const { data: radOrder } = await sb()!.from('hmis_radiology_orders').insert({
            centre_id: centreId, patient_id: patient.id, test_id: radTestId, test_name: inv.name,
            accession_number: accession, modality, body_part: bodyPart, encounter_id: encounterId,
            clinical_indication: clinicalIndication || inv.notes || null,
            status: 'ordered', ordered_by: staffId,
            urgency: inv.urgency === 'stat' ? 'stat' : 'routine',
          }).select('id').maybeSingle();
          await smartPostRadiologyCharge({ centreId, patientId: patient.id, testName: inv.name, staffId, radiologyOrderId: radOrder?.id });
        }

        // Pharmacy
        if (prescriptions.length > 0) {
          await sb()!.from('hmis_pharmacy_dispensing').insert({
            centre_id: centreId, patient_id: patient.id, encounter_id: encounterId,
            prescription_data: prescriptions.map(p => ({
              drug: p.drug, generic: p.generic, dose: p.dose,
              route: p.route, frequency: p.frequency, duration: p.duration, instructions: p.instructions,
            })),
            status: 'pending',
          });
        }

        const parts = [];
        if (labInvs.length > 0) parts.push(`${labInvs.length} lab`);
        if (radInvs.length > 0) parts.push(`${radInvs.length} radiology`);
        if (prescriptions.length > 0) parts.push(`${prescriptions.length} Rx to pharmacy`);
        if (parts.length > 0) flash(`Signed + ${parts.join(' + ')} orders created`);
      }

      flash(sign ? 'Encounter signed & saved' : (result.offline ? 'Saved offline — will sync' : 'Encounter saved'));

      if (sign) {
        if (opdVisitId && sb()) {
          await sb()!.from('hmis_opd_visits').update({
            status: 'completed', consultation_end: new Date().toISOString(),
          }).eq('id', opdVisitId);
        }
        // Reset for next patient
        setPatient(EMPTY_PATIENT); setVitals(EMPTY_VITALS);
        setComplaints([]); setComplaintFreeText(''); setExamFindings({}); setExamFreeText('');
        setDiagnoses([]); setPrescriptions([]); setInvestigations([]);
        setAdvice(''); setFollowUpDate(''); setReferral(EMPTY_REFERRAL);
        setEncounterStart(null);
        setAiSuggested({ complaints: false, exam: false, diagnosis: false, rx: false, investigations: false, advice: false });
        scribe.clearResult();
        setShowSearch(true);
        if (opdVisitId) router.push('/opd');
      }
    } else {
      flash('Save failed — try again');
    }
    setSaving(false);
  };

  // ── Scribe toggle ──
  const handleToggleScribe = () => {
    if (scribe.isRecording) {
      scribe.stopAndProcess();
    } else if (scribeEnabled) {
      setScribeEnabled(false);
      scribe.cancel();
    } else {
      setScribeEnabled(true);
    }
  };

  const handleStartScribe = () => {
    if (scribeEnabled && !scribe.isRecording && !scribe.isProcessing) {
      scribe.startRecording();
    }
  };

  // ── Print handlers ──
  const handlePrintSummary = () => {
    printEncounterSummary({
      patientName: patient.name, uhid: patient.uhid, ageGender: `${patient.age}/${patient.gender}`,
      doctorName: staff?.full_name || '', date: new Date().toLocaleDateString('en-IN'),
      encounterType: 'OPD', status: 'Completed',
      vitals: { systolic: vitals.systolic, diastolic: vitals.diastolic, heartRate: vitals.heartRate, spo2: vitals.spo2, temperature: vitals.temperature, weight: vitals.weight },
      complaints: complaintMode === 'builder' ? complaints.map(c => generateComplaintText(c)) : [complaintFreeText],
      examFindings: examMode === 'builder'
        ? Object.entries(examFindings).map(([sys, vals]) => ({ system: sys, findings: JSON.stringify(vals) }))
        : [{ system: 'General', findings: examFreeText }],
      diagnoses: diagnoses.map(d => ({ code: d.code, label: d.name, type: d.type })),
      investigations: investigations.map(inv => ({ name: inv.name, urgency: inv.urgency })),
      prescriptions: prescriptions.map(p => ({ brand: p.drug, generic: p.generic, strength: p.dose, dose: p.dose, frequency: p.frequency, duration: p.duration, instructions: p.instructions })),
      advice: advice ? [advice] : [], followUp: followUpDate || '',
    }, { name: 'Health1 Super Speciality Hospitals', address: '', phone: '', tagline: 'NABH Accredited' });
  };

  // ── Has sidebar open? ──
  const hasSidebar = showHistory || showImaging || showLab || showCopilot;

  return (
    <div className="max-w-[1600px] mx-auto space-y-2">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-navy text-white
          px-5 py-2.5 rounded-h1 shadow-h1-modal text-h1-body font-medium animate-h1-fade-in">
          {toast}
        </div>
      )}

      {/* Scribe processing overlay */}
      {scribe.isProcessing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-h1-card rounded-h1-lg p-6 shadow-h1-modal text-center max-w-sm animate-h1-fade-in">
            <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-h1-section text-h1-navy">Processing consultation...</div>
            <div className="text-h1-small text-h1-text-muted mt-1">AI Scribe is structuring the transcript</div>
          </div>
        </div>
      )}

      {/* Patient Banner */}
      <PatientBannerV3
        patient={patient}
        onSearch={() => setShowSearch(true)}
        showHistory={showHistory} onToggleHistory={() => setShowHistory(!showHistory)}
        showLab={showLab} onToggleLab={() => setShowLab(!showLab)}
        showImaging={showImaging} onToggleImaging={() => setShowImaging(!showImaging)}
        showCopilot={showCopilot} onToggleCopilot={() => setShowCopilot(!showCopilot)}
        scribeEnabled={scribeEnabled} onToggleScribe={handleToggleScribe}
        scribeActive={scribe.isRecording}
      />

      {/* Patient Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center pt-20"
          onClick={() => { if (patient.id) setShowSearch(false); else router.back(); }}>
          <div className="bg-h1-card rounded-h1-lg w-[500px] p-5 shadow-h1-modal animate-h1-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h1-section text-h1-navy">Search Patient</h3>
              <button onClick={() => { if (patient.id) setShowSearch(false); else router.back(); }}
                className="text-h1-small text-h1-text-muted hover:text-h1-text px-2 py-1 rounded-h1-sm
                  hover:bg-h1-navy/5 transition-colors cursor-pointer">
                ← {patient.id ? 'Close' : 'Back'}
              </button>
            </div>
            <input
              type="text" value={searchQ}
              onChange={e => { setSearchQ(e.target.value); emr.searchPatient(e.target.value); }}
              className="w-full px-4 py-3 border border-h1-border rounded-h1 text-h1-body
                focus:outline-none focus:ring-2 focus:ring-h1-teal focus:border-h1-teal"
              placeholder="Type UHID, name, or phone..." autoFocus
            />
            {emr.searchResults.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto border border-h1-border rounded-h1">
                {emr.searchResults.map((p: any) => (
                  <button key={p.id} onClick={() => { selectPatientById(p.id); setSearchQ(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-h1-teal/5 border-b border-h1-border
                      last:border-0 flex justify-between items-center transition-colors cursor-pointer">
                    <div>
                      <span className="font-medium text-h1-text">{p.first_name} {p.last_name}</span>
                      <span className="text-h1-small text-h1-text-muted ml-2">{p.uhid}</span>
                    </div>
                    <span className="text-h1-small text-h1-text-secondary">
                      {p.age_years}y {p.gender} {p.phone_primary ? `| ${p.phone_primary}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {emr.todayQueue.length > 0 && !searchQ && (
              <div className="mt-3">
                <div className="text-h1-small text-h1-text-muted mb-1 font-medium">
                  Today's Queue ({emr.todayQueue.length})
                </div>
                <div className="max-h-48 overflow-y-auto border border-h1-border rounded-h1">
                  {emr.todayQueue.map((q: any) => (
                    <button key={q.id} onClick={() => selectPatientById(q.patient_id || q.id)}
                      className="w-full text-left px-3 py-2 hover:bg-h1-teal/5 border-b border-h1-border
                        last:border-0 text-h1-small transition-colors cursor-pointer">
                      <span className="font-medium text-h1-text">{q.patient_name || q.name}</span>
                      <span className="text-h1-text-muted ml-2">{q.uhid || q.token}</span>
                      {q.status && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium
                          ${q.status === 'waiting' ? 'bg-h1-yellow/10 text-h1-yellow' : 'bg-h1-success/10 text-h1-success'}`}>
                          {q.status}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scribe recording banner */}
      {scribeEnabled && scribe.isRecording && (
        <div className="bg-purple-50 border border-purple-200 rounded-h1 px-4 py-2 flex items-center gap-3
          animate-h1-fade-in">
          <span className="w-3 h-3 bg-purple-600 rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-h1-small font-semibold text-purple-700">AI Scribe Recording</div>
            <div className="text-[10px] text-purple-500 truncate">
              {scribe.rawTranscript ? scribe.rawTranscript.slice(-100) + '...' : 'Listening to consultation...'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scribe.stopAndProcess()}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-h1-sm
              hover:bg-purple-700 transition-colors cursor-pointer flex-shrink-0"
          >
            Stop & Process
          </button>
          <button
            type="button"
            onClick={() => scribe.cancel()}
            className="px-2 py-1.5 text-xs text-purple-600 hover:bg-purple-100 rounded-h1-sm
              transition-colors cursor-pointer flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Scribe start prompt */}
      {scribeEnabled && !scribe.isRecording && !scribe.isProcessing && !scribe.result && patient.id && (
        <div className="bg-purple-50 border border-purple-200 rounded-h1 px-4 py-3 flex items-center gap-3
          animate-h1-fade-in">
          <div className="flex-1">
            <div className="text-h1-small font-semibold text-purple-700">AI Scribe Ready</div>
            <div className="text-[10px] text-purple-500">Start recording when the consultation begins</div>
          </div>
          <button
            type="button"
            onClick={handleStartScribe}
            className="px-4 py-2 text-xs font-semibold bg-purple-600 text-white rounded-h1-sm
              hover:bg-purple-700 transition-colors cursor-pointer"
          >
            Start Recording
          </button>
        </div>
      )}

      {/* Scribe error */}
      {scribe.error && (
        <div className="bg-h1-red/5 border border-h1-red/20 rounded-h1 px-4 py-2 text-h1-small text-h1-red">
          Scribe error: {scribe.error}
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex gap-3">
        {/* Left + Right panels */}
        <div className={`flex-1 min-w-0 flex gap-3 ${hasSidebar ? '' : ''}`}>
          {/* LEFT PANEL — Documentation */}
          <div className="flex-1 min-w-0 space-y-2 lg:flex-[58]">
            {/* Vitals */}
            <VitalsCompact vitals={vitals} onChange={setVitals} />

            {/* Chief Complaint */}
            <SectionCard
              title="Chief Complaint"
              icon={<ClipboardList className="w-3 h-3 text-h1-teal" />}
              completed={filled.complaints}
              summary={complaintMode === 'builder' && complaints.length > 0
                ? `${complaints.length} complaint${complaints.length > 1 ? 's' : ''}`
                : complaintFreeText ? complaintFreeText.slice(0, 60) + '...' : undefined}
            >
              <ComplaintSection
                complaints={complaints} setComplaints={setComplaints}
                freeText={complaintFreeText} setFreeText={setComplaintFreeText}
                mode={complaintMode} setMode={setComplaintMode}
                aiSuggested={aiSuggested.complaints}
                onConfirmAi={() => confirmAi('complaints')}
              />
            </SectionCard>

            {/* Examination */}
            <SectionCard
              title="Physical Examination"
              icon={<Stethoscope className="w-3 h-3 text-h1-teal" />}
              completed={filled.exam}
              summary={examMode === 'builder' && Object.keys(examFindings).length > 0
                ? `${Object.keys(examFindings).length} system${Object.keys(examFindings).length > 1 ? 's' : ''}`
                : examFreeText ? examFreeText.slice(0, 60) + '...' : undefined}
            >
              <ExamSection
                findings={examFindings} setFindings={setExamFindings}
                freeText={examFreeText} setFreeText={setExamFreeText}
                mode={examMode} setMode={setExamMode}
                aiSuggested={aiSuggested.exam}
                onConfirmAi={() => confirmAi('exam')}
              />
            </SectionCard>

            {/* Diagnosis */}
            <SectionCard
              title="Diagnosis"
              icon={<FileHeart className="w-3 h-3 text-h1-teal" />}
              completed={filled.diagnosis}
              badge={diagnoses.length || undefined}
              summary={diagnoses.length > 0 ? diagnoses.map(d => d.name).join(', ') : undefined}
            >
              <DiagnosisSection
                diagnoses={diagnoses} onChange={setDiagnoses}
                aiSuggested={aiSuggested.diagnosis}
                onConfirmAi={() => confirmAi('diagnosis')}
              />
            </SectionCard>
          </div>

          {/* RIGHT PANEL — Orders (hidden on mobile, stacked below) */}
          <div className="hidden lg:block lg:flex-[42] space-y-2">
            {/* Prescription */}
            <SectionCard
              title="Prescription"
              icon={<Pill className="w-3 h-3 text-h1-teal" />}
              completed={filled.rx}
              badge={prescriptions.length || undefined}
            >
              <RxSection
                prescriptions={prescriptions} onChange={setPrescriptions}
                allergies={patient.allergies}
                patientId={patient.id} staffId={staffId} centreId={centreId}
                onFlash={flash}
                aiSuggested={aiSuggested.rx}
                onConfirmAi={() => confirmAi('rx')}
              />
            </SectionCard>

            {/* Investigations */}
            <SectionCard
              title="Investigations"
              icon={<FlaskConical className="w-3 h-3 text-h1-teal" />}
              completed={filled.investigations}
              badge={investigations.length || undefined}
            >
              <InvestigationSection
                investigations={investigations} onChange={setInvestigations}
                aiSuggested={aiSuggested.investigations}
                onConfirmAi={() => confirmAi('investigations')}
              />
            </SectionCard>

            {/* Follow-up & Advice */}
            <SectionCard
              title="Follow-up & Advice"
              icon={<MessageSquareText className="w-3 h-3 text-h1-teal" />}
              completed={filled.advice}
            >
              <AdviceSection
                advice={advice} setAdvice={setAdvice}
                followUpDate={followUpDate} setFollowUpDate={setFollowUpDate}
                referral={referral} setReferral={setReferral}
                aiSuggested={aiSuggested.advice}
                onConfirmAi={() => confirmAi('advice')}
              />
            </SectionCard>
          </div>
        </div>

        {/* Mobile-only: Orders below documentation */}
        <div className="lg:hidden space-y-2">
          <SectionCard title="Prescription" icon={<Pill className="w-3 h-3 text-h1-teal" />}
            completed={filled.rx} badge={prescriptions.length || undefined} defaultOpen={false}>
            <RxSection prescriptions={prescriptions} onChange={setPrescriptions}
              allergies={patient.allergies} patientId={patient.id} staffId={staffId}
              centreId={centreId} onFlash={flash}
              aiSuggested={aiSuggested.rx} onConfirmAi={() => confirmAi('rx')} />
          </SectionCard>
          <SectionCard title="Investigations" icon={<FlaskConical className="w-3 h-3 text-h1-teal" />}
            completed={filled.investigations} badge={investigations.length || undefined} defaultOpen={false}>
            <InvestigationSection investigations={investigations} onChange={setInvestigations}
              aiSuggested={aiSuggested.investigations} onConfirmAi={() => confirmAi('investigations')} />
          </SectionCard>
          <SectionCard title="Follow-up & Advice" icon={<MessageSquareText className="w-3 h-3 text-h1-teal" />}
            completed={filled.advice} defaultOpen={false}>
            <AdviceSection advice={advice} setAdvice={setAdvice} followUpDate={followUpDate}
              setFollowUpDate={setFollowUpDate} referral={referral} setReferral={setReferral}
              aiSuggested={aiSuggested.advice} onConfirmAi={() => confirmAi('advice')} />
          </SectionCard>
        </div>

        {/* Sidebar (History / Lab / Imaging / Copilot) */}
        {hasSidebar && (
          <div className="hidden md:block w-72 flex-shrink-0 space-y-2 animate-h1-slide-in">
            {showHistory && (
              <div className="bg-h1-card rounded-h1 border border-h1-border p-3 max-h-96 overflow-y-auto shadow-h1-card">
                <h3 className="text-h1-small font-semibold text-h1-text-muted mb-2">
                  Past Encounters ({emr.pastEncounters.length})
                </h3>
                {emr.pastEncounters.length === 0
                  ? <div className="text-h1-small text-h1-text-muted">No past encounters</div>
                  : emr.pastEncounters.slice(0, 10).map((enc: any) => (
                    <div key={enc.id} className="border-b border-h1-border py-2 last:border-0">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-h1-text-muted">
                          {new Date(enc.date || enc.encounter_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <button onClick={async () => { const data = await emr.cloneEncounter(enc.id); if (data) flash('Encounter cloned'); }}
                          className="text-h1-teal hover:underline cursor-pointer">Clone</button>
                      </div>
                      <div className="text-h1-small font-medium text-h1-text">{enc.diagnosis || enc.chief_complaint || 'Encounter'}</div>
                      {enc.doctor && <div className="text-[10px] text-h1-text-muted">{enc.doctor}</div>}
                    </div>
                  ))}
              </div>
            )}
            {showImaging && patient.id && (
              <div className="max-h-96 overflow-y-auto"><PatientImagingPanel patientId={patient.id} compact /></div>
            )}
            {showLab && patient.id && (
              <div className="max-h-96 overflow-y-auto"><PatientLabHistory patientId={patient.id} compact /></div>
            )}
            {showCopilot && (
              <AICopilot
                patient={{ name: patient.name, age: patient.age, gender: patient.gender, allergies: patient.allergies }}
                vitals={vitals}
                complaints={complaintMode === 'builder' ? complaints.map(c => generateComplaintText(c)) : [complaintFreeText]}
                examFindings={examMode === 'builder'
                  ? Object.entries(examFindings).map(([sys, vals]) => ({ system: sys, ...vals }))
                  : [{ system: 'General', findings: examFreeText }]}
                diagnoses={diagnoses.map(d => ({ code: d.code, label: d.name, type: d.type }))}
                investigations={investigations}
                prescriptions={prescriptions.map(p => `${p.drug} ${p.dose} ${p.frequency}`)}
                advice={advice ? advice.split('\n') : []}
                followUp={followUpDate}
                isOpen={showCopilot} onClose={() => setShowCopilot(false)}
                onAddDiagnosis={(dx) => setDiagnoses(prev => [...prev, { code: dx.code, name: dx.label, type: 'differential' as const, notes: '' }])}
                onAddInvestigation={(name) => setInvestigations(prev => [...prev, { name, type: 'lab' as const, urgency: 'routine' as const, notes: '' }])}
              />
            )}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <ActionBar
        saving={saving}
        canSign={filled.complaints && !!patient.id}
        hasRx={prescriptions.length > 0}
        startTime={encounterStart}
        onSaveDraft={() => saveEncounter(false)}
        onSign={() => saveEncounter(true)}
        onPrintRx={triggerRxPrint}
        onPrintSummary={handlePrintSummary}
        pendingAiReview={pendingAiReview}
      />

      {/* Hidden Rx Print component */}
      <RxPrint
        patient={patient}
        prescriptions={prescriptions}
        diagnoses={diagnoses}
        advice={advice}
        followUpDate={followUpDate}
        doctorName={staff?.full_name || ''}
        doctorSpeciality={staff?.specialisation || ''}
      />
    </div>
  );
}
