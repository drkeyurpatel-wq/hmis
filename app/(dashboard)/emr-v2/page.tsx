'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { DIAGNOSES, searchDiagnoses } from '@/lib/cdss/diagnoses';
import { MEDICATIONS, searchMedications, checkInteractions } from '@/lib/cdss/medications';
import { COMPLAINT_TEMPLATES, searchComplaints } from '@/lib/cdss/complaints';
import { EXAM_SYSTEMS } from '@/lib/cdss/exam-templates';
import { MED_SETS } from '@/lib/cdss/med-sets';
import { calculateNEWS2, fahToCel } from '@/lib/cdss/news2';
import { COMMON_ALLERGENS, checkAllergyConflict } from '@/lib/cdss/allergies';
import { H1_CENTRES } from '@/lib/cdss/centres';
import { useEMR } from '@/lib/emr/use-emr';
import { usePharmacy } from '@/lib/revenue/hooks';
import { useAuthStore } from '@/lib/store/auth';
import { printEncounterSummary } from '@/components/ui/shared';
import AICopilot from '@/components/emr-v2/ai-copilot';

// Types
interface Patient { id:string; name:string; age:string; gender:string; uhid:string; phone:string; allergies:string[]; bloodGroup:string; }
interface VitalValues { systolic:string; diastolic:string; heartRate:string; spo2:string; temperature:string; weight:string; height:string; respiratoryRate:string; isAlert:boolean; onO2:boolean; }
interface ComplaintEntry { complaint:string; duration:string; hpiNotes:string; selectedChips:string[]; }
interface ExamEntry { system:string; findings:string[]; notes:string; }
interface DiagnosisEntry { code:string; label:string; type:'primary'|'secondary'; }
interface InvestigationEntry { name:string; urgency:'routine'|'urgent'|'stat'; result:string; isAbnormal:boolean; }
interface PrescriptionEntry { id:string; generic:string; brand:string; strength:string; form:string; dose:string; frequency:string; duration:string; route:string; instructions:string; }
interface FollowUpData { date:string; notes:string; advice:string[]; }
interface ReferralData { department:string; doctor:string; reason:string; urgency:'routine'|'urgent'|'emergency'; }
interface SavedTemplate { id:string; name:string; meds:PrescriptionEntry[]; labs:string[]; advice:string[]; }

const GUJARATI: Record<string,string> = {
  'Low salt diet (<5g/day)':'\u0A93\u0A9B\u0AC1\u0A82 \u0AAE\u0AC0\u0AA0\u0AC1\u0A82 \u0A96\u0ABE\u0A93',
  'Regular BP monitoring at home':'\u0AB0\u0ACB\u0A9C BP \u0A9A\u0AC7\u0A95 \u0A95\u0AB0\u0ACB',
  'Exercise 30 min/day, 5 days/week':'\u0AB0\u0ACB\u0A9C 30 \u0AAE\u0ABF\u0AA8\u0ABF\u0A9F \u0A95\u0AB8\u0AB0\u0AA4',
  'Warm fluids':'\u0A97\u0AB0\u0AAE \u0AAA\u0ACD\u0AB0\u0AB5\u0ABE\u0AB9\u0AC0 \u0AAA\u0AC0\u0A93',
  'Steam inhalation':'\u0AB5\u0AB0\u0ABE\u0AB3 \u0AB2\u0ACB',
  'Rest':'\u0A86\u0AB0\u0ABE\u0AAE \u0A95\u0AB0\u0ACB',
  'Complete antibiotic course':'\u0A8F\u0AA8\u0ACD\u0A9F\u0ABF\u0AAC\u0ABE\u0AAF\u0ACB\u0A9F\u0ABF\u0A95 \u0A95\u0ACB\u0AB0\u0ACD\u0AB8 \u0AAA\u0AC2\u0AB0\u0ACB \u0A95\u0AB0\u0ACB',
  'ORS after every loose stool':'\u0AA6\u0AB0\u0AC7\u0A95 \u0A9D\u0ABE\u0AA1\u0ABE \u0AAA\u0A9B\u0AC0 ORS \u0AAA\u0AC0\u0A93',
};

const REFERRAL_DEPTS = ['Cardiology','Neurology','Neurosurgery','Orthopedics','General Surgery','Gastroenterology','Nephrology','Pulmonology','Endocrinology','Psychiatry','ENT','Ophthalmology','Dermatology','Urology','Oncology','Physiotherapy'];

// Voice hook
function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<any>(null);
  const start = useCallback((onResult:(t:string)=>void) => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Use Chrome for voice.'); return; }
    const r = new SR(); r.continuous=false; r.interimResults=false; r.lang='en-IN';
    r.onresult = (e:any) => { onResult(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false); r.onend = () => setIsListening(false);
    recRef.current = r; r.start(); setIsListening(true);
  }, []);
  const stop = useCallback(() => { recRef.current?.stop(); setIsListening(false); }, []);
  return { isListening, start, stop };
}

