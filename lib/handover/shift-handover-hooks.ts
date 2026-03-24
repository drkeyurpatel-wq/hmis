// lib/handover/shift-handover-hooks.ts
// Generates structured shift handover report by scanning all clinical activity

'use client';

import { useState, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface HandoverSection {
  title: string;
  severity: 'critical' | 'warning' | 'info' | 'normal';
  emoji: string;
  items: HandoverItem[];
}

export interface HandoverItem {
  patientName: string;
  bedLabel?: string;
  wardName?: string;
  admissionId?: string;
  patientId?: string;
  detail: string;
  timestamp?: string;
}

export interface HandoverReport {
  centreId: string;
  centreName: string;
  shiftType: string; // 'morning' | 'evening' | 'night'
  shiftStart: string;
  shiftEnd: string;
  generatedAt: string;
  generatedBy: string;
  sections: HandoverSection[];
  stats: {
    totalAdmitted: number;
    newAdmissions: number;
    discharges: number;
    criticalPatients: number;
    medChanges: number;
    pendingActions: number;
  };
}

const SHIFTS: Record<string, { label: string; startHour: number; endHour: number }> = {
  morning: { label: 'Morning (8 AM – 2 PM)', startHour: 8, endHour: 14 },
  evening: { label: 'Evening (2 PM – 8 PM)', startHour: 14, endHour: 20 },
  night: { label: 'Night (8 PM – 8 AM)', startHour: 20, endHour: 8 },
};

export { SHIFTS };

export function useShiftHandover(centreId: string | null) {
  const [report, setReport] = useState<HandoverReport | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (shiftType: string, staffName: string, date?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    const shift = SHIFTS[shiftType];
    if (!shift) { setLoading(false); return; }

    const targetDate = date || new Date().toISOString().split('T')[0];
    let shiftStart: string, shiftEnd: string;

    if (shiftType === 'night') {
      // Night shift spans two days
      shiftStart = `${targetDate}T${shift.startHour.toString().padStart(2, '0')}:00:00`;
      const nextDay = new Date(new Date(targetDate).getTime() + 86400000).toISOString().split('T')[0];
      shiftEnd = `${nextDay}T${shift.endHour.toString().padStart(2, '0')}:00:00`;
    } else {
      shiftStart = `${targetDate}T${shift.startHour.toString().padStart(2, '0')}:00:00`;
      shiftEnd = `${targetDate}T${shift.endHour.toString().padStart(2, '0')}:00:00`;
    }

    const sections: HandoverSection[] = [];
    let newAdmCount = 0, dischCount = 0, critCount = 0, medChangeCount = 0, pendingCount = 0;

    try {
      // ============================================================
      // 1. CRITICAL PATIENTS — active clinical alerts
      // ============================================================
      const { data: alerts } = await sb()!.from('hmis_clinical_alerts')
        .select('id, patient_id, title, description, severity, patient:hmis_patients!inner(first_name, last_name), admission:hmis_admissions(id)')
        .eq('centre_id', centreId).eq('status', 'active')
        .in('severity', ['critical', 'emergency']).limit(20);

      const critItems: HandoverItem[] = [];
      for (const a of alerts || []) {
        const pt = a.patient as any;
        critItems.push({
          patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: (a.admission as any)?.id,
          patientId: a.patient_id,
          detail: `${a.title}: ${a.description}`,
        });
        critCount++;
      }

      // Also check critical lab results from this shift
      const { data: critLabs } = await sb()!.from('hmis_lab_orders')
        .select('id, test_name, patient:hmis_patients!inner(first_name, last_name, id), results:hmis_lab_results(parameter_name, result_value, is_critical)')
        .eq('centre_id', centreId).eq('status', 'completed')
        .gte('created_at', shiftStart).lte('created_at', shiftEnd).limit(50);

      for (const lab of critLabs || []) {
        const crits = (lab.results || []).filter((r: any) => r.is_critical);
        if (crits.length > 0) {
          const pt = lab.patient as any;
          const params = crits.map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
          critItems.push({
            patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            patientId: pt?.id,
            detail: `Critical lab — ${lab.test_name}: ${params}`,
          });
          critCount++;
        }
      }

      if (critItems.length > 0) {
        sections.push({ title: 'CRITICAL — Needs Immediate Attention', severity: 'critical', emoji: '🔴', items: critItems });
      }

      // ============================================================
      // 2. NEW ADMISSIONS during shift
      // ============================================================
      const { data: newAdmissions } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, admission_date, provisional_diagnosis, payor_type, patient:hmis_patients!inner(first_name, last_name, age_years, gender), bed:hmis_beds(bed_number), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
        .eq('centre_id', centreId)
        .gte('admission_date', shiftStart).lte('admission_date', shiftEnd)
        .order('admission_date').limit(20);

      const admItems: HandoverItem[] = [];
      for (const adm of newAdmissions || []) {
        const pt = adm.patient as any;
        const dr = adm.doctor as any;
        admItems.push({
          patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          bedLabel: (adm.bed as any)?.bed_number,
          admissionId: adm.id,
          patientId: pt?.id,
          detail: `${pt?.age_years || '?'}/${pt?.gender?.charAt(0) || '?'} · ${adm.provisional_diagnosis || 'Diagnosis pending'} · Dr. ${dr?.full_name || 'TBD'} · ${adm.payor_type || 'Self'}`,
          timestamp: adm.admission_date,
        });
        newAdmCount++;
      }

      if (admItems.length > 0) {
        sections.push({ title: 'NEW ADMISSIONS', severity: 'warning', emoji: '🏥', items: admItems });
      }

      // ============================================================
      // 3. DISCHARGES during shift
      // ============================================================
      const { data: discharges } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, discharge_date, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'discharged')
        .gte('discharge_date', shiftStart).lte('discharge_date', shiftEnd).limit(20);

      const dischItems: HandoverItem[] = [];
      for (const d of discharges || []) {
        const pt = d.patient as any;
        dischItems.push({
          patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: d.id,
          detail: `IPD ${d.ipd_number} · Discharged`,
          timestamp: d.discharge_date,
        });
        dischCount++;
      }

      if (dischItems.length > 0) {
        sections.push({ title: 'DISCHARGES', severity: 'info', emoji: '🚪', items: dischItems });
      }

      // ============================================================
      // 4. MEDICATION CHANGES (new orders, stopped meds)
      // ============================================================
      const { data: medOrders } = await sb()!.from('hmis_ipd_medication_orders')
        .select('id, drug_name, dose, route, frequency, status, start_date, stop_date, admission:hmis_admissions!inner(id, patient:hmis_patients!inner(first_name, last_name))')
        .eq('centre_id', centreId)
        .or(`start_date.gte.${shiftStart},stop_date.gte.${shiftStart}`)
        .limit(50);

      const medItems: HandoverItem[] = [];
      for (const m of medOrders || []) {
        const pt = (m.admission as any)?.patient;
        if (!pt) continue;
        const action = m.stop_date && new Date(m.stop_date) >= new Date(shiftStart) ? 'STOPPED' : 'STARTED';
        medItems.push({
          patientName: `${pt.first_name} ${pt.last_name}`.trim(),
          admissionId: (m.admission as any)?.id,
          detail: `${action}: ${m.drug_name} ${m.dose || ''} ${m.route || ''} ${m.frequency || ''}`.trim(),
        });
        medChangeCount++;
      }

      if (medItems.length > 0) {
        sections.push({ title: 'MEDICATION CHANGES', severity: 'info', emoji: '💊', items: medItems.slice(0, 15) });
      }

      // ============================================================
      // 5. DOCTOR ROUNDS during shift
      // ============================================================
      const { data: rounds } = await sb()!.from('hmis_doctor_rounds')
        .select('id, round_type, plan, admission:hmis_admissions!inner(id, patient:hmis_patients!inner(first_name, last_name)), doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)')
        .eq('centre_id', centreId)
        .gte('round_date', shiftStart).lte('round_date', shiftEnd)
        .order('round_date').limit(30);

      const roundItems: HandoverItem[] = [];
      for (const r of rounds || []) {
        const pt = (r.admission as any)?.patient;
        const dr = r.doctor as any;
        if (!pt) continue;
        if (r.plan) {
          roundItems.push({
            patientName: `${pt.first_name} ${pt.last_name}`.trim(),
            admissionId: (r.admission as any)?.id,
            detail: `${dr?.full_name || 'Doctor'}: ${r.plan}`.slice(0, 200),
          });
        }
      }

      if (roundItems.length > 0) {
        sections.push({ title: 'DOCTOR ROUNDS — KEY PLANS', severity: 'normal', emoji: '👨‍⚕️', items: roundItems.slice(0, 10) });
      }

      // ============================================================
      // 6. PENDING ACTIONS for next shift
      // ============================================================
      const pendingItems: HandoverItem[] = [];

      // Pending discharges
      const { data: pendDisch } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'discharge_initiated').limit(10);

      for (const pd of pendDisch || []) {
        const pt = pd.patient as any;
        pendingItems.push({
          patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: pd.id,
          detail: `Complete discharge — IPD ${pd.ipd_number}`,
        });
        pendingCount++;
      }

      // Pending lab results
      const { data: pendLabs } = await sb()!.from('hmis_lab_orders')
        .select('test_name, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).in('status', ['ordered', 'sample_collected', 'processing'])
        .gte('created_at', new Date(Date.now() - 48 * 3600000).toISOString()).limit(10);

      for (const pl of pendLabs || []) {
        const pt = pl.patient as any;
        pendingItems.push({
          patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          detail: `Pending result: ${pl.test_name}`,
        });
        pendingCount++;
      }

      if (pendingItems.length > 0) {
        sections.push({ title: 'PENDING FOR NEXT SHIFT', severity: 'warning', emoji: '📌', items: pendingItems });
      }

      // ============================================================
      // 7. BED OCCUPANCY SNAPSHOT
      // ============================================================
      const { data: beds } = await sb()!.from('hmis_beds')
        .select('status').eq('centre_id', centreId);

      const totalBeds = beds?.length || 0;
      const occupied = beds?.filter((b: any) => b.status === 'occupied').length || 0;
      const available = beds?.filter((b: any) => b.status === 'available').length || 0;

      // Get total admitted count
      const { count: totalAdmitted } = await sb()!.from('hmis_admissions')
        .select('id', { count: 'exact', head: true })
        .eq('centre_id', centreId).eq('status', 'active');

      sections.push({
        title: 'BED OCCUPANCY SNAPSHOT', severity: 'normal', emoji: '🛏️',
        items: [{ patientName: '', detail: `${occupied}/${totalBeds} beds occupied · ${available} available · ${totalAdmitted || 0} patients admitted` }]
      });

      // Get centre name
      const { data: centre } = await sb()!.from('hmis_centres').select('name').eq('id', centreId).single();

      setReport({
        centreId,
        centreName: centre?.name || 'Health1',
        shiftType,
        shiftStart,
        shiftEnd,
        generatedAt: new Date().toISOString(),
        generatedBy: staffName,
        sections,
        stats: {
          totalAdmitted: totalAdmitted || 0,
          newAdmissions: newAdmCount,
          discharges: dischCount,
          criticalPatients: critCount,
          medChanges: medChangeCount,
          pendingActions: pendingCount,
        },
      });
    } catch (err) {
      console.error('Handover generation error:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  return { report, loading, generate };
}
