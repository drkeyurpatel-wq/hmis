// lib/nursing/nursing-station-hooks.ts
// Nursing Station — real data, NEWS2, vitals due logic, functional write operations
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ── Types ──
export interface VitalReading {
  temperature: number | null; pulse: number | null;
  bp_systolic: number | null; bp_diastolic: number | null;
  resp_rate: number | null; spo2: number | null;
  gcs: number | null; pain_scale: number | null;
  recorded_at: string;
}

export interface MedOrder {
  id: string; drugName: string; dose: string; route: string;
  frequency: string; status: string;
  marEntries: { id: string; scheduled_time: string; status: string }[];
  pendingCount: number; overdueCount: number;
}

export interface NursingPatient {
  admissionId: string; patientId: string; patientName: string; uhid: string;
  age: number; gender: string;
  ipdNumber: string; bedNumber: string; bedId: string | null;
  wardId: string; wardName: string; wardType: string; roomNumber: string;
  doctorName: string; department: string;
  admissionDate: string; daysSince: number; payorType: string; diagnosis: string;
  lastVitals: VitalReading | null; lastVitalsAt: string | null;
  hoursSinceVitals: number; vitalsDue: boolean;
  activeMeds: MedOrder[]; medsDueCount: number; medsOverdueCount: number;
  pendingLabs: number; ioPending: boolean;
  todayIntake: number; todayOutput: number;
  news2: number; news2Risk: 'low' | 'low_med' | 'medium' | 'high';
  criticalAlerts: string[];
}

export interface NursingTask {
  id: string; type: 'vitals' | 'medication' | 'io' | 'lab_collect' | 'wound_care' | 'positioning' | 'assessment' | 'custom';
  description: string; patientName: string; uhid: string; bedNumber: string;
  dueAt: string; status: 'overdue' | 'due_now' | 'upcoming' | 'completed';
  priority: 'high' | 'medium' | 'low';
  admissionId: string; patientId: string;
}

// ── NEWS2 ──
function calcNEWS2(v: VitalReading | null): { score: number; risk: 'low' | 'low_med' | 'medium' | 'high' } {
  if (!v) return { score: 0, risk: 'low' };
  let score = 0;
  const rr = v.resp_rate;
  if (rr !== null) { if (rr <= 8) score += 3; else if (rr <= 11) score += 1; else if (rr <= 20) score += 0; else if (rr <= 24) score += 2; else score += 3; }
  const sp = v.spo2;
  if (sp !== null) { if (sp <= 91) score += 3; else if (sp <= 93) score += 2; else if (sp <= 95) score += 1; }
  const sbp = v.bp_systolic;
  if (sbp !== null) { if (sbp <= 90) score += 3; else if (sbp <= 100) score += 2; else if (sbp <= 110) score += 1; else if (sbp > 219) score += 3; }
  const hr = v.pulse;
  if (hr !== null) { if (hr <= 40) score += 3; else if (hr <= 50) score += 1; else if (hr <= 90) score += 0; else if (hr <= 110) score += 1; else if (hr <= 130) score += 2; else score += 3; }
  const temp = v.temperature;
  if (temp !== null) {
    const c = temp > 50 ? (temp - 32) * 5 / 9 : temp;
    if (c <= 35.0) score += 3; else if (c <= 36.0) score += 1; else if (c <= 38.0) score += 0; else if (c <= 39.0) score += 1; else score += 2;
  }
  if (v.gcs !== null && v.gcs < 15) score += 3;
  const risk = score >= 7 ? 'high' : score >= 5 ? 'medium' : (score >= 1 ? 'low_med' : 'low') as any;
  return { score, risk };
}

// ── Vitals interval by ward type ──
function isVitalsDue(wardType: string, lastAt: string | null): { due: boolean; hours: number } {
  const intervals: Record<string, number> = { icu: 1, transplant_icu: 1, nicu: 1, picu: 1, isolation: 2, general: 4, semi_private: 4, private: 6 };
  const interval = intervals[wardType] || 4;
  if (!lastAt) return { due: true, hours: 999 };
  const hours = (Date.now() - new Date(lastAt).getTime()) / 3600000;
  return { due: hours >= interval, hours: Math.round(hours * 10) / 10 };
}

