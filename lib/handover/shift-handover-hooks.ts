// lib/handover/shift-handover-hooks.ts
// Generates structured shift handover report
// Verified against actual DB schema 24 Mar 2026

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
  admissionId?: string;
  patientId?: string;
  detail: string;
  timestamp?: string;
}

export interface HandoverReport {
  centreId: string;
  centreName: string;
  shiftType: string;
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
    const shift = SHIFTS[shiftType];
    if (!shift) return;
    setLoading(true);

    const targetDate = date || new Date().toISOString().split('T')[0];
    let shiftStart: string, shiftEnd: string;

    if (shiftType === 'night') {
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
      // 1. CRITICAL — clinical alerts (graceful if table doesn't exist)
      const critItems: HandoverItem[] = [];
      try {
        const { data: alerts } = await sb()!.from('hmis_clinical_alerts')
          .select('id, patient_id, title, description, severity, patient:hmis_patients!inner(first_name, last_name)')
          .eq('centre_id', centreId).eq('status', 'active')
          .in('severity', ['critical', 'emergency']).limit(20);
        for (const a of alerts || []) {
          const pt = a.patient as any;
          critItems.push({ patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            patientId: a.patient_id, detail: `${a.title}: ${a.description || ''}` });
          critCount++;
        }
      } catch { /* Table may not exist yet */ }

      // Also check critical labs from this shift
      const { data: critLabs } = await sb()!.from('hmis_lab_orders')
        .select('id, test_name, patient:hmis_patients!inner(first_name, last_name, id)')
        .eq('centre_id', centreId).eq('status', 'completed')
        .gte('created_at', shiftStart).lte('created_at', shiftEnd).limit(50);

      for (const lab of critLabs || []) {
        const { data: results } = await sb()!.from('hmis_lab_results')
          .select('parameter_name, result_value, is_critical')
          .eq('lab_order_id', lab.id).eq('is_critical', true).limit(5);
        if (results && results.length > 0) {
          const pt = lab.patient as any;
          const params = results.map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
          critItems.push({ patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            patientId: pt?.id, detail: `Critical lab — ${lab.test_name}: ${params}` });
          critCount++;
        }
      }

      if (critItems.length > 0) {
        sections.push({ title: 'CRITICAL — Needs Immediate Attention', severity: 'critical', emoji: '🔴', items: critItems });
      }

      // 2. NEW ADMISSIONS during shift
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
          bedLabel: (adm.bed as any)?.bed_number, admissionId: adm.id, patientId: pt?.id,
          detail: `${pt?.age_years || '?'}/${pt?.gender?.charAt(0) || '?'} · ${adm.provisional_diagnosis || 'Dx pending'} · Dr. ${dr?.full_name || 'TBD'} · ${adm.payor_type || 'Self'}`,
          timestamp: adm.admission_date,
        });
        newAdmCount++;
      }
      if (admItems.length > 0) sections.push({ title: 'NEW ADMISSIONS', severity: 'warning', emoji: '🏥', items: admItems });

      // 3. DISCHARGES during shift (actual_discharge, not discharge_date)
      const { data: discharges } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, actual_discharge, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'discharged')
        .gte('actual_discharge', shiftStart).lte('actual_discharge', shiftEnd).limit(20);

      const dischItems: HandoverItem[] = [];
      for (const d of discharges || []) {
        const pt = d.patient as any;
        dischItems.push({ patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: d.id, detail: `IPD ${d.ipd_number} · Discharged`, timestamp: d.actual_discharge });
        dischCount++;
      }
      if (dischItems.length > 0) sections.push({ title: 'DISCHARGES', severity: 'info', emoji: '🚪', items: dischItems });

      // 4. MEDICATION CHANGES — join through admission for centre (end_date, not stop_date)
      const { data: medOrders } = await sb()!.from('hmis_ipd_medication_orders')
        .select('id, drug_name, dose, route, frequency, status, start_date, end_date, admission:hmis_admissions!inner(id, centre_id, patient:hmis_patients!inner(first_name, last_name))')
        .gte('start_date', shiftStart)
        .limit(50);

      const medItems: HandoverItem[] = [];
      for (const m of medOrders || []) {
        const adm = m.admission as any;
        if (adm?.centre_id !== centreId) continue;
        const pt = adm?.patient;
        if (!pt) continue;
        const action = m.end_date && new Date(m.end_date) >= new Date(shiftStart) ? 'STOPPED' : 'STARTED';
        medItems.push({
          patientName: `${pt.first_name} ${pt.last_name}`.trim(), admissionId: adm.id,
          detail: `${action}: ${m.drug_name} ${m.dose || ''} ${m.route || ''} ${m.frequency || ''}`.trim(),
        });
        medChangeCount++;
      }
      if (medItems.length > 0) sections.push({ title: 'MEDICATION CHANGES', severity: 'info', emoji: '💊', items: medItems.slice(0, 15) });

      // 5. DOCTOR ROUNDS — join through admission for centre
      const { data: rounds } = await sb()!.from('hmis_doctor_rounds')
        .select('id, round_type, plan, round_date, admission:hmis_admissions!inner(id, centre_id, patient:hmis_patients!inner(first_name, last_name)), doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)')
        .gte('round_date', shiftStart).lte('round_date', shiftEnd)
        .order('round_date').limit(30);

      const roundItems: HandoverItem[] = [];
      for (const r of rounds || []) {
        const adm = r.admission as any;
        if (adm?.centre_id !== centreId) continue;
        const pt = adm?.patient;
        const dr = r.doctor as any;
        if (!pt || !r.plan) continue;
        roundItems.push({
          patientName: `${pt.first_name} ${pt.last_name}`.trim(), admissionId: adm.id,
          detail: `${dr?.full_name || 'Doctor'}: ${r.plan}`.slice(0, 200),
        });
      }
      if (roundItems.length > 0) sections.push({ title: 'DOCTOR ROUNDS — KEY PLANS', severity: 'normal', emoji: '👨‍⚕️', items: roundItems.slice(0, 10) });

      // 6. PENDING FOR NEXT SHIFT
      const pendingItems: HandoverItem[] = [];

      const { data: pendDisch } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'discharge_initiated').limit(10);
      for (const pd of pendDisch || []) {
        const pt = pd.patient as any;
        pendingItems.push({ patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: pd.id, detail: `Complete discharge — IPD ${pd.ipd_number}` });
        pendingCount++;
      }

      const { data: pendLabs } = await sb()!.from('hmis_lab_orders')
        .select('test_name, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).in('status', ['ordered', 'sample_collected', 'processing'])
        .gte('created_at', new Date(Date.now() - 48 * 3600000).toISOString()).limit(10);
      for (const pl of pendLabs || []) {
        const pt = pl.patient as any;
        pendingItems.push({ patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          detail: `Pending result: ${pl.test_name}` });
        pendingCount++;
      }
      if (pendingItems.length > 0) sections.push({ title: 'PENDING FOR NEXT SHIFT', severity: 'warning', emoji: '📌', items: pendingItems });

      // 7. BED SNAPSHOT
      const { data: beds } = await sb()!.from('hmis_beds')
        .select('status, room:hmis_rooms!inner(ward:hmis_wards!inner(centre_id))')
        .limit(500);
      const centreBeds = (beds || []).filter((b: any) => b.room?.ward?.centre_id === centreId);
      const occupied = centreBeds.filter((b: any) => b.status === 'occupied').length;
      const available = centreBeds.filter((b: any) => b.status === 'available').length;

      const { count: totalAdmitted } = await sb()!.from('hmis_admissions')
        .select('id', { count: 'exact', head: true })
        .eq('centre_id', centreId).eq('status', 'active');

      sections.push({ title: 'BED OCCUPANCY SNAPSHOT', severity: 'normal', emoji: '🛏️',
        items: [{ patientName: '', detail: `${occupied}/${centreBeds.length} beds occupied · ${available} available · ${totalAdmitted || 0} patients admitted` }] });

      const { data: centre } = await sb()!.from('hmis_centres').select('name').eq('id', centreId).single();

      const reportData = {
        centreId, centreName: centre?.name || 'Health1', shiftType,
        shiftStart, shiftEnd, generatedAt: new Date().toISOString(), generatedBy: staffName,
        sections,
        stats: { totalAdmitted: totalAdmitted || 0, newAdmissions: newAdmCount, discharges: dischCount,
          criticalPatients: critCount, medChanges: medChangeCount, pendingActions: pendingCount },
      };

      setReport(reportData);

      // PERSIST to DB so incoming shift can see it
      try {
        await sb()!.from('hmis_shift_handovers').insert({
          centre_id: centreId,
          shift_type: shiftType,
          shift_date: targetDate,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          generated_by_name: staffName,
          report_data: { sections },
          stats: reportData.stats,
        });
      } catch (saveErr) { console.error('Handover save error:', saveErr); }

    } catch (err) { console.error('Handover generation error:', err); }
    finally { setLoading(false); }
  }, [centreId]);

  return { report, loading, generate };
}

// ============================================================
// Load past handovers — incoming shift views what outgoing generated
// ============================================================
export function useHandoverHistory(centreId: string | null) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (days = 7) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const { data } = await sb()!.from('hmis_shift_handovers')
        .select('*')
        .eq('centre_id', centreId)
        .gte('shift_date', since)
        .order('shift_date', { ascending: false })
        .order('shift_start', { ascending: false })
        .limit(30);
      setHistory(data || []);
    } catch (err) { console.error('Handover history error:', err); }
    finally { setLoading(false); }
  }, [centreId]);

  const acknowledge = useCallback(async (handoverId: string, staffId: string, staffName: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_shift_handovers').update({
      acknowledged_by: staffId,
      acknowledged_by_name: staffName,
      acknowledged_at: new Date().toISOString(),
    }).eq('id', handoverId);
    load();
  }, [load]);

  return { history, loading, load, acknowledge };
}
