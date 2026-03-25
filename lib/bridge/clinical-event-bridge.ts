// lib/bridge/clinical-event-bridge.ts
// Central integration layer: clinical events → alerts → ticker → handover
// This file wires features that were previously siloed.
//
// WHO CALLS THIS:
//   - Vitals save (nursing-station-hooks.ts, Patient 360)
//   - MAR administer (clinical-hooks.ts)
//   - Lab result verification (lims-hooks.ts)
//
// WHO READS THE OUTPUT:
//   - Safety Ticker (reads hmis_clinical_alerts)
//   - Shift Handover (reads hmis_clinical_alerts)
//   - Patient Journey Timeline (reads hmis_clinical_alerts for critical events)

import { sb } from '@/lib/supabase/browser';
import { calculateNEWS2 } from '@/lib/cdss/news2';

// ============================================================
// BRIDGE 1: After vitals save → calculate NEWS2 → create alerts
// ============================================================
export async function onVitalsSaved(params: {
  centreId: string;
  patientId: string;
  admissionId?: string;
  vitals: {
    temperature?: number;
    pulse?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    resp_rate?: number;
    spo2?: number;
  };
  staffId: string;
}) {
  if (!sb()) return;
  const { centreId, patientId, admissionId, vitals, staffId } = params;

  try {
    // Calculate NEWS2
    const news2 = calculateNEWS2({
      respRate: vitals.resp_rate,
      spo2: vitals.spo2,
      supplementalO2: false,
      temperature: vitals.temperature,
      systolicBP: vitals.bp_systolic,
      heartRate: vitals.pulse,
      consciousness: 'alert',
    });

    if (news2 && news2.total >= 5) {
      // Dedup: check if there's already an active NEWS2 alert for this patient
      const { data: existing } = await sb()!.from('hmis_clinical_alerts')
        .select('id')
        .eq('patient_id', patientId)
        .eq('alert_type', 'news2_high')
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 4 * 3600000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await sb()!.from('hmis_clinical_alerts').insert({
          centre_id: centreId,
          patient_id: patientId,
          admission_id: admissionId || null,
          alert_type: 'news2_high',
          severity: news2.total >= 7 ? 'critical' : 'high',
          title: `NEWS2 Score: ${news2.total}`,
          description: `Risk: ${news2.risk}. HR ${vitals.pulse || '?'}, BP ${vitals.bp_systolic || '?'}/${vitals.bp_diastolic || '?'}, SpO2 ${vitals.spo2 || '?'}%, RR ${vitals.resp_rate || '?'}, Temp ${vitals.temperature || '?'}`,
          data: { news2_score: news2.total, risk: news2.risk, vitals },
          source: 'vitals',
          auto_resolve_at: new Date(Date.now() + 4 * 3600000).toISOString(), // Auto-resolve after 4h
        });
      }
    }

    // Check for individual vital abnormalities
    const abnormals: string[] = [];
    if (vitals.bp_systolic && vitals.bp_systolic < 90) abnormals.push(`Hypotension: SBP ${vitals.bp_systolic}`);
    if (vitals.bp_systolic && vitals.bp_systolic > 180) abnormals.push(`Hypertensive crisis: SBP ${vitals.bp_systolic}`);
    if (vitals.spo2 && vitals.spo2 < 92) abnormals.push(`Desaturation: SpO2 ${vitals.spo2}%`);
    if (vitals.pulse && vitals.pulse > 130) abnormals.push(`Tachycardia: HR ${vitals.pulse}`);
    if (vitals.pulse && vitals.pulse < 40) abnormals.push(`Bradycardia: HR ${vitals.pulse}`);
    if (vitals.temperature && vitals.temperature > 39.5) abnormals.push(`High fever: ${vitals.temperature}°C`);

    if (abnormals.length > 0) {
      await sb()!.from('hmis_clinical_alerts').insert({
        centre_id: centreId,
        patient_id: patientId,
        admission_id: admissionId || null,
        alert_type: 'vital_abnormal',
        severity: 'high',
        title: `Vital abnormality detected`,
        description: abnormals.join('. '),
        data: { vitals, abnormals },
        source: 'vitals',
        auto_resolve_at: new Date(Date.now() + 2 * 3600000).toISOString(),
      });
    }
  } catch (err) {
    console.error('onVitalsSaved bridge error:', err);
  }
}

// ============================================================
// BRIDGE 2: After MAR administer → resolve overdue_med alert
// ============================================================
export async function onMedicationAdministered(params: {
  centreId: string;
  patientId: string;
  admissionId: string;
  marId: string;
  drugName: string;
  staffId: string;
}) {
  if (!sb()) return;
  const { centreId, patientId, admissionId } = params;

  try {
    // Resolve any active overdue_med alerts for this patient
    await sb()!.from('hmis_clinical_alerts')
      .update({
        status: 'resolved',
        resolved_by: params.staffId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('patient_id', patientId)
      .eq('alert_type', 'overdue_med')
      .eq('status', 'active')
      .eq('admission_id', admissionId);
  } catch (err) {
    console.error('onMedicationAdministered bridge error:', err);
  }
}

// ============================================================
// BRIDGE 3: After lab result verification → create critical alert
// (Supplements existing onLabCriticalResult in module-events.ts)
// ============================================================
export async function onLabResultCritical(params: {
  centreId: string;
  patientId: string;
  admissionId?: string;
  labOrderId: string;
  testName: string;
  criticalParams: Array<{ name: string; value: string }>;
}) {
  if (!sb()) return;

  try {
    const paramsSummary = params.criticalParams.map(p => `${p.name}: ${p.value}`).join(', ');

    // Dedup
    const { data: existing } = await sb()!.from('hmis_clinical_alerts')
      .select('id')
      .eq('source_ref_id', params.labOrderId)
      .eq('alert_type', 'lab_critical')
      .limit(1);

    if (!existing || existing.length === 0) {
      await sb()!.from('hmis_clinical_alerts').insert({
        centre_id: params.centreId,
        patient_id: params.patientId,
        admission_id: params.admissionId || null,
        alert_type: 'lab_critical',
        severity: 'critical',
        title: `Critical Lab: ${params.testName}`,
        description: paramsSummary,
        data: { labOrderId: params.labOrderId, criticalParams: params.criticalParams },
        source: 'lab',
        source_ref_id: params.labOrderId,
        source_ref_type: 'lab_order',
      });
    }
  } catch (err) {
    console.error('onLabResultCritical bridge error:', err);
  }
}

// ============================================================
// BRIDGE 4: Acknowledge an alert from the Safety Ticker
// ============================================================
export async function acknowledgeAlert(alertId: string, staffId: string) {
  if (!sb()) return { success: false };
  try {
    await sb()!.from('hmis_clinical_alerts').update({
      status: 'acknowledged',
      acknowledged_by: staffId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', alertId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as any).message };
  }
}

// ============================================================
// BRIDGE 5: Resolve an alert
// ============================================================
export async function resolveAlert(alertId: string, staffId: string) {
  if (!sb()) return { success: false };
  try {
    await sb()!.from('hmis_clinical_alerts').update({
      status: 'resolved',
      resolved_by: staffId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', alertId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as any).message };
  }
}
