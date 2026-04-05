'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Mic, MicOff, Square, Play, Pause, Wand2, Check, X, Edit3,
  Stethoscope, Activity, Pill, FlaskConical, FileText, ChevronRight,
  Loader2, Volume2, Sparkles, RotateCcw, Info,
} from 'lucide-react';

interface StructuredNote {
  chief_complaints: string[];
  history: string;
  vitals: { bp?: string; pulse?: string; temp?: string; spo2?: string; rr?: string; weight?: string };
  examination: string;
  diagnosis: { primary: string; icd10?: string; secondary?: string[] };
  investigations: string[];
  prescriptions: { drug: string; dose: string; route: string; frequency: string; duration: string }[];
  plan: string;
  follow_up: string;
  advice: string;
}

const EMPTY_NOTE: StructuredNote = {
  chief_complaints: [], history: '', vitals: {},
  examination: '', diagnosis: { primary: '' },
  investigations: [], prescriptions: [], plan: '', follow_up: '', advice: '',
};

export default function VoiceNotesPage() {
  return <RoleGuard module="emr"><VoiceNotesInner /></RoleGuard>;
}

function VoiceNotesInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  // Patient
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const [supported, setSupported] = useState(true);

  // AI structuring
  const [structuring, setStructuring] = useState(false);
  const [structured, setStructured] = useState<StructuredNote | null>(null);
  const [editSection, setEditSection] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Check browser support
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, allergies')
        .or(`uhid.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%`)
        .eq('is_active', true).limit(5);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Start recording
  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      if (final) setTranscript(prev => prev + final);
      setInterimText(interim);
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.error('Speech error:', e.error);
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { console.error(e); }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch (e) { console.error(e); }
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  // AI structure the transcript
  const structureNote = useCallback(async () => {
    if (!transcript.trim()) return;
    setStructuring(true);

    try {
      const patientInfo = patient ? `${patient.first_name} ${patient.last_name}, ${patient.age_years}/${patient.gender}, UHID: ${patient.uhid}${patient.allergies?.length ? ', Allergies: ' + patient.allergies.join(', ') : ''}` : 'Unknown';
      const response = await fetch('/api/ai/structure-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcript.trim(), patient: patientInfo }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setStructured({ ...EMPTY_NOTE, ...data.structured });
    } catch (e: any) {
      console.error('AI structuring failed:', e);
      flash('AI structuring failed — please try again');
    }
    setStructuring(false);
  }, [transcript, patient]);

  // Save to EMR
  const saveEncounter = useCallback(async () => {
    if (!structured || !patient) return;
    setSaving(true);

    const encounterData = {
      centre_id: centreId,
      patient_id: patient.id,
      doctor_id: staffId,
      encounter_date: new Date().toISOString(),
      encounter_type: 'opd',
      status: 'completed',
      chief_complaints: structured.chief_complaints,
      history_presenting_illness: structured.history,
      vitals: structured.vitals,
      examination_findings: structured.examination,
      diagnoses: structured.diagnosis.primary ? [{ label: structured.diagnosis.primary, code: structured.diagnosis.icd10 || '', type: 'primary' }, ...(structured.diagnosis.secondary || []).map(s => ({ label: s, code: '', type: 'secondary' }))] : [],
      investigations: structured.investigations.map(inv => ({ name: inv, status: 'ordered' })),
      prescriptions: structured.prescriptions,
      plan: structured.plan,
      follow_up_date: structured.follow_up,
      advice: structured.advice,
      voice_transcript: transcript,
      source: 'voice_note',
    };

    const { error } = await sb().from('hmis_emr_encounters').insert(encounterData);
    if (error) { flash('Save failed: ' + error.message); }
    else { setSaved(true); flash('Encounter saved to EMR'); }
    setSaving(false);
  }, [structured, patient, centreId, staffId, transcript]);

  // Reset
  const reset = () => {
    setTranscript(''); setInterimText(''); setStructured(null);
    setSaved(false); setEditSection(null);
  };

  // Waveform animation
  const WaveBar = ({ delay = 0 }: { delay?: number }) => (
    <div className={`w-1 rounded-full bg-teal-400 transition-all ${isRecording ? 'animate-pulse' : ''}`}
      style={{ height: isRecording ? `${20 + Math.random() * 30}px` : '8px', animationDelay: `${delay}ms`, transition: 'height 0.15s ease' }} />
  );

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Mic size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Voice Clinical Notes</h1>
            <p className="text-xs text-gray-400">Speak naturally — AI structures your encounter</p>
          </div>
        </div>
        {saved && <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl"><RotateCcw size={14} /> New Note</button>}
      </div>

      {!supported && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          Speech recognition is not supported in this browser. Please use Chrome (desktop or Android) or Safari (iOS).
        </div>
      )}

      {/* Patient selection */}
      {!patient ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Select Patient</h3>
          <div className="relative max-w-md">
            <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="Search by name, UHID, or phone..." />
            {patientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {patientResults.map(p => (
                  <button key={p.id} onClick={() => { setPatient(p); setPatientSearch(''); setPatientResults([]); }}
                    className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-gray-50 last:border-0 transition-colors">
                    <div className="font-semibold text-sm">{p.first_name} {p.last_name}</div>
                    <div className="text-[10px] text-gray-400">{p.uhid} · {p.age_years}/{p.gender?.charAt(0)} · {p.phone_primary}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
            <span className="text-lg font-bold text-teal-700">{patient.first_name?.[0]}{patient.last_name?.[0]}</span>
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">{patient.first_name} {patient.last_name}</div>
            <div className="text-xs text-gray-400">{patient.uhid} · {patient.age_years}/{patient.gender?.charAt(0)} · {patient.phone_primary}</div>
            {patient.allergies?.length > 0 && <div className="text-[10px] text-red-600 font-semibold mt-0.5">Allergies: {patient.allergies.join(', ')}</div>}
          </div>
          <button onClick={() => { setPatient(null); reset(); }} className="text-gray-400 hover:text-gray-600 text-xs">Change</button>
        </div>
      )}

      {patient && !saved && (
        <div className="grid grid-cols-2 gap-5">
          {/* LEFT: Recording + Transcript */}
          <div className="space-y-4">
            {/* Recorder */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-center">
              {/* Waveform */}
              <div className="flex items-center justify-center gap-[3px] h-12 mb-4">
                {Array.from({ length: 24 }).map((_, i) => <WaveBar key={i} delay={i * 50} />)}
              </div>

              <div className="mb-4">
                {isRecording ? (
                  <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center mx-auto shadow-lg shadow-red-500/30 transition-all active:scale-95">
                    <Square size={28} className="text-white" />
                  </button>
                ) : (
                  <button onClick={startRecording} disabled={!supported}
                    className="w-20 h-20 rounded-full bg-teal-500 hover:bg-teal-600 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Mic size={28} className="text-white" />
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-400">{isRecording ? 'Recording... speak naturally' : transcript ? 'Recording paused — tap to continue' : 'Tap mic to start'}</div>
              {isRecording && <div className="text-[10px] text-teal-400 mt-1 animate-pulse">REC · Speak in English or Hinglish</div>}
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Transcript</h3>
                {transcript && <button onClick={() => setTranscript('')} className="text-[10px] text-gray-400 hover:text-red-500">Clear</button>}
              </div>
              <div className="min-h-[200px] max-h-[400px] overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed scrollbar-thin">
                {transcript || <span className="text-gray-300 italic">Your voice will appear here as you speak...</span>}
                {interimText && <span className="text-teal-500 opacity-70">{interimText}</span>}
              </div>
              {transcript && !structured && (
                <button onClick={structureNote} disabled={structuring}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm rounded-xl font-semibold hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-60 shadow-lg shadow-teal-500/20">
                  {structuring ? <><Loader2 size={16} className="animate-spin" /> AI is structuring...</> : <><Sparkles size={16} /> Structure with AI</>}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Structured output */}
          <div className="space-y-3">
            {structuring && (
              <div className="bg-white rounded-2xl border border-teal-200 p-8 text-center">
                <Loader2 size={32} className="animate-spin text-teal-500 mx-auto mb-3" />
                <div className="text-sm font-semibold text-gray-700">AI is analyzing your note...</div>
                <div className="text-xs text-gray-400 mt-1">Extracting complaints, vitals, diagnosis, prescriptions</div>
              </div>
            )}

            {structured && (
              <>
                {/* Section cards */}
                {[
                  { key: 'chief_complaints', icon: Stethoscope, label: 'Chief Complaints', color: 'text-blue-600', render: () => structured.chief_complaints.join(', ') || '—' },
                  { key: 'history', icon: FileText, label: 'History', color: 'text-gray-700', render: () => structured.history || '—' },
                  { key: 'vitals', icon: Activity, label: 'Vitals', color: 'text-red-600', render: () => {
                    const v = structured.vitals;
                    return [v.bp && `BP: ${v.bp}`, v.pulse && `Pulse: ${v.pulse}`, v.temp && `Temp: ${v.temp}`, v.spo2 && `SpO2: ${v.spo2}%`, v.rr && `RR: ${v.rr}`, v.weight && `Wt: ${v.weight}kg`].filter(Boolean).join(' · ') || '—';
                  }},
                  { key: 'examination', icon: Stethoscope, label: 'Examination', color: 'text-purple-600', render: () => structured.examination || '—' },
                  { key: 'diagnosis', icon: FileText, label: 'Diagnosis', color: 'text-teal-700', render: () => {
                    let text = structured.diagnosis.primary || '—';
                    if (structured.diagnosis.icd10) text += ` (${structured.diagnosis.icd10})`;
                    if (structured.diagnosis.secondary?.length) text += ` + ${structured.diagnosis.secondary.join(', ')}`;
                    return text;
                  }},
                  { key: 'investigations', icon: FlaskConical, label: 'Investigations', color: 'text-cyan-600', render: () => structured.investigations.length > 0 ? structured.investigations.join(', ') : '—' },
                  { key: 'prescriptions', icon: Pill, label: 'Prescriptions', color: 'text-emerald-700', render: () => structured.prescriptions.length > 0 ? structured.prescriptions.map(p => `${p.drug} ${p.dose} ${p.route} ${p.frequency} × ${p.duration}`).join('\n') : '—' },
                  { key: 'plan', icon: FileText, label: 'Plan', color: 'text-amber-700', render: () => structured.plan || '—' },
                  { key: 'follow_up', icon: FileText, label: 'Follow-up', color: 'text-gray-600', render: () => structured.follow_up || '—' },
                ].map(section => (
                  <div key={section.key} className="bg-white rounded-xl border border-gray-100 p-3 hover:border-teal-200 transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <section.icon size={12} className={section.color} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{section.label}</span>
                      </div>
                      <button onClick={() => setEditSection(editSection === section.key ? null : section.key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
                        <Edit3 size={10} className="text-gray-400" />
                      </button>
                    </div>
                    {editSection === section.key ? (
                      <textarea
                        defaultValue={section.render()}
                        onBlur={e => {
                          const val = e.target.value;
                          setStructured(prev => {
                            if (!prev) return prev;
                            const updated = { ...prev };
                            if (section.key === 'chief_complaints') updated.chief_complaints = val.split(',').map(s => s.trim()).filter(Boolean);
                            else if (section.key === 'history') updated.history = val;
                            else if (section.key === 'examination') updated.examination = val;
                            else if (section.key === 'investigations') updated.investigations = val.split(',').map(s => s.trim()).filter(Boolean);
                            else if (section.key === 'plan') updated.plan = val;
                            else if (section.key === 'follow_up') updated.follow_up = val;
                            return updated;
                          });
                          setEditSection(null);
                        }}
                        className="w-full text-xs border border-teal-200 rounded-lg p-2 focus:ring-2 focus:ring-teal-500/20 resize-none h-16"
                        autoFocus
                      />
                    ) : (
                      <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{section.render()}</div>
                    )}
                  </div>
                ))}

                {/* Save button */}
                <button onClick={saveEncounter} disabled={saving || !structured.diagnosis.primary}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40 shadow-lg shadow-teal-500/20">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving to EMR...</> : <><Check size={16} /> Save Encounter to EMR</>}
                </button>
              </>
            )}

            {!structured && !structuring && (
              <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                <Wand2 size={32} className="text-gray-300 mx-auto mb-3" />
                <div className="text-sm text-gray-400">Structured note will appear here</div>
                <div className="text-xs text-gray-300 mt-1">Record → Structure with AI → Review → Save</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state — no voice notes recorded yet */}
      {!patient && !saved && (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <Mic size={36} className="text-gray-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-gray-500">No voice notes recorded yet</div>
          <div className="text-xs text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
            Use the microphone button to record clinical notes. Select a patient above, then speak naturally — the AI will structure your dictation into SOAP format automatically.
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-gray-400">
            <Info size={12} className="text-gray-300" />
            <span>Record → Structure with AI → Review → Save to EMR</span>
          </div>
        </div>
      )}

      {/* Saved state */}
      {saved && structured && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <div className="text-lg font-bold text-emerald-800">Encounter Saved</div>
          <div className="text-sm text-emerald-600 mt-1">
            {patient?.first_name} {patient?.last_name} — {structured.diagnosis.primary}
          </div>
          <div className="text-xs text-emerald-500 mt-2">Investigations and prescriptions have been auto-routed to Lab, Radiology, and Pharmacy queues.</div>
        </div>
      )}
    </div>
  );
}
