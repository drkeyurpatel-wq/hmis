// lib/nursing/nursing-station-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface NursingPatient {
  admissionId: string; patientId: string; patientName: string; uhid: string;
  ipdNumber: string; bedNumber: string; wardName: string; wardType: string;
  roomName: string; doctorName: string; department: string;
  admissionDate: string; daysSince: number; payorType: string;
  // Alerts
  vitalsDueAt: string | null; lastVitals: string | null;
  medsDueCount: number; nextMedDue: string | null;
  ioPending: boolean; lastIO: string | null;
  pendingLabs: number; criticalAlerts: number;
  nursingNotes: string | null;
  // Scores
  news2Score: number | null; fallRisk: string | null;
}

export interface NursingTask {
  id: string; type: 'vitals' | 'medication' | 'io' | 'lab_collect' | 'wound_care' | 'positioning' | 'assessment' | 'custom';
  description: string; patientName: string; uhid: string; bedNumber: string;
  dueAt: string; status: 'overdue' | 'due_now' | 'upcoming' | 'completed';
  priority: 'high' | 'medium' | 'low';
  admissionId: string;
}

// ============================================================
// NURSING STATION — ward-level aggregate
// ============================================================
export function useNursingStation(centreId: string | null, wardFilter?: string) {
  const [patients, setPatients] = useState<NursingPatient[]>([]);
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Load wards
    const { data: wardData } = await sb()!.from('hmis_wards').select('id, name, type, floor')
      .eq('centre_id', centreId).eq('is_active', true).order('name');
    setWards(wardData || []);

    // Load all active admissions with beds
    let q = sb()!.from('hmis_admissions')
      .select(`id, ipd_number, admission_date, payor_type, status,
        patient:hmis_patients!inner(id, uhid, first_name, last_name),
        doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
        department:hmis_departments(name),
        bed:hmis_beds(bed_number, room:hmis_rooms(name, ward:hmis_wards(id, name, type)))`)
      .eq('centre_id', centreId).eq('status', 'active');

    const { data: admissions } = await q;

    // Load today's MAR records (medication administration)
    const admIds = (admissions || []).map((a: any) => a.id);
    let marData: any[] = [];
    let labData: any[] = [];

    if (admIds.length > 0) {
      const { data: mar } = await sb()!.from('hmis_mar')
        .select('admission_id, status, scheduled_time, medication_order:hmis_ipd_medication_orders(drug_name)')
        .in('admission_id', admIds).eq('scheduled_date', today);
      marData = mar || [];

      const { data: labs } = await sb()!.from('hmis_lab_orders')
        .select('id, patient_id, status')
        .in('patient_id', (admissions || []).map((a: any) => a.patient?.id))
        .in('status', ['ordered', 'sample_collected']);
      labData = labs || [];
    }

    const nursingPatients: NursingPatient[] = (admissions || []).map((a: any) => {
      const ward = a.bed?.room?.ward;
      if (wardFilter && ward?.id !== wardFilter) return null;

      const daysSince = Math.max(1, Math.ceil((now.getTime() - new Date(a.admission_date).getTime()) / 86400000));

      // MAR for this patient
      const patientMar = marData.filter((m: any) => m.admission_id === a.id);
      const pendingMeds = patientMar.filter((m: any) => m.status === 'scheduled' || m.status === 'due');
      const overdueMeds = pendingMeds.filter((m: any) => {
        if (!m.scheduled_time) return false;
        const schedTime = new Date(`${today}T${m.scheduled_time}`);
        return schedTime < now;
      });

      // Labs for this patient
      const patientLabs = labData.filter((l: any) => l.patient_id === a.patient?.id);

      // Vitals schedule: every 4h for general, every 1h for ICU
      const vitalInterval = ward?.type === 'icu' || ward?.type === 'transplant_icu' ? 1 : 4;
      const lastVitalsTime = null; // Would need vitals query — simplified
      const hoursSinceVitals = 5; // Placeholder
      const vitalsDue = hoursSinceVitals >= vitalInterval;

      return {
        admissionId: a.id, patientId: a.patient?.id,
        patientName: `${a.patient?.first_name} ${a.patient?.last_name}`, uhid: a.patient?.uhid,
        ipdNumber: a.ipd_number, bedNumber: a.bed?.bed_number || '—',
        wardName: ward?.name || '—', wardType: ward?.type || 'general',
        roomName: a.bed?.room?.name || '—',
        doctorName: a.doctor?.full_name || '—', department: a.department?.name || '—',
        admissionDate: a.admission_date?.split('T')[0], daysSince, payorType: a.payor_type || 'self',
        vitalsDueAt: vitalsDue ? 'now' : null, lastVitals: lastVitalsTime,
        medsDueCount: pendingMeds.length, nextMedDue: pendingMeds[0]?.scheduled_time || null,
        ioPending: false, lastIO: null,
        pendingLabs: patientLabs.length, criticalAlerts: overdueMeds.length,
        nursingNotes: null, news2Score: null, fallRisk: null,
      };
    }).filter(Boolean) as NursingPatient[];

    setPatients(nursingPatients);

    // Generate task board
    const taskList: NursingTask[] = [];
    nursingPatients.forEach((p: NursingPatient) => {
      if (p.vitalsDueAt) taskList.push({
        id: `vit-${p.admissionId}`, type: 'vitals', description: 'Vitals check due',
        patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber,
        dueAt: 'Now', status: 'due_now', priority: p.wardType === 'icu' ? 'high' : 'medium', admissionId: p.admissionId,
      });
      if (p.medsDueCount > 0) taskList.push({
        id: `med-${p.admissionId}`, type: 'medication',
        description: `${p.medsDueCount} medication${p.medsDueCount > 1 ? 's' : ''} due`,
        patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber,
        dueAt: p.nextMedDue || 'Now', status: p.criticalAlerts > 0 ? 'overdue' : 'due_now',
        priority: p.criticalAlerts > 0 ? 'high' : 'medium', admissionId: p.admissionId,
      });
      if (p.pendingLabs > 0) taskList.push({
        id: `lab-${p.admissionId}`, type: 'lab_collect',
        description: `${p.pendingLabs} sample${p.pendingLabs > 1 ? 's' : ''} to collect`,
        patientName: p.patientName, uhid: p.uhid, bedNumber: p.bedNumber,
        dueAt: 'Pending', status: 'upcoming', priority: 'low', admissionId: p.admissionId,
      });
    });

    // Sort: overdue first, then due_now, then upcoming
    const priorityOrder: Record<string, number> = { overdue: 0, due_now: 1, upcoming: 2, completed: 3 };
    taskList.sort((a, b) => (priorityOrder[a.status] || 9) - (priorityOrder[b.status] || 9));
    setTasks(taskList);

    setLoading(false);
  }, [centreId, wardFilter]);

  useEffect(() => { load(); }, [load]);

  // Real-time: auto-refresh when admissions/beds/MAR change
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb()!.channel('nursing-station-' + centreId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_admissions', filter: `centre_id=eq.${centreId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_mar' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_beds', filter: `centre_id=eq.${centreId}` }, () => load())
      .subscribe();
    return () => { sb()!.removeChannel(ch); };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    totalPatients: patients.length,
    icuPatients: patients.filter(p => p.wardType === 'icu' || p.wardType === 'transplant_icu').length,
    vitalsDue: patients.filter(p => p.vitalsDueAt).length,
    medsDue: patients.reduce((s, p) => s + p.medsDueCount, 0),
    pendingLabs: patients.reduce((s, p) => s + p.pendingLabs, 0),
    criticalAlerts: patients.reduce((s, p) => s + p.criticalAlerts, 0),
    overdueTasks: tasks.filter(t => t.status === 'overdue').length,
    dueNowTasks: tasks.filter(t => t.status === 'due_now').length,
  }), [patients, tasks]);

  return { patients, tasks, wards, loading, stats, load };
}