// Micro components
const Mic = ({onResult}:{onResult:(t:string)=>void}) => {
  const {isListening,start,stop} = useVoice();
  return <button type="button" onClick={()=>isListening?stop():start(onResult)}
    className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all ${isListening?'bg-red-500 text-white animate-pulse':'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>;
};
const Chip = ({label,sel,onClick}:{label:string;sel:boolean;onClick:()=>void}) =>
  <button type="button" onClick={onClick} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>{label}</button>;
const Sec = ({n,title,icon,children}:{n:number;title:string;icon:string;children:React.ReactNode}) =>
  <section className="bg-white rounded-xl shadow-sm border p-5"><div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{n}</div><span className="text-lg">{icon}</span><h2 className="text-lg font-semibold text-gray-900">{title}</h2></div>{children}</section>;

// MAIN PAGE
export default function EMRv3Page() {
  // Supabase + Offline hooks
  const emr = useEMR();
  const { createFromEncounter: createPharmacyOrder } = usePharmacy(emr.centreId || null);
  const { staff: authStaff } = useAuthStore();

  // Sync patient from URL: /emr-v2?patient=UUID
  const [urlLoaded, setUrlLoaded] = useState(false);
  useEffect(() => {
    if (urlLoaded) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patient');
    if (pid) { emr.selectPatient(pid); }
    setUrlLoaded(true);
  }, [urlLoaded, emr]);

  // Sync EMR patient → local patient state
  const [patient, setPatient] = useState<Patient>({id:'',name:'Patient Name',age:'--',gender:'--',uhid:'H1-00000',phone:'',allergies:[],bloodGroup:''});
  useEffect(() => {
    if (emr.patient) {
      setPatient({
        id: emr.patient.id,
        name: emr.patient.name,
        age: emr.patient.age,
        gender: emr.patient.gender,
        uhid: emr.patient.uhid,
        phone: emr.patient.phone,
        allergies: emr.patient.allergies,
        bloodGroup: emr.patient.bloodGroup,
      });
    }
  }, [emr.patient]);

  // Patient search state
  const [patientSearchQ, setPatientSearchQ] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);

  const [allergyInput, setAllergyInput] = useState('');
  const [activeCentre, setActiveCentre] = useState('shilaj');
  const [vitals, setVitals] = useState<VitalValues>({systolic:'',diastolic:'',heartRate:'',spo2:'',temperature:'',weight:'',height:'',respiratoryRate:'',isAlert:true,onO2:false});
  const bmi = vitals.weight&&vitals.height?(parseFloat(vitals.weight)/((parseFloat(vitals.height)/100)**2)).toFixed(1):null;
  const news2 = useMemo(()=>{const rr=parseFloat(vitals.respiratoryRate),sp=parseFloat(vitals.spo2),sys=parseFloat(vitals.systolic),hr=parseFloat(vitals.heartRate),tf=parseFloat(vitals.temperature);return calculateNEWS2({respiratoryRate:isNaN(rr)?undefined:rr,spo2:isNaN(sp)?undefined:sp,systolic:isNaN(sys)?undefined:sys,heartRate:isNaN(hr)?undefined:hr,temperature:isNaN(tf)?undefined:fahToCel(tf),isAlert:vitals.isAlert,onSupplementalO2:vitals.onO2});},[vitals]);

  const [complaints,setComplaints]=useState<ComplaintEntry[]>([]);const [complaintSearch,setComplaintSearch]=useState('');
  const [examEntries,setExamEntries]=useState<ExamEntry[]>([]);const [expandedExam,setExpandedExam]=useState<string|null>(null);
  const [diagnoses,setDiagnoses]=useState<DiagnosisEntry[]>([]);const [diagSearch,setDiagSearch]=useState('');
  const [investigations,setInvestigations]=useState<InvestigationEntry[]>([]);
  const [prescriptions,setPrescriptions]=useState<PrescriptionEntry[]>([]);const [medSearch,setMedSearch]=useState('');
  const [followUp,setFollowUp]=useState<FollowUpData>({date:'',notes:'',advice:[]});const [adviceInput,setAdviceInput]=useState('');
  const [showMedSets,setShowMedSets]=useState(false);const [showReferral,setShowReferral]=useState(false);
  const [referral,setReferral]=useState<ReferralData>({department:'',doctor:'',reason:'',urgency:'routine'});
  const [showHistory,setShowHistory]=useState(false);const [showCopilot,setShowCopilot]=useState(false);
  const [copilotResult,setCopilotResult]=useState('');const [copilotLoading,setCopilotLoading]=useState(false);
  const [showAnalytics,setShowAnalytics]=useState(false);const [showGujarati,setShowGujarati]=useState(false);
  const [toast,setToast]=useState('');const [savedTemplates,setSavedTemplates]=useState<SavedTemplate[]>([]);
  const [templateName,setTemplateName]=useState('');const [showTemplateSave,setShowTemplateSave]=useState(false);

  const flash=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),2500);};
  const activeInteractions=useMemo(()=>checkInteractions(prescriptions.map(p=>p.generic)),[prescriptions]);
  const allergyConflicts=useMemo(()=>prescriptions.flatMap(p=>checkAllergyConflict(patient.allergies,p.generic).map(a=>({med:p.generic,...a}))),[prescriptions,patient.allergies]);
  const complaintResults=complaintSearch.length>=2?searchComplaints(complaintSearch):[];
  const diagResults=diagSearch.length>=2?searchDiagnoses(diagSearch):[];
  const medResults=medSearch.length>=2?searchMedications(medSearch):[];

  const addComplaint=(tpl:any)=>{setComplaints(p=>[...p,{complaint:tpl.label,duration:'',hpiNotes:'',selectedChips:[]}]);setComplaintSearch('');};
  const addDiagnosis=(d:any)=>{
    if(diagnoses.some(x=>x.code===d.code))return;
    setDiagnoses(p=>[...p,{code:d.code,label:d.label,type:p.length===0?'primary':'secondary'}]);
    d.suggestedLabs.filter((l:string)=>!investigations.some(i=>i.name===l)).forEach((l:string)=>setInvestigations(p=>[...p,{name:l,urgency:'routine',result:'',isAbnormal:false}]));
    d.suggestedMeds.forEach((mid:string)=>{const med=MEDICATIONS.find(m=>m.id===mid);if(med&&!prescriptions.some(p=>p.id===mid))setPrescriptions(p=>[...p,{id:mid,generic:med.generic,brand:med.brand,strength:med.strength,form:med.form,dose:med.defaultDose,frequency:med.defaultFrequency,duration:med.defaultDuration,route:med.defaultRoute,instructions:med.defaultInstructions}]);});
    d.suggestedAdvice.filter((a:string)=>!followUp.advice.includes(a)).forEach((a:string)=>setFollowUp(p=>({...p,advice:[...p.advice,a]})));
    d.examFocus.forEach((sys:string)=>{if(!examEntries.some(e=>e.system===sys))setExamEntries(p=>[...p,{system:sys,findings:[],notes:''}]);});
    flash('Autofill applied');setDiagSearch('');
  };
  const addMed=(med:any)=>{if(prescriptions.some(p=>p.id===med.id))return;setPrescriptions(p=>[...p,{id:med.id,generic:med.generic,brand:med.brand,strength:med.strength,form:med.form,dose:med.defaultDose,frequency:med.defaultFrequency,duration:med.defaultDuration,route:med.defaultRoute,instructions:med.defaultInstructions}]);setMedSearch('');};
  const applyMedSet=(set:any)=>{set.meds.forEach((mid:string)=>{const med=MEDICATIONS.find(m=>m.id===mid);if(med&&!prescriptions.some(p=>p.id===mid))setPrescriptions(p=>[...p,{id:mid,generic:med.generic,brand:med.brand,strength:med.strength,form:med.form,dose:med.defaultDose,frequency:med.defaultFrequency,duration:med.defaultDuration,route:med.defaultRoute,instructions:med.defaultInstructions}]);});set.labs.filter((l:string)=>!investigations.some(i=>i.name===l)).forEach((l:string)=>setInvestigations(p=>[...p,{name:l,urgency:'routine',result:'',isAbnormal:false}]));flash(set.name+' applied');setShowMedSets(false);};
  const saveTemplate=()=>{if(!templateName.trim())return;setSavedTemplates(p=>[...p,{id:Date.now().toString(),name:templateName.trim(),meds:[...prescriptions],labs:investigations.map(i=>i.name),advice:[...followUp.advice]}]);flash('Template saved');setTemplateName('');setShowTemplateSave(false);};
  const loadTemplate=(t:SavedTemplate)=>{t.meds.filter(m=>!prescriptions.some(p=>p.id===m.id)).forEach(m=>setPrescriptions(p=>[...p,m]));t.labs.filter(l=>!investigations.some(i=>i.name===l)).forEach(l=>setInvestigations(p=>[...p,{name:l,urgency:'routine',result:'',isAbnormal:false}]));t.advice.filter(a=>!followUp.advice.includes(a)).forEach(a=>setFollowUp(p=>({...p,advice:[...p.advice,a]})));flash('Template loaded');};

  const runCopilot=async()=>{setCopilotLoading(true);setCopilotResult('');const prompt=`Patient: ${patient.age}/${patient.gender}. Complaints: ${complaints.map(c=>c.complaint+' x '+c.duration).join('; ')}. Vitals: BP ${vitals.systolic}/${vitals.diastolic}, HR ${vitals.heartRate}, SpO2 ${vitals.spo2}. Exam: ${examEntries.map(e=>e.system+': '+e.findings.join(', ')).join('; ')}. Give top 3 differentials with ICD-10, key investigations, red flags. Be concise.`;try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});const data=await res.json();setCopilotResult(data.content?.map((c:any)=>c.text||'').join('\n')||'No response');}catch{setCopilotResult('AI Copilot needs API access. Configure in production.');}setCopilotLoading(false);};

  const generateRxPDF=()=>{const centre=H1_CENTRES.find(c=>c.id===activeCentre)||H1_CENTRES[0];const w=window.open('','_blank');if(!w)return;const advHtml=followUp.advice.map(a=>{const g=showGujarati?(GUJARATI[a]||''):'';return '<li>'+a+(g?'<br/><span style="color:#666;font-size:8px">'+g+'</span>':'')+'</li>';}).join('');const n2=news2?'NEWS2: '+news2.total+' ('+news2.label+')':'';w.document.write('<!DOCTYPE html><html><head><title>Rx</title><style>@page{size:A5;margin:10mm}*{margin:0;padding:0;box-sizing:border-box;font-family:Segoe UI,sans-serif}body{padding:8mm;color:#1a1a1a;font-size:10px}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:10px}.logo{width:60px;height:60px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:7px;color:#999}.hn{font-size:15px;font-weight:700;color:#1e40af}.hs{font-size:8px;color:#666}.pr{display:flex;gap:12px;margin-bottom:4px;font-size:10px}.pr b{color:#1e40af}.st{font-size:11px;font-weight:700;color:#1e40af;margin:8px 0 3px;border-bottom:1px solid #e5e7eb;padding-bottom:2px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#eff6ff;color:#1e40af;text-align:left;padding:3px 4px;border-bottom:1px solid #1e40af}td{padding:3px 4px;border-bottom:1px solid #e5e7eb}.al{list-style:none;padding:0}.al li{padding:2px 0;font-size:9px}.al li::before{content:"• ";color:#1e40af;font-weight:700}.ft{margin-top:16px;text-align:right;border-top:1px solid #e5e7eb;padding-top:8px}.sl{width:120px;border-bottom:1px solid #333;margin-left:auto;margin-bottom:4px}.warn{background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:4px 8px;margin:4px 0;font-size:8px;color:#991b1b}@media print{body{padding:0}}</style></head><body>'+'<div class="hdr"><div style="display:flex;gap:10px;align-items:center"><div class="logo">LOGO</div><div><div class="hn">'+centre.name+'</div><div class="hs">'+centre.address+' | '+centre.phone+'</div><div class="hs">'+centre.tagline+'</div></div></div><div style="text-align:right;font-size:9px;color:#666">Date: '+new Date().toLocaleDateString('en-IN')+'<br/>Time: '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+'</div></div>'+'<div class="pr"><b>Name:</b> '+patient.name+' <b>Age/Sex:</b> '+patient.age+'/'+patient.gender+' <b>UHID:</b> '+patient.uhid+'</div>'+(patient.allergies.length?'<div class="warn">ALLERGIES: '+patient.allergies.join(', ')+'</div>':'')+(vitals.systolic?'<div class="pr"><b>Vitals:</b> BP '+vitals.systolic+'/'+vitals.diastolic+' HR '+vitals.heartRate+'/min SpO2 '+vitals.spo2+'% Temp '+vitals.temperature+'F Wt '+vitals.weight+'kg'+(n2?' <b>'+n2+'</b>':'')+'</div>':'')+(diagnoses.length?'<div class="st">Diagnosis</div><div style="font-size:10px">'+diagnoses.map(d=>d.code+' - '+d.label+' ('+d.type+')').join('<br/>')+'</div>':'')+(prescriptions.length?'<div class="st">Rx Prescription</div><table><tr><th>#</th><th>Medication</th><th>Dose</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr>'+prescriptions.map((p,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+p.brand+'</b> ('+p.generic+') '+p.strength+'</td><td>'+p.dose+'</td><td>'+p.frequency+'</td><td>'+p.duration+'</td><td>'+p.instructions+'</td></tr>').join('')+'</table>':'')+(investigations.length?'<div class="st">Investigations</div><div style="font-size:9px">'+investigations.map(i=>i.name+(i.urgency!=='routine'?' ['+i.urgency.toUpperCase()+']':'')).join(', ')+'</div>':'')+(followUp.advice.length?'<div class="st">Advice</div><ul class="al">'+advHtml+'</ul>':'')+(followUp.date?'<div style="margin-top:4px;font-size:9px"><b>Follow-up:</b> '+followUp.date+(followUp.notes?' - '+followUp.notes:'')+'</div>':'')+(referral.department?'<div class="st">Referral</div><div style="font-size:9px"><b>To:</b> '+referral.department+' <b>Reason:</b> '+referral.reason+' <b>'+referral.urgency.toUpperCase()+'</b></div>':'')+'<div class="ft"><div class="sl"></div><div style="font-size:9px;color:#666">Doctor Signature & Stamp</div></div></body></html>');w.document.close();setTimeout(()=>w.print(),300);};

  // Auto-save draft every 5s of inactivity
  useEffect(() => {
    if (!patient.id && !complaints.length && !diagnoses.length) return;
    emr.autoSaveDraft({ vitals, complaints, examFindings: examEntries, diagnoses, investigations, prescriptions, advice: followUp.advice, followUp: { date: followUp.date, notes: followUp.notes }, referral: referral.department ? referral : null });
  }, [vitals, complaints, examEntries, diagnoses, investigations, prescriptions, followUp, referral]);

  const sidebarOpen=showHistory||showCopilot||showAnalytics;

  return (<div className="min-h-screen bg-gray-50">
    <div className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-2"><div className="max-w-5xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm cursor-pointer" onClick={()=>setShowPatientSearch(!showPatientSearch)}>{patient.name.charAt(0)}</div>
        <div className="relative">
          <div className="font-semibold text-gray-900 text-sm cursor-pointer" onClick={()=>setShowPatientSearch(!showPatientSearch)}>{patient.name} {emr.patientLoading&&<span className="text-xs text-gray-400">loading...</span>}</div>
          <div className="text-xs text-gray-500">{patient.age}/{patient.gender} | {patient.uhid}{emr.patient?.lastVisit?` | Last: ${emr.patient.lastVisit}`:''}</div>
          {showPatientSearch&&<div className="absolute top-full left-0 mt-2 w-80 bg-white border rounded-lg shadow-xl z-50 p-3">
            <input type="text" placeholder="Search UHID, name, or phone..." value={patientSearchQ} onChange={e=>{setPatientSearchQ(e.target.value);emr.searchPatient(e.target.value);}} autoFocus
              className="w-full px-3 py-2 border rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {emr.todayQueue.length>0&&<div className="mb-2"><div className="text-xs font-medium text-gray-500 mb-1">Today's Queue ({emr.todayQueue.length})</div>
              {emr.todayQueue.slice(0,5).map((q:any)=><button key={q.id} onClick={()=>{emr.selectPatient(q.patient.id);setShowPatientSearch(false);setPatientSearchQ('');}}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex justify-between items-center">
                <span><span className="font-medium">{q.patient.first_name} {q.patient.last_name}</span> <span className="text-gray-400">#{q.token_number}</span></span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${q.status==='waiting'?'bg-yellow-100 text-yellow-700':q.status==='with_doctor'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>{q.status}</span>
              </button>)}</div>}
            {emr.searchResults.length>0&&<div><div className="text-xs font-medium text-gray-500 mb-1">Search Results</div>
              {emr.searchResults.map((p:any)=><button key={p.id} onClick={()=>{emr.selectPatient(p.id);setShowPatientSearch(false);setPatientSearchQ('');}}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded">
                <span className="font-medium">{p.first_name} {p.last_name}</span> <span className="text-gray-400">{p.uhid} | {p.age_years}/{p.gender} | {p.phone_primary}</span>
              </button>)}</div>}
            {patientSearchQ.length>=2&&emr.searchResults.length===0&&<div className="text-xs text-gray-400 text-center py-2">No patients found</div>}
          </div>}
        </div>
        {emr.todayQueue.length>0&&<span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{emr.todayQueue.length} in queue</span>}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <select value={activeCentre} onChange={e=>setActiveCentre(e.target.value)} className="text-xs border rounded px-2 py-1.5">{H1_CENTRES.map(c=><option key={c.id} value={c.id}>{c.shortName}</option>)}</select>
        <button onClick={()=>setShowHistory(!showHistory)} className={`px-3 py-1.5 text-xs rounded ${showHistory?'bg-blue-100 text-blue-700':'bg-gray-100'}`}>History</button>
        <button onClick={()=>setShowCopilot(!showCopilot)} className={`px-3 py-1.5 text-xs rounded ${showCopilot?'bg-purple-100 text-purple-700':'bg-gray-100'}`}>AI Copilot</button>
        <button onClick={()=>setShowAnalytics(!showAnalytics)} className={`px-3 py-1.5 text-xs rounded ${showAnalytics?'bg-orange-100 text-orange-700':'bg-gray-100'}`}>Analytics</button>
        <button onClick={generateRxPDF} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">Print Rx</button>
        <button onClick={() => {
          const centre = H1_CENTRES.find(c => c.id === activeCentre) || H1_CENTRES[0];
          printEncounterSummary({
            patientName: patient.name, uhid: patient.uhid, ageGender: patient.age + '/' + patient.gender,
            doctorName: authStaff?.full_name || 'Doctor', date: new Date().toLocaleDateString('en-IN'),
            encounterType: 'OPD', status: 'in_progress', vitals, complaints: complaints.map(c => c.complaint + (c.duration ? ' (' + c.duration + ')' : '')), examFindings: examEntries,
            diagnoses, investigations, prescriptions, advice: followUp.advice,
            followUp: followUp.date ? followUp.date + (followUp.notes ? ' — ' + followUp.notes : '') : '',
            referral: referral.department ? referral.department + ' (' + referral.urgency + '): ' + referral.reason : undefined,
          }, { name: centre.name, address: centre.address, phone: centre.phone, tagline: centre.tagline });
        }} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700">Print Summary</button>
        <button onClick={async()=>{const result=await emr.saveEncounter({vitals,complaints,examFindings:examEntries,diagnoses,investigations,prescriptions,advice:followUp.advice,followUp:{date:followUp.date,notes:followUp.notes},referral:referral.department?referral:null});if(result.success){flash(result.offline?'Saved offline':'Saved to server');if(prescriptions.length>0&&result.id&&patient.id){await createPharmacyOrder(patient.id,result.id,prescriptions);flash('Saved + Rx sent to pharmacy');}}else flash('Save failed');}} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700">Save Draft</button>
        <button onClick={async()=>{const result=await emr.saveEncounter({vitals,complaints,examFindings:examEntries,diagnoses,investigations,prescriptions,advice:followUp.advice,followUp:{date:followUp.date,notes:followUp.notes},referral:referral.department?referral:null,status:'signed'});if(result.success){flash('Encounter signed');if(prescriptions.length>0&&result.id&&patient.id){await createPharmacyOrder(patient.id,result.id,prescriptions);}flash('Signed + Rx sent to pharmacy');}else flash('Sign failed');}} className="px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded hover:bg-blue-800">Save & Sign</button>
        {!emr.online&&<span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded animate-pulse">OFFLINE</span>}
        {emr.pendingSyncs>0&&<span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">{emr.pendingSyncs} pending</span>}
      </div></div></div>

    {toast&&<div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

    {patient.allergies.length>0&&<div className="sticky top-[52px] z-40 bg-red-50 border-b border-red-200 px-4 py-1.5"><div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
      <span className="text-red-600 font-bold text-xs">ALLERGIES:</span>
      {patient.allergies.map((a,i)=><span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium">{a}<button onClick={()=>setPatient(p=>({...p,allergies:p.allergies.filter((_,j)=>j!==i)}))} className="ml-1 text-red-400">x</button></span>)}
    </div></div>}

    {(activeInteractions.length>0||allergyConflicts.length>0)&&<div className="max-w-5xl mx-auto px-4 mt-2 space-y-1">
      {activeInteractions.map((int,i)=><div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${int.severity==='high'?'bg-red-50 border-red-300':'bg-yellow-50 border-yellow-300'}`}><span className={`text-xs font-bold ${int.severity==='high'?'text-red-700':'text-yellow-700'}`}>{int.severity==='high'?'HIGH':'MOD'}</span><span className="text-xs">{int.drug1}+{int.drug2}: {int.warning}</span></div>)}
      {allergyConflicts.map((c,i)=><div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-red-50 border-red-400"><span className="text-xs font-bold text-red-800">ALLERGY</span><span className="text-xs text-red-700">{c.med}: {c.warning}</span></div>)}
    </div>}

    <div className="max-w-5xl mx-auto px-4 py-4 flex gap-4">
    <div className={`flex-1 space-y-4 min-w-0`}>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center gap-2 mb-2"><span className="text-sm font-medium">Patient Allergies</span><span className="text-xs text-gray-400">(real-time Rx cross-check)</span></div>
        <div className="flex gap-2 mb-2"><input type="text" placeholder="Add allergy..." value={allergyInput} onChange={e=>setAllergyInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&allergyInput.trim()){setPatient(p=>({...p,allergies:[...p.allergies,allergyInput.trim()]}));setAllergyInput('');}}}
          className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={()=>{if(allergyInput.trim()){setPatient(p=>({...p,allergies:[...p.allergies,allergyInput.trim()]}));setAllergyInput('');}}} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">Add</button></div>
        <div className="flex flex-wrap gap-1">{COMMON_ALLERGENS.map(a=><button key={a} onClick={()=>{if(!patient.allergies.includes(a))setPatient(p=>({...p,allergies:[...p.allergies,a]}));}} className={`px-2 py-0.5 rounded text-xs border ${patient.allergies.includes(a)?'bg-red-100 text-red-700 border-red-300':'border-gray-200 text-gray-500 hover:border-red-300'}`}>{a}</button>)}</div>
      </div>

      <Sec n={1} title="Vitals" icon="\ud83e\ude7a">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['systolic','Systolic','mmHg','120'],['diastolic','Diastolic','mmHg','80'],['heartRate','HR','/min','72'],['spo2','SpO2','%','98'],['temperature','Temp','F','98.6'],['weight','Wt','kg','70'],['height','Ht','cm','170'],['respiratoryRate','RR','/min','16']].map(([k,l,u,ph])=>
            <div key={k}><label className="block text-xs font-medium text-gray-500 mb-1">{l}</label>
            <div className="flex items-center"><input type="number" placeholder={ph as string} value={(vitals as any)[k]} onChange={e=>setVitals(p=>({...p,[k]:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /><span className="ml-1 text-xs text-gray-400 shrink-0">{u}</span></div></div>)}
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={vitals.onO2} onChange={e=>setVitals(p=>({...p,onO2:e.target.checked}))} />On O2</label>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!vitals.isAlert} onChange={e=>setVitals(p=>({...p,isAlert:!e.target.checked}))} />Not alert</label>
          {bmi&&<span className="text-sm">BMI: <span className={`font-semibold ${parseFloat(bmi)>25?'text-orange-600':parseFloat(bmi)<18.5?'text-yellow-600':'text-green-600'}`}>{bmi}</span></span>}
        </div>
        {news2&&<div className={`mt-3 p-3 rounded-lg border ${news2.color==='green'?'bg-green-100 border-green-300 text-green-800':news2.color==='yellow'?'bg-yellow-100 border-yellow-300 text-yellow-800':news2.color==='orange'?'bg-orange-100 border-orange-300 text-orange-800':'bg-red-100 border-red-300 text-red-800'}`}>
          <div className="font-bold text-sm">NEWS2: {news2.total} \u2014 {news2.label}</div><div className="text-xs mt-1">{news2.action}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">{news2.breakdown.map((b,i)=><span key={i} className={`text-xs px-2 py-0.5 rounded ${b.score>=3?'bg-red-200':b.score>=2?'bg-orange-200':b.score>=1?'bg-yellow-200':'bg-green-200'}`}>{b.param}: {b.value} ({b.score})</span>)}</div>
        </div>}
      </Sec>

      <Sec n={2} title="Chief Complaints & HPI" icon="\ud83d\udccb">
        <div className="flex gap-2 mb-2"><div className="relative flex-1"><input type="text" placeholder="Type complaint..." value={complaintSearch} onChange={e=>setComplaintSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {complaintResults.length>0&&<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{complaintResults.map(c=><button key={c.label} onClick={()=>addComplaint(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">{c.label}</button>)}</div>}</div>
          <Mic onResult={t=>setComplaintSearch(t)} /></div>
        <div className="flex flex-wrap gap-1.5 mb-3">{['Fever','Cough','Breathlessness','Chest Pain','Headache','Abdominal Pain','Vomiting','Back Pain'].map(l=>{const t=COMPLAINT_TEMPLATES.find(c=>c.label===l);return t&&<button key={l} onClick={()=>addComplaint(t)} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-600 hover:border-blue-400">+ {l}</button>;})}</div>
        {complaints.map((c,idx)=>{const tpl=COMPLAINT_TEMPLATES.find(t=>t.label===c.complaint);return <div key={idx} className="border rounded-lg p-3 mb-2 bg-gray-50">
          <div className="flex items-center justify-between mb-2"><span className="font-medium text-sm">{c.complaint}</span><button onClick={()=>setComplaints(p=>p.filter((_,i)=>i!==idx))} className="text-red-400 text-xs">x</button></div>
          {tpl&&<><div className="flex flex-wrap gap-1.5 mb-2"><span className="text-xs text-gray-400 mr-1">Duration:</span>{tpl.durationOptions.map(d=><Chip key={d} label={d} sel={c.duration===d} onClick={()=>{const u=[...complaints];u[idx]={...u[idx],duration:d};setComplaints(u);}} />)}</div>
          <div className="flex flex-wrap gap-1.5 mb-2"><span className="text-xs text-gray-400 mr-1">HPI:</span>{tpl.hpiChips.map(h=><Chip key={h} label={h} sel={c.selectedChips.includes(h)} onClick={()=>{const u=[...complaints];u[idx]={...u[idx],selectedChips:u[idx].selectedChips.includes(h)?u[idx].selectedChips.filter(x=>x!==h):[...u[idx].selectedChips,h]};setComplaints(u);}} />)}</div></>}
          <div className="flex gap-2"><input type="text" placeholder="Additional HPI..." value={c.hpiNotes} onChange={e=>{const u=[...complaints];u[idx]={...u[idx],hpiNotes:e.target.value};setComplaints(u);}} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" /><Mic onResult={t=>{const u=[...complaints];u[idx]={...u[idx],hpiNotes:u[idx].hpiNotes+' '+t};setComplaints(u);}} /></div></div>;})}
      </Sec>

      <Sec n={3} title="Examination" icon="\ud83d\udd0d">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">{EXAM_SYSTEMS.map(sys=><button key={sys.key} onClick={()=>{if(!examEntries.some(e=>e.system===sys.key))setExamEntries(p=>[...p,{system:sys.key,findings:[],notes:''}]);setExpandedExam(expandedExam===sys.key?null:sys.key);}}
          className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${examEntries.some(e=>e.system===sys.key)?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 hover:border-blue-400 text-gray-600'} ${expandedExam===sys.key?'ring-2 ring-blue-500':''}`}>
          <span>{sys.icon}</span>{sys.label}{(examEntries.find(e=>e.system===sys.key)?.findings.length||0)>0&&<span className="ml-auto bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{examEntries.find(e=>e.system===sys.key)!.findings.length}</span>}</button>)}</div>
        {expandedExam&&(()=>{const sys=EXAM_SYSTEMS.find(s=>s.key===expandedExam);const entry=examEntries.find(e=>e.system===expandedExam);if(!sys||!entry)return null;return <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium text-sm mb-3">{sys.icon} {sys.label}</h3>
          {sys.findings.map(f=><div key={f.label} className="mb-3"><div className="text-xs font-medium text-gray-500 mb-1">{f.label}</div><div className="flex flex-wrap gap-1.5">
            <Chip label={'\u2713 '+f.normal} sel={entry.findings.includes(f.normal)} onClick={()=>setExamEntries(p=>p.map(e=>e.system===expandedExam?{...e,findings:e.findings.includes(f.normal)?e.findings.filter(x=>x!==f.normal):[...e.findings.filter(x=>!f.abnormalOptions.includes(x)),f.normal]}:e))} />
            {f.abnormalOptions.map(ab=><Chip key={ab} label={ab} sel={entry.findings.includes(ab)} onClick={()=>setExamEntries(p=>p.map(e=>e.system===expandedExam?{...e,findings:e.findings.includes(ab)?e.findings.filter(x=>x!==ab):[...e.findings.filter(x=>x!==f.normal),ab]}:e))} />)}</div></div>)}
          <div className="flex gap-2 mt-2"><input type="text" placeholder="Notes..." value={entry.notes} onChange={e=>setExamEntries(p=>p.map(ex=>ex.system===expandedExam?{...ex,notes:e.target.value}:ex))} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" /><Mic onResult={t=>setExamEntries(p=>p.map(ex=>ex.system===expandedExam?{...ex,notes:ex.notes+' '+t}:ex))} /></div></div>;})()}
      </Sec>

      <Sec n={4} title="Diagnosis (ICD-10)" icon="\ud83c\udfaf">
        <div className="flex gap-2 mb-2"><div className="relative flex-1"><input type="text" placeholder="Search diagnosis..." value={diagSearch} onChange={e=>setDiagSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {diagResults.length>0&&<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{diagResults.map(d=><button key={d.code} onClick={()=>addDiagnosis(d)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 flex justify-between"><span>{d.label}</span><span className="text-xs text-gray-400 font-mono">{d.code}</span></button>)}</div>}</div>
          <Mic onResult={t=>setDiagSearch(t)} /></div>
        <p className="text-xs text-gray-400 mb-2">Selecting a diagnosis auto-fills meds, labs, advice, exam focus.</p>
        {diagnoses.map((d,idx)=><div key={d.code} className="flex items-center gap-3 p-2 border rounded-lg mb-1.5 bg-gray-50">
          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{d.code}</span><span className="text-sm flex-1">{d.label}</span>
          <select value={d.type} onChange={e=>{const u=[...diagnoses];u[idx]={...u[idx],type:e.target.value as any};setDiagnoses(u);}} className="text-xs border rounded px-2 py-1"><option value="primary">Primary</option><option value="secondary">Secondary</option></select>
          <button onClick={()=>setDiagnoses(p=>p.filter((_,i)=>i!==idx))} className="text-red-400 text-xs">x</button></div>)}
      </Sec>

      <Sec n={5} title="Investigations" icon="\ud83d\udd2c">
        <div className="flex gap-2 mb-2"><input type="text" placeholder="Add investigation (Enter)..." onKeyDown={e=>{if(e.key==='Enter'&&(e.target as HTMLInputElement).value.trim()){setInvestigations(p=>[...p,{name:(e.target as HTMLInputElement).value.trim(),urgency:'routine',result:'',isAbnormal:false}]);(e.target as HTMLInputElement).value='';}}} className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Mic onResult={t=>setInvestigations(p=>[...p,{name:t,urgency:'routine',result:'',isAbnormal:false}])} /></div>
        {investigations.map((inv,idx)=><div key={idx} className="flex items-center gap-2 p-2 border rounded-lg mb-1.5 bg-gray-50 flex-wrap">
          <span className="text-sm flex-1 min-w-[100px]">{inv.name}</span>
          <select value={inv.urgency} onChange={e=>{const u=[...investigations];u[idx]={...u[idx],urgency:e.target.value as any};setInvestigations(u);}} className={`text-xs border rounded px-2 py-1 ${inv.urgency==='stat'?'text-red-600 border-red-300':inv.urgency==='urgent'?'text-orange-600 border-orange-300':''}`}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
          <input type="text" placeholder="Result..." value={inv.result} onChange={e=>{const u=[...investigations];u[idx]={...u[idx],result:e.target.value};setInvestigations(u);}} className="w-28 px-2 py-1 border rounded text-xs" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={inv.isAbnormal} onChange={e=>{const u=[...investigations];u[idx]={...u[idx],isAbnormal:e.target.checked};setInvestigations(u);}} /><span className="text-red-500">Abnl</span></label>
          <button onClick={()=>setInvestigations(p=>p.filter((_,i)=>i!==idx))} className="text-red-400 text-xs">x</button></div>)}
      </Sec>

      <Sec n={6} title="Prescription" icon="\ud83d\udc8a">
        <div className="flex gap-2 mb-2"><div className="relative flex-1"><input type="text" placeholder="Search medication..." value={medSearch} onChange={e=>setMedSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {medResults.length>0&&<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{medResults.map(m=><button key={m.id} onClick={()=>addMed(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 flex justify-between"><span><strong>{m.brand}</strong> ({m.generic}) {m.strength}</span><span className="text-xs text-gray-400">{m.form}</span></button>)}</div>}</div>
          <Mic onResult={t=>setMedSearch(t)} />
          <button onClick={()=>setShowMedSets(!showMedSets)} className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs rounded-lg border border-indigo-200 whitespace-nowrap">Med Sets</button>
          <button onClick={()=>setShowTemplateSave(!showTemplateSave)} className="px-3 py-2 bg-teal-50 text-teal-700 text-xs rounded-lg border border-teal-200 whitespace-nowrap">Template</button></div>
        {showMedSets&&<div className="border rounded-lg p-3 bg-indigo-50 mb-3"><h4 className="text-xs font-medium text-indigo-800 mb-2">Quick Med Sets</h4><div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{MED_SETS.map(s=><button key={s.id} onClick={()=>applyMedSet(s)} className="text-left px-2 py-1.5 bg-white rounded border border-indigo-200 hover:border-indigo-400 text-xs"><span className="font-medium">{s.name}</span><br/><span className="text-gray-400">{s.meds.length} meds + {s.labs.length} labs</span></button>)}</div></div>}
        {showTemplateSave&&<div className="border rounded-lg p-3 bg-teal-50 mb-3"><div className="flex gap-2 mb-2"><input type="text" placeholder="Template name..." value={templateName} onChange={e=>setTemplateName(e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" /><button onClick={saveTemplate} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">Save</button></div>
          {savedTemplates.length>0&&<div className="space-y-1">{savedTemplates.map(t=><div key={t.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border"><span className="text-xs font-medium">{t.name} ({t.meds.length} meds)</span><button onClick={()=>loadTemplate(t)} className="text-xs text-teal-600">Load</button></div>)}</div>}</div>}
        {prescriptions.length>0&&<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b bg-gray-50"><th className="text-left p-2 font-medium text-gray-500">#</th><th className="text-left p-2 font-medium text-gray-500">Medication</th><th className="text-left p-2 font-medium text-gray-500">Dose</th><th className="text-left p-2 font-medium text-gray-500">Freq</th><th className="text-left p-2 font-medium text-gray-500">Duration</th><th className="text-left p-2 font-medium text-gray-500">Instructions</th><th className="p-2"></th></tr></thead><tbody>
          {prescriptions.map((p,idx)=><tr key={p.id} className="border-b hover:bg-gray-50"><td className="p-2 text-gray-400">{idx+1}</td><td className="p-2"><div className="font-medium">{p.brand} ({p.generic})</div><div className="text-gray-400">{p.strength} {p.form}</div></td>
            <td className="p-2"><input value={p.dose} onChange={e=>{const u=[...prescriptions];u[idx]={...u[idx],dose:e.target.value};setPrescriptions(u);}} className="w-16 px-1 py-0.5 border rounded text-xs" /></td>
            <td className="p-2"><select value={p.frequency} onChange={e=>{const u=[...prescriptions];u[idx]={...u[idx],frequency:e.target.value};setPrescriptions(u);}} className="px-1 py-0.5 border rounded text-xs">{['OD','BD','TDS','QID','HS','SOS','Stat','Weekly'].map(f=><option key={f}>{f}</option>)}</select></td>
            <td className="p-2"><input value={p.duration} onChange={e=>{const u=[...prescriptions];u[idx]={...u[idx],duration:e.target.value};setPrescriptions(u);}} className="w-20 px-1 py-0.5 border rounded text-xs" /></td>
            <td className="p-2"><input value={p.instructions} onChange={e=>{const u=[...prescriptions];u[idx]={...u[idx],instructions:e.target.value};setPrescriptions(u);}} className="w-32 px-1 py-0.5 border rounded text-xs" /></td>
            <td className="p-2"><button onClick={()=>setPrescriptions(p=>p.filter((_,i)=>i!==idx))} className="text-red-400">x</button></td></tr>)}</tbody></table></div>}
      </Sec>

      <Sec n={7} title="Follow-up, Advice & Referral" icon="\ud83d\udcc5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Date</label><input type="date" value={followUp.date} onChange={e=>setFollowUp(p=>({...p,date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Notes</label><div className="flex gap-2"><input type="text" placeholder="With reports..." value={followUp.notes} onChange={e=>setFollowUp(p=>({...p,notes:e.target.value}))} className="flex-1 px-3 py-2 border rounded-lg text-sm" /><Mic onResult={t=>setFollowUp(p=>({...p,notes:p.notes+' '+t}))} /></div></div></div>
        <div className="flex items-center gap-2 mb-2"><label className="text-xs font-medium text-gray-500">Advice</label><label className="flex items-center gap-1 text-xs ml-auto"><input type="checkbox" checked={showGujarati} onChange={e=>setShowGujarati(e.target.checked)} /> Gujarati</label></div>
        <div className="flex gap-2 mb-2"><input type="text" placeholder="Add advice..." value={adviceInput} onChange={e=>setAdviceInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&adviceInput.trim()){setFollowUp(p=>({...p,advice:[...p.advice,adviceInput.trim()]}));setAdviceInput('');}}} className="flex-1 px-3 py-2 border rounded-lg text-sm" /><Mic onResult={t=>setFollowUp(p=>({...p,advice:[...p.advice,t]}))} />
          <button onClick={()=>{if(adviceInput.trim()){setFollowUp(p=>({...p,advice:[...p.advice,adviceInput.trim()]}));setAdviceInput('');}}} className="px-3 py-2 bg-gray-100 rounded-lg text-sm">Add</button></div>
        {followUp.advice.map((a,idx)=><div key={idx} className="flex items-center gap-2 p-2 border rounded-lg mb-1 bg-gray-50"><div className="flex-1"><span className="text-sm">{a}</span>{showGujarati&&GUJARATI[a]&&<div className="text-xs text-gray-500 mt-0.5">{GUJARATI[a]}</div>}</div><button onClick={()=>setFollowUp(p=>({...p,advice:p.advice.filter((_,i)=>i!==idx)}))} className="text-red-400 text-xs">x</button></div>)}
        <div className="mt-4 pt-3 border-t"><button onClick={()=>setShowReferral(!showReferral)} className="text-sm font-medium text-blue-600">{showReferral?'Hide':'Add'} Referral</button>
          {showReferral&&<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="block text-xs text-gray-500 mb-1">Department</label><select value={referral.department} onChange={e=>setReferral(p=>({...p,department:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select...</option>{REFERRAL_DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Doctor</label><input type="text" placeholder="Dr." value={referral.doctor} onChange={e=>setReferral(p=>({...p,doctor:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Reason</label><input type="text" value={referral.reason} onChange={e=>setReferral(p=>({...p,reason:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Urgency</label><select value={referral.urgency} onChange={e=>setReferral(p=>({...p,urgency:e.target.value as any}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div></div>}</div>
      </Sec>
      <div className="h-8" />
    </div>

    {sidebarOpen&&<div className="w-80 shrink-0 space-y-4">
      {showHistory&&<div className="bg-white rounded-xl shadow-sm border p-4 sticky top-[60px]"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Past Encounters</h3><button onClick={()=>setShowHistory(false)} className="text-gray-400 text-xs">x</button></div>
        {emr.encountersLoading?<div className="text-center py-4 text-gray-400 text-xs">Loading...</div>:
        emr.pastEncounters.length===0?<div className="text-center py-6 text-gray-400 text-sm"><p>{patient.id?'No past encounters':'Select a patient to see history'}</p></div>:
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">{emr.pastEncounters.map(e=><div key={e.id} className="border rounded-lg p-2 hover:bg-blue-50 cursor-pointer" onClick={async()=>{const data=await emr.cloneEncounter(e.id);if(data){setVitals({systolic:data.vitals.systolic||'',diastolic:data.vitals.diastolic||'',heartRate:data.vitals.heartRate||'',spo2:data.vitals.spo2||'',temperature:data.vitals.temperature||'',weight:data.vitals.weight||'',height:data.vitals.height||'',respiratoryRate:data.vitals.respiratoryRate||'',isAlert:true,onO2:false});setComplaints(data.complaints||[]);setExamEntries(data.examFindings||[]);setDiagnoses(data.diagnoses||[]);setInvestigations((data.investigations||[]).map((i:any)=>({...i,result:'',isAbnormal:false})));setPrescriptions(data.prescriptions||[]);setFollowUp({date:'',notes:'',advice:data.advice||[]});flash('Encounter cloned — modify as needed');}}}>
          <div className="flex items-center justify-between"><span className="text-xs font-medium">{e.date}</span><span className={`text-xs px-1.5 py-0.5 rounded ${e.status==='signed'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{e.status}</span></div>
          {e.primaryDx&&<div className="text-xs text-gray-600 mt-1"><span className="font-mono text-blue-600">{e.primaryDxCode}</span> {e.primaryDx}</div>}
          <div className="text-xs text-gray-400 mt-1">{e.prescriptionCount} meds, {e.investigationCount} labs</div>
          <div className="text-xs text-blue-600 mt-1">Click to clone</div>
        </div>)}</div>}</div>}
      {showCopilot&&<div className="bg-white rounded-xl shadow-sm border p-4 sticky top-[60px]"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">AI Copilot</h3><button onClick={()=>setShowCopilot(false)} className="text-gray-400 text-xs">x</button></div>
        <p className="text-xs text-gray-500 mb-3">AI differentials from current data.</p>
        <button onClick={runCopilot} disabled={copilotLoading} className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 mb-3">{copilotLoading?'Analyzing...':'Generate Differentials'}</button>
        {copilotResult&&<div className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{copilotResult}</div>}</div>}
      {showAnalytics&&<div className="bg-white rounded-xl shadow-sm border p-4 sticky top-[60px]"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Analytics</h3><button onClick={()=>setShowAnalytics(false)} className="text-gray-400 text-xs">x</button></div>
        <div className="space-y-2 text-xs">
          <div className="bg-blue-50 rounded-lg p-3"><div className="text-gray-500">Diagnoses</div><div className="font-bold text-lg text-blue-700">{diagnoses.length}</div>{diagnoses.map(d=><div key={d.code} className="text-gray-600">{d.code} {d.label}</div>)}</div>
          <div className="bg-green-50 rounded-lg p-3"><div className="text-gray-500">Medications</div><div className="font-bold text-lg text-green-700">{prescriptions.length}</div></div>
          <div className="bg-orange-50 rounded-lg p-3"><div className="text-gray-500">Investigations</div><div className="font-bold text-lg text-orange-700">{investigations.length}</div></div>
          <div className="bg-red-50 rounded-lg p-3"><div className="text-gray-500">Safety Alerts</div><div className="font-bold text-lg text-red-700">{activeInteractions.length+allergyConflicts.length}</div></div>
          <div className="bg-purple-50 rounded-lg p-3"><div className="text-gray-500">NEWS2</div><div className="font-bold text-lg text-purple-700">{news2?news2.total+' ('+news2.label+')':'\u2014'}</div></div>
        </div></div>}
    </div>}
    </div>

    {/* AI Clinical Copilot */}
    <AICopilot
      patient={{ name: patient.name, age: patient.age, gender: patient.gender, allergies: patient.allergies }}
      vitals={vitals} complaints={complaints.map((c: any) => c.text || c.complaint || c.name || String(c))} examFindings={examEntries}
      diagnoses={diagnoses} investigations={investigations}
      prescriptions={prescriptions} advice={followUp.advice} followUp={followUp.date || ''}
      onAddDiagnosis={(dx) => { if (!diagnoses.find((d: any) => d.code === dx.code)) setDiagnoses((prev: any) => [...prev, { ...dx, type: 'primary' }]); }}
      onAddInvestigation={(name) => { if (!investigations.find((i: any) => i.name === name)) setInvestigations((prev: any) => [...prev, { name, urgency: 'routine' }]); }}
    />
  </div>);
}
