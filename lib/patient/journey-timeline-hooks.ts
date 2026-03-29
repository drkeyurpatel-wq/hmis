// lib/patient/journey-timeline-hooks.ts
// Builds chronological timeline of every clinical event for a patient
// Verified against actual DB schema 24 Mar 2026

'use client';

import { useState, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface JourneyEvent {
  id: string;
  type: 'registration' | 'opd_visit' | 'consultation' | 'lab_ordered' | 'lab_result' | 'lab_critical' |
    'radiology_ordered' | 'admission' | 'doctor_round' | 'vitals' | 'medication_given' | 'nursing_note' | 'discharge' | 'billing' | 'gap';
  timestamp: string;
  title: string;
  detail: string;
  severity?: 'normal' | 'warning' | 'critical';
  staffName?: string;
}

const TYPE_CONFIG: Record<string, { color: string; emoji: string }> = {
  registration: { color: '#22c55e', emoji: '📋' },
  opd_visit: { color: '#22c55e', emoji: '🏥' },
  consultation: { color: '#3b82f6', emoji: '🩺' },
  lab_ordered: { color: '#a855f7', emoji: '🧪' },
  lab_result: { color: '#6366f1', emoji: '📊' },
  lab_critical: { color: '#ef4444', emoji: '🔴' },
  radiology_ordered: { color: '#0ea5e9', emoji: '📷' },
  admission: { color: '#f59e0b', emoji: '🛏️' },
  doctor_round: { color: '#10b981', emoji: '👨‍⚕️' },
  vitals: { color: '#8b5cf6', emoji: '💓' },
  medication_given: { color: '#06b6d4', emoji: '💉' },
  nursing_note: { color: '#64748b', emoji: '📝' },
  discharge: { color: '#22c55e', emoji: '🚪' },
  billing: { color: '#eab308', emoji: '💳' },
  gap: { color: '#f59e0b', emoji: '⚠️' },
};

export { TYPE_CONFIG as JOURNEY_TYPE_CONFIG };

export function usePatientJourney(patientId: string | null) {
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [gapCount, setGapCount] = useState(0);

  const load = useCallback(async (admissionId?: string) => {
    if (!patientId || !sb()) return;
    setLoading(true);
    const all: JourneyEvent[] = [];

    try {
      // 1. OPD Visits
      const { data: opd } = await sb()!.from('hmis_opd_visits')
        .select('id, token_number, chief_complaint, status, check_in_time, consultation_end, doctor:hmis_staff!hmis_opd_visits_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('check_in_time', { ascending: true }).limit(20);

      for (const v of opd || []) {
        if (v.check_in_time) {
          all.push({ id: `opd-${v.id}`, type: 'opd_visit', timestamp: v.check_in_time,
            title: `OPD Visit — Token #${v.token_number}`,
            detail: v.chief_complaint || 'Walk-in', staffName: (v.doctor as any)?.full_name });
        }
      }

      // 2. EMR Encounters — diagnosis comes from JSONB, not separate column
      const { data: emrs } = await sb()!.from('hmis_emr_encounters')
        .select('id, encounter_date, status, primary_diagnosis_label, prescription_count, investigation_count, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('encounter_date', { ascending: true }).limit(20);

      for (const e of emrs || []) {
        all.push({ id: `emr-${e.id}`, type: 'consultation', timestamp: e.encounter_date,
          title: `EMR: ${e.primary_diagnosis_label || 'Encounter'}`,
          detail: `${e.investigation_count || 0} investigations, ${e.prescription_count || 0} prescriptions`,
          staffName: (e.doctor as any)?.full_name });
      }

      // 3. Lab Orders + Results
      const { data: labs } = await sb()!.from('hmis_lab_orders')
        .select('id, test_name, status, created_at, reported_at, doctor:hmis_staff!hmis_lab_orders_ordered_by_fkey(full_name)')
        .eq('patient_id', patientId).order('created_at', { ascending: true }).limit(30);

      for (const lab of (labs || []) as any[]) {
        all.push({ id: `lab-ord-${lab.id}`, type: 'lab_ordered', timestamp: lab.created_at,
          title: `Lab ordered: ${lab.test_name}`, detail: `Status: ${lab.status}`,
          staffName: (lab.doctor as any)?.full_name });

        if (lab.status === 'completed') {
          // Check for critical results
          const { data: results } = await sb()!.from('hmis_lab_results')
            .select('parameter_name, result_value, is_critical, is_abnormal')
            .eq('lab_order_id', lab.id).limit(10);

          const crits = (results || []).filter((r: any) => r.is_critical);
          const abns = (results || []).filter((r: any) => r.is_abnormal);
          if ((results || []).length > 0) {
            const summary = (results || []).slice(0, 3).map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
            all.push({
              id: `lab-res-${lab.id}`, type: crits.length > 0 ? 'lab_critical' : 'lab_result',
              timestamp: lab.reported_at || lab.created_at,
              title: crits.length > 0 ? `CRITICAL: ${lab.test_name}` : `Lab result: ${lab.test_name}`,
              detail: summary, severity: crits.length > 0 ? 'critical' : abns.length > 0 ? 'warning' : 'normal',
            });
          }
        }
      }

      // 4. Radiology Orders (no findings/impression on order — just status)
      const { data: rads } = await sb()!.from('hmis_radiology_orders')
        .select('id, test_name, status, modality, body_part, created_at, doctor:hmis_staff!hmis_radiology_orders_ordered_by_fkey(full_name)')
        .eq('patient_id', patientId).order('created_at', { ascending: true }).limit(20);

      for (const rad of rads || []) {
        all.push({ id: `rad-${rad.id}`, type: 'radiology_ordered', timestamp: rad.created_at,
          title: `Imaging: ${rad.test_name || `${rad.modality} ${rad.body_part}`}`,
          detail: `Status: ${rad.status}`, staffName: (rad.doctor as any)?.full_name });
      }

      // 5. Admissions (discharge_date is actual_discharge in schema)
      const { data: adms } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, admission_date, actual_discharge, status, provisional_diagnosis, payor_type, doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('admission_date', { ascending: true }).limit(10);

      for (const adm of adms || []) {
        all.push({ id: `adm-${adm.id}`, type: 'admission', timestamp: adm.admission_date,
          title: `Admitted — IPD ${adm.ipd_number}`,
          detail: `${adm.provisional_diagnosis || ''} · ${adm.payor_type || ''}`,
          staffName: (adm.doctor as any)?.full_name });
        if (adm.actual_discharge) {
          all.push({ id: `disch-${adm.id}`, type: 'discharge', timestamp: adm.actual_discharge,
            title: `Discharged`, detail: `IPD ${adm.ipd_number} · ${adm.status}` });
        }
      }

      // 6. Doctor Rounds (join through admission — no centre_id on rounds)
      if (admissionId) {
        const { data: rounds } = await sb()!.from('hmis_doctor_rounds')
          .select('id, round_date, round_type, plan, doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)')
          .eq('admission_id', admissionId).order('round_date', { ascending: true }).limit(30);

        for (const r of rounds || []) {
          all.push({ id: `round-${r.id}`, type: 'doctor_round', timestamp: r.round_date,
            title: `${r.round_type || 'Round'} — ${(r.doctor as any)?.full_name || ''}`,
            detail: r.plan || '', staffName: (r.doctor as any)?.full_name });
        }
      }

      // 7. Vitals (for admitted patients — significant clinical data)
      if (admissionId) {
        const { data: vitals } = await sb()!.from('hmis_vitals')
          .select('id, recorded_at, pulse, bp_systolic, bp_diastolic, temperature, spo2, resp_rate, recorder:hmis_staff!hmis_vitals_recorded_by_fkey(full_name)')
          .eq('patient_id', patientId)
          .order('recorded_at', { ascending: true }).limit(50);

        for (const v of vitals || []) {
          const parts: string[] = [];
          if (v.pulse) parts.push(`HR ${v.pulse}`);
          if (v.bp_systolic) parts.push(`BP ${v.bp_systolic}/${v.bp_diastolic || '?'}`);
          if (v.spo2) parts.push(`SpO2 ${v.spo2}%`);
          if (v.temperature) parts.push(`Temp ${v.temperature}`);
          if (v.resp_rate) parts.push(`RR ${v.resp_rate}`);

          const isAbnormal = (v.bp_systolic && (v.bp_systolic < 90 || v.bp_systolic > 180)) ||
            (v.spo2 && v.spo2 < 92) || (v.pulse && (v.pulse > 130 || v.pulse < 40));

          all.push({ id: `vital-${v.id}`, type: 'vitals', timestamp: v.recorded_at,
            title: isAbnormal ? '⚠️ Vitals — Abnormal' : 'Vitals recorded',
            detail: parts.join(' · ') || 'No values',
            severity: isAbnormal ? 'warning' : 'normal',
            staffName: (v.recorder as any)?.full_name });
        }
      }

      // 8. MAR — medications actually given
      if (admissionId) {
        const { data: marRecords } = await sb()!.from('hmis_mar')
          .select('id, scheduled_time, administered_time, status, dose_given, medication_order:hmis_ipd_medication_orders!inner(drug_name, dose, route), nurse:hmis_staff!hmis_mar_administered_by_fkey(full_name)')
          .eq('admission_id', admissionId)
          .eq('status', 'given')
          .order('administered_time', { ascending: true }).limit(50);

        for (const m of marRecords || []) {
          const med = m.medication_order as any;
          all.push({ id: `mar-${m.id}`, type: 'medication_given',
            timestamp: m.administered_time || m.scheduled_time,
            title: `Med given: ${med?.drug_name || 'Unknown'}`,
            detail: `${med?.dose || ''} ${med?.route || ''} · Dose: ${m.dose_given || med?.dose || '?'}`,
            staffName: (m.nurse as any)?.full_name });
        }
      }

      // 9. Nursing Notes
      if (admissionId) {
        const { data: notes } = await sb()!.from('hmis_nursing_notes')
          .select('id, note, shift, created_at, nurse:hmis_staff!hmis_nursing_notes_nurse_id_fkey(full_name)')
          .eq('admission_id', admissionId)
          .order('created_at', { ascending: true }).limit(30);

        for (const n of notes || []) {
          all.push({ id: `note-${n.id}`, type: 'nursing_note', timestamp: n.created_at,
            title: `Nursing note (${n.shift || 'shift'})`,
            detail: (n.note || '').slice(0, 200),
            staffName: (n.nurse as any)?.full_name });
        }
      }

      // 10. Bills
      const { data: bills } = await sb()!.from('hmis_bills')
        .select('id, bill_number, bill_date, net_amount, status, created_at')
        .eq('patient_id', patientId).order('bill_date', { ascending: true }).limit(10);

      for (const b of (bills || []) as any[]) {
        all.push({ id: `bill-${b.id}`, type: 'billing', timestamp: b.bill_date || b.created_at,
          title: `Bill ${b.bill_number}`,
          detail: `₹${Math.round(b.net_amount).toLocaleString('en-IN')} — ${b.status}` });
      }

      // Sort chronologically
      all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Detect gaps (>6 hours for admitted patients)
      let gaps = 0;
      if (admissionId && all.length > 1) {
        const withGaps: JourneyEvent[] = [];
        for (let i = 0; i < all.length; i++) {
          withGaps.push(all[i]);
          if (i < all.length - 1) {
            const gapHours = (new Date(all[i + 1].timestamp).getTime() - new Date(all[i].timestamp).getTime()) / 3600000;
            if (gapHours > 6) {
              gaps++;
              withGaps.push({
                id: `gap-${i}`, type: 'gap', timestamp: all[i].timestamp,
                title: `${Math.round(gapHours)}-hour gap — no recorded activity`,
                detail: 'Expected: vitals, nursing notes, medication administration',
                severity: gapHours > 12 ? 'critical' : 'warning',
              });
            }
          }
        }
        setEvents(withGaps);
      } else {
        setEvents(all);
      }
      setGapCount(gaps);
    } catch (err) { console.error('Journey timeline error:', err); }
    finally { setLoading(false); }
  }, [patientId]);

  return { events, loading, gapCount, load };
}