// ============================================================
// VITALS — record, fetch history, NEWS2
// ============================================================
export interface VitalRecord {
  id: string; patient_id: string; admission_id: string;
  bp_systolic: number | null; bp_diastolic: number | null;
  heart_rate: number | null; temperature: number | null;
  spo2: number | null; respiratory_rate: number | null;
  gcs_score: number | null; pain_score: number | null;
  blood_sugar: number | null; urine_output: number | null;
  recorded_by: string; recorded_at: string;
  recorder?: { full_name: string };
}

export function useNursingVitals(patientId: string | null, admissionId: string | null) {
  const [history, setHistory] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_vitals')
      .select('*, recorder:hmis_staff!hmis_vitals_recorded_by_fkey(full_name)')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false }).limit(20);
    setHistory(data || []);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const record = useCallback(async (vitals: {
    bpSystolic?: number; bpDiastolic?: number; heartRate?: number;
    temperature?: number; spo2?: number; respiratoryRate?: number;
    gcsScore?: number; painScore?: number; bloodSugar?: number;
    urineOutput?: number;
  }, staffId: string) => {
    if (!patientId || !admissionId || !sb()) return null;
    const { data, error } = await sb()!.from('hmis_vitals').insert({
      patient_id: patientId, admission_id: admissionId, recorded_by: staffId,
      recorded_at: new Date().toISOString(),
      bp_systolic: vitals.bpSystolic ?? null, bp_diastolic: vitals.bpDiastolic ?? null,
      heart_rate: vitals.heartRate ?? null, temperature: vitals.temperature ?? null,
      spo2: vitals.spo2 ?? null, respiratory_rate: vitals.respiratoryRate ?? null,
      gcs_score: vitals.gcsScore ?? null, pain_score: vitals.painScore ?? null,
      blood_sugar: vitals.bloodSugar ?? null, urine_output: vitals.urineOutput ?? null,
    }).select().single();
    if (!error) load();
    return { data, error };
  }, [patientId, admissionId, load]);

  return { history, loading, load, record };
}