// ── Main Hook ──
export function useNursingStation(centreId: string | null, wardFilter?: string) {
  const [patients, setPatients] = useState<NursingPatient[]>([]);
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    try {
      // 1. Wards
      const { data: wardData } = await sb().from('hmis_wards').select('id, name, type, floor')
        .eq('centre_id', centreId).eq('is_active', true).order('name');
      setWards(wardData || []);

      // 2. Active admissions — use bed reverse FK
      const { data: admissions } = await sb().from('hmis_admissions')
        .select(`id, ipd_number, admission_date, payor_type, provisional_diagnosis,
          patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender),
          doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
          department:hmis_departments(name)`)
        .eq('centre_id', centreId).eq('status', 'active');

      if (!admissions?.length) { setPatients([]); setTasks([]); setLoading(false); return; }

      const admIds = admissions.map((a: any) => a.id);
      const patientIds = [...new Set(admissions.map((a: any) => a.patient?.id).filter(Boolean))];

      // 3. Beds for these admissions
      const { data: bedData } = await sb().from('hmis_beds')
        .select('id, bed_number, current_admission_id, room:hmis_rooms(room_number, ward:hmis_wards(id, name, type))')
        .in('current_admission_id', admIds);
      const bedMap: Record<string, any> = {};
      (bedData || []).forEach((b: any) => { bedMap[b.current_admission_id] = b; });

      // 4. Last vitals per patient
      const { data: vitalsData } = await sb().from('hmis_vitals')
        .select('patient_id, temperature, pulse, bp_systolic, bp_diastolic, resp_rate, spo2, gcs, pain_scale, recorded_at')
        .in('patient_id', patientIds).eq('encounter_type', 'ipd')
        .order('recorded_at', { ascending: false });
      const vitalsMap: Record<string, VitalReading> = {};
      (vitalsData || []).forEach((v: any) => {
        if (!vitalsMap[v.patient_id]) vitalsMap[v.patient_id] = v;
      });

      // 5. Active med orders
      const { data: medOrders } = await sb().from('hmis_ipd_medication_orders')
        .select('id, admission_id, drug_name, dose, route, frequency, status')
        .in('admission_id', admIds).eq('status', 'active');

      // 6. Today's MAR
      const { data: marData } = await sb().from('hmis_mar')
        .select('id, medication_order_id, admission_id, scheduled_time, status')
        .in('admission_id', admIds)
        .gte('scheduled_time', todayStr + 'T00:00:00')
        .lte('scheduled_time', todayStr + 'T23:59:59');

      // 7. Pending labs
      const { data: labData } = await sb().from('hmis_lab_orders')
        .select('patient_id, status')
        .in('patient_id', patientIds).in('status', ['ordered', 'sample_collected']);

      // 8. Today's I/O
      const { data: ioData } = await sb().from('hmis_io_chart')
        .select('admission_id, total_intake_ml, total_output_ml')
        .in('admission_id', admIds).eq('io_date', todayStr);

      // ── Assemble ──
      const nursingPatients: NursingPatient[] = [];
      for (const a of admissions) {
        const bed = bedMap[a.id];
        const ward = bed?.room?.ward;
        if (wardFilter && ward?.id !== wardFilter) continue;

        const pid = a.patient?.id;
        const wardType = ward?.type || 'general';
        const daysSince = Math.max(1, Math.ceil((now.getTime() - new Date(a.admission_date).getTime()) / 86400000));
        const lastV = pid ? vitalsMap[pid] || null : null;
        const vc = isVitalsDue(wardType, lastV?.recorded_at || null);
        const n2 = calcNEWS2(lastV);

        // Meds
        const admMeds = (medOrders || []).filter((m: any) => m.admission_id === a.id);
        const admMar = (marData || []).filter((m: any) => m.admission_id === a.id);
        const activeMeds: MedOrder[] = admMeds.map((m: any) => {
          const entries = admMar.filter((mr: any) => mr.medication_order_id === m.id);
          const pending = entries.filter((e: any) => e.status === 'scheduled');
          const overdue = pending.filter((e: any) => new Date(e.scheduled_time) < now);
          return { id: m.id, drugName: m.drug_name, dose: m.dose, route: m.route, frequency: m.frequency, status: m.status, marEntries: entries, pendingCount: pending.length, overdueCount: overdue.length };
        });
        const totalPending = activeMeds.reduce((s, m) => s + m.pendingCount, 0);
        const totalOverdue = activeMeds.reduce((s, m) => s + m.overdueCount, 0);

        const patLabs = (labData || []).filter((l: any) => l.patient_id === pid);
        const patIO = (ioData || []).filter((io: any) => io.admission_id === a.id);

        // Alerts
        const alerts: string[] = [];
        if (n2.score >= 7) alerts.push(`NEWS2 ${n2.score} — immediate review`);
        else if (n2.score >= 5) alerts.push(`NEWS2 ${n2.score} — urgent response`);
        if (totalOverdue > 0) alerts.push(`${totalOverdue} overdue medication(s)`);
        if (lastV?.bp_systolic && lastV.bp_systolic < 90) alerts.push('Hypotension');
        if (lastV?.bp_systolic && lastV.bp_systolic > 180) alerts.push('Hypertensive crisis');
        if (lastV?.spo2 && lastV.spo2 < 92) alerts.push('Low SpO2');
        if (lastV?.pulse && (lastV.pulse < 50 || lastV.pulse > 130)) alerts.push('Abnormal HR');
        if (lastV?.temperature && lastV.temperature > 102) alerts.push('High fever');
        if (vc.hours > 12) alerts.push('No vitals in 12+ hours');

        nursingPatients.push({
          admissionId: a.id, patientId: pid,
          patientName: `${a.patient?.first_name} ${a.patient?.last_name || ''}`.trim(),
          uhid: a.patient?.uhid || '', age: a.patient?.age_years || 0, gender: a.patient?.gender || '',
          ipdNumber: a.ipd_number, bedNumber: bed?.bed_number || '—', bedId: bed?.id || null,
          wardId: ward?.id || '', wardName: ward?.name || '—', wardType,
          roomNumber: bed?.room?.room_number || '—',
          doctorName: a.doctor?.full_name || '—', department: a.department?.name || '—',
          admissionDate: a.admission_date?.split('T')[0], daysSince,
          payorType: a.payor_type || 'self', diagnosis: a.provisional_diagnosis || '',
          lastVitals: lastV, lastVitalsAt: lastV?.recorded_at || null,
          hoursSinceVitals: vc.hours, vitalsDue: vc.due,
          activeMeds, medsDueCount: totalPending, medsOverdueCount: totalOverdue,
          pendingLabs: patLabs.length, ioPending: patIO.length === 0,
          todayIntake: patIO.reduce((s: number, io: any) => s + (io.total_intake_ml || 0), 0),
          todayOutput: patIO.reduce((s: number, io: any) => s + (io.total_output_ml || 0), 0),
          news2: n2.score, news2Risk: n2.risk, criticalAlerts: alerts,
        });
      }

      nursingPatients.sort((a, b) => {
        if (a.criticalAlerts.length !== b.criticalAlerts.length) return b.criticalAlerts.length - a.criticalAlerts.length;
        if (a.news2 !== b.news2) return b.news2 - a.news2;
        return a.bedNumber.localeCompare(b.bedNumber);
      });
      setPatients(nursingPatients);

      // ── Tasks ──
      const taskList: NursingTask[] = [];
      for (const p of nursingPatients) {
        if (p.vitalsDue) taskList.push({ id: `vit-${p.admissionId}`, type: 'vitals', description: p.lastVitalsAt ? `Vitals overdue (${Math.round(p.hoursSinceVitals)}h ago)` : 'Initial vitals needed', patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber, dueAt: 'Now', status: p.hoursSinceVitals > 8 ? 'overdue' : 'due_now', priority: ['icu','transplant_icu','nicu'].includes(p.wardType) ? 'high' : 'medium', admissionId: p.admissionId, patientId: p.patientId });
        if (p.medsOverdueCount > 0) taskList.push({ id: `medov-${p.admissionId}`, type: 'medication', description: `${p.medsOverdueCount} overdue: ${p.activeMeds.filter(m=>m.overdueCount>0).map(m=>m.drugName).join(', ')}`, patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber, dueAt: 'Overdue', status: 'overdue', priority: 'high', admissionId: p.admissionId, patientId: p.patientId });
        else if (p.medsDueCount > 0) taskList.push({ id: `med-${p.admissionId}`, type: 'medication', description: `${p.medsDueCount} med(s) scheduled`, patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber, dueAt: 'Scheduled', status: 'due_now', priority: 'medium', admissionId: p.admissionId, patientId: p.patientId });
        if (p.pendingLabs > 0) taskList.push({ id: `lab-${p.admissionId}`, type: 'lab_collect', description: `${p.pendingLabs} sample(s) pending`, patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber, dueAt: 'Pending', status: 'upcoming', priority: 'low', admissionId: p.admissionId, patientId: p.patientId });
        if (p.ioPending) taskList.push({ id: `io-${p.admissionId}`, type: 'io', description: 'No I/O recorded today', patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber, dueAt: 'Today', status: 'upcoming', priority: 'low', admissionId: p.admissionId, patientId: p.patientId });
      }
      taskList.sort((a, b) => ({ overdue: 0, due_now: 1, upcoming: 2, completed: 3 }[a.status] || 9) - ({ overdue: 0, due_now: 1, upcoming: 2, completed: 3 }[b.status] || 9));
      setTasks(taskList);

    } catch (err) { console.error('Nursing load error:', err); }
    setLoading(false);
  }, [centreId, wardFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('nursing-' + centreId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_admissions', filter: `centre_id=eq.${centreId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_vitals' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_mar' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_beds' }, () => load())
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    totalPatients: patients.length,
    icuPatients: patients.filter(p => ['icu','transplant_icu','nicu','picu'].includes(p.wardType)).length,
    vitalsDue: patients.filter(p => p.vitalsDue).length,
    medsDue: patients.reduce((s,p) => s + p.medsDueCount, 0),
    medsOverdue: patients.reduce((s,p) => s + p.medsOverdueCount, 0),
    pendingLabs: patients.reduce((s,p) => s + p.pendingLabs, 0),
    criticalAlerts: patients.filter(p => p.criticalAlerts.length > 0).length,
    highNEWS: patients.filter(p => p.news2 >= 5).length,
    overdueTasks: tasks.filter(t => t.status === 'overdue').length,
    dueNowTasks: tasks.filter(t => t.status === 'due_now').length,
    ioPending: patients.filter(p => p.ioPending).length,
  }), [patients, tasks]);

  return { patients, tasks, wards, loading, stats, load };
}

