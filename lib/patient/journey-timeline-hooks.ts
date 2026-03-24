// lib/patient/journey-timeline-hooks.ts
// Builds a chronological timeline of every clinical event for a patient

'use client';

import { useState, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface JourneyEvent {
  id: string;
  type: 'registration' | 'opd_visit' | 'consultation' | 'vitals' | 'lab_ordered' | 'lab_result' | 'lab_critical' |
    'radiology_ordered' | 'radiology_result' | 'prescription' | 'admission' | 'doctor_round' |
    'medication_given' | 'procedure' | 'surgery' | 'nursing_note' | 'discharge' | 'billing' | 'payment' | 'gap';
  timestamp: string;
  title: string;
  detail: string;
  severity?: 'normal' | 'warning' | 'critical';
  meta?: Record<string, any>;
  staffName?: string;
}

const TYPE_CONFIG: Record<string, { color: string; emoji: string }> = {
  registration: { color: '#22c55e', emoji: '📋' },
  opd_visit: { color: '#22c55e', emoji: '🏥' },
  consultation: { color: '#3b82f6', emoji: '🩺' },
  vitals: { color: '#8b5cf6', emoji: '💓' },
  lab_ordered: { color: '#a855f7', emoji: '🧪' },
  lab_result: { color: '#6366f1', emoji: '📊' },
  lab_critical: { color: '#ef4444', emoji: '🔴' },
  radiology_ordered: { color: '#0ea5e9', emoji: '📷' },
  radiology_result: { color: '#0891b2', emoji: '🖼️' },
  prescription: { color: '#f59e0b', emoji: '💊' },
  admission: { color: '#f59e0b', emoji: '🛏️' },
  doctor_round: { color: '#10b981', emoji: '👨‍⚕️' },
  medication_given: { color: '#06b6d4', emoji: '💉' },
  procedure: { color: '#ec4899', emoji: '⚕️' },
  surgery: { color: '#dc2626', emoji: '🔪' },
  nursing_note: { color: '#64748b', emoji: '📝' },
  discharge: { color: '#22c55e', emoji: '🚪' },
  billing: { color: '#eab308', emoji: '💳' },
  payment: { color: '#16a34a', emoji: '✅' },
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
      // Date filter: last 30 days or from admission date
      const sinceDate = admissionId
        ? undefined  // Will use admission date
        : new Date(Date.now() - 30 * 86400000).toISOString();

      // 1. OPD Visits
      const { data: opd } = await sb()!.from('hmis_opd_visits')
        .select('id, token_number, chief_complaint, status, check_in_time, consultation_start, consultation_end, doctor:hmis_staff!hmis_opd_visits_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('check_in_time', { ascending: true }).limit(20);

      for (const v of opd || []) {
        if (v.check_in_time) {
          all.push({ id: `opd-${v.id}`, type: 'opd_visit', timestamp: v.check_in_time,
            title: `OPD Visit — Token #${v.token_number}`,
            detail: v.chief_complaint || 'Walk-in', staffName: (v.doctor as any)?.full_name });
        }
        if (v.consultation_end) {
          all.push({ id: `opd-end-${v.id}`, type: 'consultation', timestamp: v.consultation_end,
            title: 'Consultation completed', detail: `${v.status}`, staffName: (v.doctor as any)?.full_name });
        }
      }

      // 2. EMR Encounters
      const { data: emrs } = await sb()!.from('hmis_emr_encounters')
        .select('id, encounter_date, status, primary_diagnosis_code, primary_diagnosis_label, prescription_count, investigation_count, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('encounter_date', { ascending: true }).limit(20);

      for (const e of emrs || []) {
        all.push({ id: `emr-${e.id}`, type: 'consultation', timestamp: e.encounter_date,
          title: `EMR: ${e.primary_diagnosis_label || 'Encounter'}`,
          detail: `${e.investigation_count || 0} investigations, ${e.prescription_count || 0} prescriptions`,
          staffName: (e.doctor as any)?.full_name });
      }

      // 3. Lab Orders + Results
      const { data: labs } = await sb()!.from('hmis_lab_orders')
        .select('id, test_name, status, created_at, results:hmis_lab_results(parameter_name, result_value, is_critical, is_abnormal), doctor:hmis_staff!hmis_lab_orders_ordered_by_fkey(full_name)')
        .eq('patient_id', patientId).order('created_at', { ascending: true }).limit(30);

      for (const lab of labs || []) {
        all.push({ id: `lab-ord-${lab.id}`, type: 'lab_ordered', timestamp: lab.created_at,
          title: `Lab ordered: ${lab.test_name}`, detail: `Status: ${lab.status}`, staffName: (lab.doctor as any)?.full_name });

        const critResults = (lab.results || []).filter((r: any) => r.is_critical);
        const abnResults = (lab.results || []).filter((r: any) => r.is_abnormal);
        if (lab.status === 'completed' && (lab.results || []).length > 0) {
          const summary = (lab.results || []).slice(0, 3).map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
          all.push({
            id: `lab-res-${lab.id}`, type: critResults.length > 0 ? 'lab_critical' : 'lab_result',
            timestamp: lab.created_at, // Use created_at + offset since result time not separate
            title: critResults.length > 0 ? `CRITICAL: ${lab.test_name}` : `Lab result: ${lab.test_name}`,
            detail: summary, severity: critResults.length > 0 ? 'critical' : abnResults.length > 0 ? 'warning' : 'normal',
          });
        }
      }

      // 4. Radiology
      const { data: rads } = await sb()!.from('hmis_radiology_orders')
        .select('id, test_name, status, created_at, findings, impression, doctor:hmis_staff!hmis_radiology_orders_ordered_by_fkey(full_name)')
        .eq('patient_id', patientId).order('created_at', { ascending: true }).limit(20);

      for (const rad of rads || []) {
        all.push({ id: `rad-${rad.id}`, type: 'radiology_ordered', timestamp: rad.created_at,
          title: `Imaging: ${rad.test_name}`, detail: rad.impression || rad.findings || `Status: ${rad.status}`,
          staffName: (rad.doctor as any)?.full_name });
      }

      // 5. Admissions
      const { data: adms } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, admission_date, discharge_date, status, provisional_diagnosis, payor_type, doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId).order('admission_date', { ascending: true }).limit(10);

      for (const adm of adms || []) {
        all.push({ id: `adm-${adm.id}`, type: 'admission', timestamp: adm.admission_date,
          title: `Admitted — IPD ${adm.ipd_number}`,
          detail: `${adm.provisional_diagnosis || ''} · ${adm.payor_type || ''}`, staffName: (adm.doctor as any)?.full_name });
        if (adm.discharge_date) {
          all.push({ id: `disch-${adm.id}`, type: 'discharge', timestamp: adm.discharge_date,
            title: `Discharged`, detail: `IPD ${adm.ipd_number} · ${adm.status}` });
        }
      }

      // 6. Doctor Rounds (if admitted)
      if (admissionId) {
        const { data: rounds } = await sb()!.from('hmis_doctor_rounds')
          .select('id, round_date, round_type, subjective, plan, doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)')
          .eq('admission_id', admissionId).order('round_date', { ascending: true }).limit(30);

        for (const r of rounds || []) {
          all.push({ id: `round-${r.id}`, type: 'doctor_round', timestamp: r.round_date,
            title: `${r.round_type || 'Round'} — ${(r.doctor as any)?.full_name || ''}`,
            detail: r.plan || r.subjective || '', staffName: (r.doctor as any)?.full_name });
        }
      }

      // 7. Bills
      const { data: bills } = await sb()!.from('hmis_bills')
        .select('id, bill_number, bill_date, net_amount, status')
        .eq('patient_id', patientId).order('bill_date', { ascending: true }).limit(10);

      for (const b of bills || []) {
        all.push({ id: `bill-${b.id}`, type: 'billing', timestamp: b.bill_date,
          title: `Bill ${b.bill_number}`, detail: `₹${Math.round(b.net_amount).toLocaleString('en-IN')} — ${b.status}` });
      }

      // Sort chronologically
      all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Detect gaps (>6 hours with no activity for admitted patients)
      let gaps = 0;
      if (admissionId && all.length > 1) {
        const withGaps: JourneyEvent[] = [];
        for (let i = 0; i < all.length; i++) {
          withGaps.push(all[i]);
          if (i < all.length - 1) {
            const gapMs = new Date(all[i + 1].timestamp).getTime() - new Date(all[i].timestamp).getTime();
            const gapHours = gapMs / 3600000;
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
    } catch (err) {
      console.error('Journey timeline error:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  return { events, loading, gapCount, load };
}
