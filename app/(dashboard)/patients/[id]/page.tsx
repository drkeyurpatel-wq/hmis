'use client';
import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { usePatient360 } from '@/lib/patient/patient-360-hooks';
import { sb } from '@/lib/supabase/browser';
import {
  Heart, Thermometer, Wind, Droplets, Activity, Clock, Pill, FlaskConical,
  ScanLine, FileText, AlertTriangle, BedDouble, User, Phone, Calendar,
  ChevronRight, RefreshCw, Stethoscope, ClipboardList, IndianRupee,
  Scissors, UtensilsCrossed, ArrowLeft, Shield, Plus, TrendingUp,
} from 'lucide-react';
import { RoleGuard } from '@/components/ui/shared';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
const ago = (d: string) => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

function Patient360Inner() {
  const { id } = useParams();
  const router = useRouter();
  const patientId = id as string;
  const { staff, activeCentreId } = useAuthStore();
  const p = usePatient360(patientId, activeCentreId);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Quick vitals
  const [showVitals, setShowVitals] = useState(false);
  const [vf, setVf] = useState({ heart_rate: '', systolic_bp: '', diastolic_bp: '', temperature: '', spo2: '', respiratory_rate: '' });
  const saveVitals = useCallback(async () => {
    if (!sb() || !staff) return;
    const record: any = { patient_id: patientId, recorded_by: staff.id, recorded_at: new Date().toISOString() };
    if (vf.heart_rate) record.heart_rate = parseFloat(vf.heart_rate);
    if (vf.systolic_bp) record.systolic_bp = parseFloat(vf.systolic_bp);
    if (vf.diastolic_bp) record.diastolic_bp = parseFloat(vf.diastolic_bp);
    if (vf.temperature) record.temperature = parseFloat(vf.temperature);
    if (vf.spo2) record.spo2 = parseFloat(vf.spo2);
    if (vf.respiratory_rate) record.respiratory_rate = parseFloat(vf.respiratory_rate);
    if (p.admission) record.admission_id = p.admission.id;
    const { error } = await sb()!.from('hmis_vitals').insert(record);
    if (!error) { flash('Vitals recorded'); setShowVitals(false); setVf({ heart_rate: '', systolic_bp: '', diastolic_bp: '', temperature: '', spo2: '', respiratory_rate: '' }); p.reload(); }
    else flash('Error: ' + error.message);
  }, [patientId, staff, vf, p]);

  // Quick note
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const saveNote = useCallback(async () => {
    if (!sb() || !staff || !noteText.trim()) return;
    const { error } = await sb()!.from('hmis_emr_encounters').insert({
      patient_id: patientId, doctor_id: staff.id, centre_id: activeCentreId,
      encounter_type: 'note', chief_complaint: noteText.trim().substring(0, 100),
      assessment: noteText.trim(), encounter_date: new Date().toISOString().split('T')[0],
    });
    if (!error) { flash('Note saved'); setShowNote(false); setNoteText(''); p.reload(); }
    else flash('Error: ' + error.message);
  }, [patientId, staff, noteText, activeCentreId, p]);

  if (p.loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-gray-400" size={24} /><span className="ml-2 text-gray-400">Loading patient...</span></div>;
  if (!p.patient) return <div className="text-center py-20 text-gray-400">Patient not found</div>;

  const pt = p.patient;
  const age = pt.date_of_birth ? Math.floor((Date.now() - new Date(pt.date_of_birth).getTime()) / 31557600000) : null;
  const news2Color = p.news2Risk === 'high' ? 'bg-red-600' : p.news2Risk === 'medium' ? 'bg-orange-500' : p.news2Risk === 'low-medium' ? 'bg-yellow-500' : 'bg-green-600';

  return (
    <div className="max-w-[1600px] mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* HEADER */}
      <div className="bg-white rounded-xl border shadow-sm mb-3 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-400" /></button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{pt.first_name} {pt.last_name || ''}</h1>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{pt.uhid}</span>
                {age && <span className="text-xs text-gray-500">{age}y/{pt.gender === 'male' ? 'M' : pt.gender === 'female' ? 'F' : 'O'}</span>}
                {pt.blood_group && <span className="text-xs font-bold text-red-600">{pt.blood_group}</span>}
              </div>
              {pt.phone_primary && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} /> {pt.phone_primary}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {p.allergies.length > 0 && (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1 rounded-lg">
                <AlertTriangle size={12} /> {p.allergies.map((a: any) => a.allergen).join(', ')}
              </div>
            )}
            {p.criticalAlerts.length > 0 && (
              <div className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-lg animate-pulse">
                <AlertTriangle size={12} /> {p.criticalAlerts.length} Critical
              </div>
            )}
            {p.news2Score !== null && p.news2Score >= 5 && (
              <div className={`${news2Color} text-white text-xs px-2 py-1 rounded-lg`}>NEWS2: {p.news2Score}</div>
            )}
            <button onClick={p.reload} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw size={14} className="text-gray-400" /></button>
          </div>
        </div>

        {p.isAdmitted && p.admission && (
          <div className={`flex items-center gap-6 px-4 py-2 text-xs ${p.isICU ? 'bg-red-50' : 'bg-teal-50'}`}>
            <div className="flex items-center gap-1.5">
              <BedDouble size={13} className={p.isICU ? 'text-red-600' : 'text-teal-600'} />
              <span className="font-semibold">{(p.bed as any)?.bed_number || '—'}</span>
              <span className="text-gray-500">{(p.ward as any)?.name || ''}</span>
            </div>
            <div className="text-gray-500">IPD: <span className="font-mono font-semibold text-gray-700">{p.admission.ipd_number}</span></div>
            <div className="text-gray-500">Dr. <span className="font-semibold text-gray-700">{(p.primaryDoctor as any)?.full_name || '—'}</span></div>
            <div className="text-gray-500">Day <span className="font-bold text-gray-700">{p.daysAdmitted}</span></div>
            <div className="text-gray-500 uppercase font-semibold">{p.billingSummary.payorType}</div>
            {p.isICU && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">ICU</span>}
          </div>
        )}
      </div>

      {/* QUICK ACTIONS */}
      {p.isAdmitted && (
        <div className="flex gap-2 mb-3">
          {[
            { label: 'Record Vitals', icon: Heart, color: 'bg-rose-50 text-rose-700 border-rose-200', action: () => setShowVitals(!showVitals) },
            { label: 'Quick Note', icon: FileText, color: 'bg-blue-50 text-blue-700 border-blue-200', action: () => setShowNote(!showNote) },
            { label: 'Order Lab', icon: FlaskConical, color: 'bg-purple-50 text-purple-700 border-purple-200', action: () => router.push('/lab') },
            { label: 'Order Imaging', icon: ScanLine, color: 'bg-indigo-50 text-indigo-700 border-indigo-200', action: () => router.push('/radiology') },
            { label: 'Prescribe', icon: Pill, color: 'bg-green-50 text-green-700 border-green-200', action: () => router.push('/emr-v2') },
            { label: 'Billing', icon: IndianRupee, color: 'bg-amber-50 text-amber-700 border-amber-200', action: () => router.push('/billing') },
          ].map((a) => (
            <button key={a.label} onClick={a.action} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:shadow-sm transition-all ${a.color}`}>
              <a.icon size={13} /> {a.label}
            </button>
          ))}
        </div>
      )}

      {/* INLINE VITALS FORM */}
      {showVitals && (
        <div className="bg-white rounded-xl border shadow-sm mb-3 p-4">
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Record Vitals</h3><button onClick={() => setShowVitals(false)} className="text-gray-400 text-xs">Close</button></div>
          <div className="grid grid-cols-6 gap-3">
            {([['heart_rate','HR (bpm)','72'],['systolic_bp','SBP','120'],['diastolic_bp','DBP','80'],['temperature','Temp (°C)','37.0'],['spo2','SpO₂ (%)','98'],['respiratory_rate','RR (/min)','16']] as const).map(([key,label,ph]) => (
              <div key={key}><label className="text-[10px] text-gray-500 block mb-1">{label}</label>
              <input type="number" step="0.1" placeholder={ph} value={(vf as any)[key]} onChange={(e: any) => setVf(prev => ({...prev,[key]:e.target.value}))} className="w-full px-2 py-1.5 border rounded-lg text-sm text-center" /></div>
            ))}
          </div>
          <button onClick={saveVitals} className="mt-3 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Save Vitals</button>
        </div>
      )}
      {showNote && (
        <div className="bg-white rounded-xl border shadow-sm mb-3 p-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm">Quick Note</h3><button onClick={() => setShowNote(false)} className="text-gray-400 text-xs">Close</button></div>
          <textarea value={noteText} onChange={(e: any) => setNoteText(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none" placeholder="Assessment, plan, progress note..." autoFocus />
          <button onClick={saveNote} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Save Note</button>
        </div>
      )}

      {/* MAIN CONTENT — 3-column for admitted, simple for OPD */}
      {p.isAdmitted ? (
        <div className="grid grid-cols-12 gap-3">
          {/* LEFT: Vitals + Context */}
          <div className="col-span-3 space-y-3">
            <div className="bg-white rounded-xl border p-3">
              <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1"><Activity size={12} /> Vitals</h3>{p.latestVitals && <span className="text-[10px] text-gray-400">{ago(p.latestVitals.recorded_at)}</span>}</div>
              {p.latestVitals ? (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {l:'HR',v:p.latestVitals.heart_rate,u:'bpm',icon:Heart,c:'text-rose-600'},
                    {l:'BP',v:p.latestVitals.systolic_bp?`${p.latestVitals.systolic_bp}/${p.latestVitals.diastolic_bp||'?'}`:null,u:'mmHg',icon:TrendingUp,c:'text-blue-600'},
                    {l:'SpO₂',v:p.latestVitals.spo2,u:'%',icon:Droplets,c:'text-cyan-600'},
                    {l:'Temp',v:p.latestVitals.temperature?Number(p.latestVitals.temperature).toFixed(1):null,u:'°C',icon:Thermometer,c:'text-orange-600'},
                    {l:'RR',v:p.latestVitals.respiratory_rate,u:'/min',icon:Wind,c:'text-green-600'},
                    {l:'NEWS2',v:p.news2Score,u:'',icon:Shield,c:p.news2Risk==='high'?'text-red-600':p.news2Risk==='medium'?'text-orange-600':'text-green-600'},
                  ] as const).map((v) => (
                    <div key={v.l} className="bg-gray-50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500"><v.icon size={10} className={v.c} /> {v.l}</div>
                      <div className={`text-lg font-bold ${v.v != null ? v.c : 'text-gray-300'}`}>{v.v ?? '—'}<span className="text-[10px] font-normal text-gray-400 ml-0.5">{v.u}</span></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-4 text-gray-400 text-xs">No vitals recorded</div>}
              {p.vitalsTrend.length > 2 && (
                <div className="mt-2 border-t pt-2"><div className="text-[10px] text-gray-400 mb-1">HR trend</div>
                <div className="flex items-end gap-0.5 h-8">{p.vitalsTrend.map((v: any, i: number) => {
                  const hr = v.heart_rate || 0; const h = Math.max(4, Math.min(32, ((hr-50)/80)*32));
                  return <div key={i} className={`${hr>100||hr<60?'bg-red-400':'bg-teal-400'} rounded-sm flex-1`} style={{height:`${h}px`}} title={`${hr}`} />;
                })}</div></div>
              )}
            </div>
            {p.allergies.length > 0 && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-3">
                <h3 className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1"><AlertTriangle size={12} /> Allergies</h3>
                {p.allergies.map((a: any) => <div key={a.id} className="text-xs text-red-700"><span className="font-semibold">{a.allergen}</span>{a.reaction && ` — ${a.reaction}`}</div>)}
              </div>
            )}
            {p.dietOrder && (
              <div className="bg-white rounded-xl border p-3"><h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><UtensilsCrossed size={12} /> Diet</h3>
              <div className="text-sm font-medium">{p.dietOrder.diet_type?.replace(/_/g,' ')}</div>
              {p.dietOrder.special_instructions && <div className="text-xs text-gray-500 mt-1">{p.dietOrder.special_instructions}</div>}</div>
            )}
            {p.surgicalPlan && (
              <div className="bg-white rounded-xl border p-3"><h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><Scissors size={12} /> Surgery</h3>
              <div className="text-sm font-medium">{p.surgicalPlan.procedure_name}</div>
              <div className="text-xs text-gray-500">Ready: {p.surgicalPlan.readiness_pct || 0}%</div>
              {p.otBookings.length > 0 && <div className="text-xs text-teal-600 mt-1">{p.otBookings[0].scheduled_date} {p.otBookings[0].scheduled_start}</div>}</div>
            )}
          </div>

          {/* CENTER: Meds + Orders + Notes */}
          <div className="col-span-6 space-y-3">
            <div className="bg-white rounded-xl border p-3">
              <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1"><Pill size={12} /> Active Medications ({p.activeMeds.length})</h3>
              {p.medsNextDue.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{p.medsNextDue.length} due</span>}</div>
              {p.activeMeds.length > 0 ? <div className="space-y-1.5">{p.activeMeds.slice(0,8).map((m: any) => {
                const isDue = p.medsNextDue.some((md: any) => md.medication_order_id === m.id);
                return <div key={m.id} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${isDue?'bg-amber-50 border border-amber-200':'bg-gray-50'}`}>
                  <div><span className="font-semibold">{m.drug_name}</span><span className="text-gray-500 ml-1">{m.dose} {m.route} {m.frequency}</span></div>
                  <div className="flex items-center gap-2">{isDue && <span className="text-amber-600 font-semibold">DUE</span>}{m.is_stat && <span className="bg-red-100 text-red-600 px-1 py-0.5 rounded text-[10px] font-bold">STAT</span>}</div>
                </div>;
              })}{p.activeMeds.length > 8 && <div className="text-[10px] text-gray-400 text-center">+{p.activeMeds.length-8} more</div>}</div>
              : <div className="text-xs text-gray-400 text-center py-3">No active medications</div>}
            </div>

            {(p.pendingLabOrders.length > 0 || p.pendingRadOrders.length > 0) && (
              <div className="bg-white rounded-xl border p-3">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><ClipboardList size={12} /> Pending Orders</h3>
                <div className="space-y-1">{p.pendingLabOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 px-2 bg-purple-50 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5"><FlaskConical size={11} className="text-purple-500" /><span className="font-medium">{o.test_name||(o.test as any)?.test_name}</span></div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{o.status?.replace('_',' ')}</span></div>
                ))}{p.pendingRadOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 px-2 bg-indigo-50 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5"><ScanLine size={11} className="text-indigo-500" /><span className="font-medium">{o.test_name}</span><span className="text-[10px] text-gray-400">{o.modality}</span></div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{o.status?.replace('_',' ')}</span></div>
                ))}</div>
              </div>
            )}

            <div className="bg-white rounded-xl border p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><Stethoscope size={12} /> Notes (24h)</h3>
              {p.recentNotes.length > 0 ? <div className="space-y-2">{p.recentNotes.map((n: any) => (
                <div key={n.id} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-gray-700">{(n.doctor as any)?.full_name || 'Unknown'}</span><span className="text-[10px] text-gray-400">{ago(n.created_at)}</span></div>
                  {n.chief_complaint && <div className="text-xs text-gray-600 mb-1">CC: {n.chief_complaint}</div>}
                  {n.assessment && <div className="text-xs text-gray-600">{n.assessment.substring(0,200)}</div>}
                  {n.plan && <div className="text-xs text-teal-700 mt-1">Plan: {n.plan.substring(0,150)}</div>}
                </div>
              ))}</div> : <div className="text-xs text-gray-400 text-center py-3">No notes in 24h</div>}
            </div>
          </div>

          {/* RIGHT: Results + Billing */}
          <div className="col-span-3 space-y-3">
            <div className="bg-white rounded-xl border p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><FlaskConical size={12} /> Lab Results (48h)</h3>
              {p.recentLabResults.length > 0 ? <div className="space-y-2">{p.recentLabResults.slice(0,6).map((lab: any) => (
                <div key={lab.id} className="bg-gray-50 rounded-lg p-2">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold">{lab.test_name}</span><span className="text-[10px] text-gray-400">{ago(lab.ordered_at)}</span></div>
                  {(lab.results as any)?.slice(0,4).map((r: any, i: number) => (
                    <div key={i} className={`flex justify-between text-[11px] mt-0.5 ${r.is_critical?'text-red-600 font-bold':r.is_abnormal?'text-orange-600':'text-gray-600'}`}>
                      <span>{r.parameter_name}</span><span>{r.result_value} {r.unit}{r.is_critical?' ⚠️':r.is_abnormal?' ↑':''}</span></div>
                  ))}
                </div>
              ))}</div> : <div className="text-xs text-gray-400 text-center py-3">No results in 48h</div>}
            </div>

            {p.recentRadReports.length > 0 && (
              <div className="bg-white rounded-xl border p-3">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><ScanLine size={12} /> Radiology</h3>
                {p.recentRadReports.slice(0,3).map((r: any) => (
                  <div key={r.id} className="bg-gray-50 rounded-lg p-2 mb-1.5">
                    <div className="text-xs font-semibold">{(r.order as any)?.test_name}</div>
                    {r.impression && <div className="text-[11px] text-gray-600 mt-0.5">{r.impression.substring(0,120)}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl border p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><IndianRupee size={12} /> Billing</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Charged</span><span className="font-mono font-semibold">{INR(p.billingSummary.totalCharged)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Paid</span><span className="font-mono text-green-600">{INR(p.billingSummary.totalPaid)}</span></div>
                <div className="flex justify-between text-xs border-t pt-1.5"><span className="font-semibold text-gray-500">Balance</span><span className={`font-mono font-bold ${p.billingSummary.balance>0?'text-red-600':'text-green-600'}`}>{INR(p.billingSummary.balance)}</span></div>
                {p.billingSummary.advanceBalance > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Advance</span><span className="font-mono text-blue-600">{INR(p.billingSummary.advanceBalance)}</span></div>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* NON-ADMITTED: History view */
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold text-sm mb-3">Recent Visits</h3>
            {p.recentNotes.length > 0 ? p.recentNotes.map((n: any) => (
              <div key={n.id} className="border-b last:border-0 py-2">
                <div className="flex justify-between text-xs"><span className="font-medium">{n.encounter_type}</span><span className="text-gray-400">{ago(n.created_at)}</span></div>
                {n.chief_complaint && <div className="text-xs text-gray-600">{n.chief_complaint}</div>}</div>
            )) : <div className="text-xs text-gray-400 text-center py-4">No recent visits</div>}</div>
          <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold text-sm mb-3">Lab History</h3>
            {p.recentLabResults.length > 0 ? p.recentLabResults.slice(0,5).map((lab: any) => (
              <div key={lab.id} className="border-b last:border-0 py-2">
                <div className="flex justify-between text-xs"><span className="font-medium">{lab.test_name}</span><span className="text-gray-400">{ago(lab.ordered_at)}</span></div></div>
            )) : <div className="text-xs text-gray-400 text-center py-4">No recent labs</div>}</div>
          <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold text-sm mb-3">Billing</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Billed</span><span className="font-bold">{INR(p.billingSummary.totalCharged)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Paid</span><span className="text-green-600">{INR(p.billingSummary.totalPaid)}</span></div>
              <div className="flex justify-between text-sm border-t pt-2"><span>Balance</span><span className={`font-bold ${p.billingSummary.balance>0?'text-red-600':'text-green-600'}`}>{INR(p.billingSummary.balance)}</span></div>
            </div></div>
        </div>
      )}
    </div>
  );
}

export default function PatientDetailPage() { return <RoleGuard><Patient360Inner /></RoleGuard>; }