// ── Write operations ──
export async function recordVitals(patientId: string, encounterId: string, staffId: string, vitals: {
  temperature?: number; pulse?: number; bp_systolic?: number; bp_diastolic?: number;
  resp_rate?: number; spo2?: number; weight_kg?: number; gcs?: number; pain_scale?: number; blood_sugar?: number;
}) {
  if (!sb()) return { error: 'Not connected' };
  const { data, error } = await sb().from('hmis_vitals').insert({
    patient_id: patientId, encounter_type: 'ipd', encounter_id: encounterId,
    ...vitals, recorded_by: staffId,
  }).select('id').single();
  return { data, error: error?.message };
}

export async function administerMed(marId: string, staffId: string, action: 'given' | 'held' | 'refused', opts?: {
  dose_given?: string; site?: string; hold_reason?: string; notes?: string;
}) {
  if (!sb()) return { error: 'Not connected' };
  const { error } = await sb().from('hmis_mar').update({
    status: action, administered_by: staffId,
    administered_time: action === 'given' ? new Date().toISOString() : null, ...opts,
  }).eq('id', marId);
  return { error: error?.message };
}

export async function recordIO(admissionId: string, staffId: string, shift: 'morning' | 'evening' | 'night', data: {
  oral_intake_ml?: number; iv_fluid_ml?: number; blood_products_ml?: number;
  urine_ml?: number; drain_1_ml?: number; drain_2_ml?: number;
  ryles_aspirate_ml?: number; vomit_ml?: number; stool_count?: number;
}) {
  if (!sb()) return { error: 'Not connected' };
  const { error } = await sb().from('hmis_io_chart').insert({
    admission_id: admissionId, recorded_by: staffId, shift,
    io_date: new Date().toISOString().split('T')[0], ...data,
  });
  return { error: error?.message };
}

export async function saveNursingNote(admissionId: string, nurseId: string, shift: 'morning' | 'evening' | 'night', note: string) {
  if (!sb()) return { error: 'Not connected' };
  const { error } = await sb().from('hmis_nursing_notes').insert({ admission_id: admissionId, nurse_id: nurseId, shift, note });
  return { error: error?.message };
}
