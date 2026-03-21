// lib/alerts/alert-engine.ts
// Clinical alert generator — calls NEWS2 + vitals analysis, detects overdue meds, deterioration
// Can be called client-side (from hooks after vitals save) or server-side (from cron API)

import { calculateNEWS2, fahToCel } from '@/lib/cdss/news2';
import { analyzeVitals, type VitalAlert } from '@/lib/cdss/engine';

// ============================================================
// TYPES
// ============================================================
export interface AlertInput {
  centreId: string;
  patientId: string;
  admissionId?: string;
  patientName?: string;
}

export interface AlertRecord {
  centre_id: string;
  patient_id: string;
  admission_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  data: any;
}

// ============================================================
// 1. VITAL ALERTS — run after every vitals save
// ============================================================
export function generateVitalAlerts(
  input: AlertInput,
  vitals: {
    hr?: number; bp_sys?: number; bp_dia?: number; spo2?: number;
    temp?: number; rr?: number; gcs?: number;
    isAlert?: boolean; onO2?: boolean;
  }
): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const base = {
    centre_id: input.centreId,
    patient_id: input.patientId,
    admission_id: input.admissionId || null,
  };

  // --- NEWS2 scoring ---
  const tempC = vitals.temp ? (vitals.temp > 50 ? fahToCel(vitals.temp) : vitals.temp) : undefined;
  const news2 = calculateNEWS2({
    respiratoryRate: vitals.rr,
    spo2: vitals.spo2,
    systolic: vitals.bp_sys,
    heartRate: vitals.hr,
    temperature: tempC,
    isAlert: vitals.isAlert ?? true,
    onSupplementalO2: vitals.onO2 ?? false,
  });

  if (news2 && news2.total >= 7) {
    alerts.push({
      ...base, alert_type: 'news2_high', severity: 'emergency',
      title: `NEWS2 ${news2.total} — ${input.patientName || 'Patient'}`,
      description: news2.action,
      data: { score: news2.total, risk: news2.risk, breakdown: news2.breakdown },
    });
  } else if (news2 && news2.total >= 5) {
    alerts.push({
      ...base, alert_type: 'news2_high', severity: 'critical',
      title: `NEWS2 ${news2.total} — ${input.patientName || 'Patient'}`,
      description: news2.action,
      data: { score: news2.total, risk: news2.risk, breakdown: news2.breakdown },
    });
  }

  // --- Individual vital alerts from engine.ts ---
  const vitalAlerts = analyzeVitals({
    bp_systolic: vitals.bp_sys, bp_diastolic: vitals.bp_dia,
    pulse: vitals.hr, spo2: vitals.spo2, temperature: vitals.temp,
    resp_rate: vitals.rr, gcs: vitals.gcs,
  });

  for (const va of vitalAlerts) {
    if (va.severity === 'critical') {
      alerts.push({
        ...base, alert_type: 'vital_abnormal', severity: 'critical',
        title: `${va.parameter} Critical — ${input.patientName || 'Patient'}`,
        description: va.message,
        data: { parameter: va.parameter, value: va.value },
      });
    }
  }

  return alerts;
}

// ============================================================
// 2. LAB ALERTS — run after lab results entry
// ============================================================
const CRITICAL_RANGES: Record<string, { low?: number; high?: number; unit: string }> = {
  'potassium': { low: 2.5, high: 6.5, unit: 'mEq/L' },
  'sodium': { low: 120, high: 160, unit: 'mEq/L' },
  'glucose': { low: 40, high: 500, unit: 'mg/dL' },
  'creatinine': { high: 10, unit: 'mg/dL' },
  'hemoglobin': { low: 5, unit: 'g/dL' },
  'platelet': { low: 20000, unit: '/µL' },
  'wbc': { low: 1000, high: 50000, unit: '/µL' },
  'inr': { high: 5, unit: '' },
  'troponin': { high: 0.4, unit: 'ng/mL' },
  'lactate': { high: 4, unit: 'mmol/L' },
};

export function generateLabAlerts(
  input: AlertInput,
  results: { parameter_name: string; result_value: string | number; unit?: string; is_critical?: boolean }[]
): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const base = {
    centre_id: input.centreId,
    patient_id: input.patientId,
    admission_id: input.admissionId || null,
  };

  for (const r of results) {
    const val = typeof r.result_value === 'string' ? parseFloat(r.result_value) : r.result_value;
    if (isNaN(val)) continue;

    const paramKey = r.parameter_name.toLowerCase().replace(/[^a-z]/g, '');
    const range = Object.entries(CRITICAL_RANGES).find(([k]) => paramKey.includes(k));

    let isCritical = r.is_critical || false;
    let reason = '';

    if (range) {
      const [name, limits] = range;
      if (limits.low !== undefined && val < limits.low) {
        isCritical = true;
        reason = `${r.parameter_name} critically low: ${val} ${limits.unit} (min ${limits.low})`;
      }
      if (limits.high !== undefined && val > limits.high) {
        isCritical = true;
        reason = `${r.parameter_name} critically high: ${val} ${limits.unit} (max ${limits.high})`;
      }
    }

    if (isCritical) {
      alerts.push({
        ...base, alert_type: 'critical_lab',
        severity: 'critical',
        title: `Critical Lab — ${r.parameter_name} — ${input.patientName || 'Patient'}`,
        description: reason || `${r.parameter_name}: ${r.result_value} ${r.unit || ''} flagged as critical`,
        data: { parameter: r.parameter_name, value: val, unit: r.unit },
      });
    }
  }

  return alerts;
}

// ============================================================
// 3. OVERDUE MED ALERTS — server-side scan
// ============================================================
export async function generateOverdueMedAlerts(
  sb: any, centreId: string
): Promise<AlertRecord[]> {
  const alerts: AlertRecord[] = [];

  // Find active medication orders with scheduled times in the past that haven't been given
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const { data: overdue } = await sb
    .from('hmis_mar')
    .select('id, admission_id, scheduled_time, dose_given, status, med:hmis_ipd_medication_orders!inner(drug_name, dose, admission:hmis_admissions!inner(centre_id, patient_id, patient:hmis_patients!inner(first_name, last_name)))')
    .eq('med.admission.centre_id', centreId)
    .eq('status', 'scheduled')
    .lte('scheduled_time', twoHoursAgo)
    .limit(50);

  if (!overdue) return alerts;

  for (const m of overdue) {
    const pt = m.med?.admission?.patient;
    const patientName = pt ? `${pt.first_name} ${pt.last_name || ''}`.trim() : 'Patient';
    alerts.push({
      centre_id: centreId,
      patient_id: m.med?.admission?.patient_id,
      admission_id: m.admission_id,
      alert_type: 'overdue_med',
      severity: 'warning',
      title: `Overdue Med: ${m.med?.drug_name} — ${patientName}`,
      description: `${m.med?.drug_name} ${m.med?.dose} was due at ${new Date(m.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} but not administered`,
      data: { drug: m.med?.drug_name, dose: m.med?.dose, scheduledTime: m.scheduled_time, marId: m.id },
    });
  }

  return alerts;
}

// ============================================================
// 4. DETERIORATION DETECTION — compare last 3 vital sets
// ============================================================
export async function detectDeterioration(
  sb: any, centreId: string
): Promise<AlertRecord[]> {
  const alerts: AlertRecord[] = [];

  // Get active admissions with recent vitals
  const { data: admissions } = await sb
    .from('hmis_admissions')
    .select('id, patient_id, patient:hmis_patients!inner(first_name, last_name)')
    .eq('centre_id', centreId)
    .eq('status', 'active')
    .limit(100);

  if (!admissions) return alerts;

  for (const adm of admissions) {
    const { data: vitals } = await sb
      .from('hmis_icu_charts')
      .select('hr, bp_sys, spo2, temp, rr, recorded_at')
      .eq('admission_id', adm.id)
      .order('recorded_at', { ascending: false })
      .limit(3);

    if (!vitals || vitals.length < 3) continue;

    // Check if key vitals are trending worse across all 3 readings (most recent first)
    const [v1, v2, v3] = vitals; // v1 = latest, v3 = oldest
    let deteriorating = false;
    const reasons: string[] = [];

    // HR trending up consistently
    if (v1.hr && v2.hr && v3.hr && v1.hr > v2.hr && v2.hr > v3.hr && v1.hr > 110) {
      deteriorating = true;
      reasons.push(`HR rising: ${v3.hr} → ${v2.hr} → ${v1.hr}`);
    }

    // Systolic BP trending down consistently
    if (v1.bp_sys && v2.bp_sys && v3.bp_sys && v1.bp_sys < v2.bp_sys && v2.bp_sys < v3.bp_sys && v1.bp_sys < 100) {
      deteriorating = true;
      reasons.push(`BP falling: ${v3.bp_sys} → ${v2.bp_sys} → ${v1.bp_sys}`);
    }

    // SpO2 trending down
    if (v1.spo2 && v2.spo2 && v3.spo2 && v1.spo2 < v2.spo2 && v2.spo2 < v3.spo2 && v1.spo2 < 94) {
      deteriorating = true;
      reasons.push(`SpO2 falling: ${v3.spo2} → ${v2.spo2} → ${v1.spo2}`);
    }

    if (deteriorating) {
      const patientName = `${adm.patient?.first_name} ${adm.patient?.last_name || ''}`.trim();
      alerts.push({
        centre_id: centreId,
        patient_id: adm.patient_id,
        admission_id: adm.id,
        alert_type: 'deteriorating',
        severity: 'critical',
        title: `Deteriorating — ${patientName}`,
        description: reasons.join('; '),
        data: { vitals: vitals.map((v: any) => ({ hr: v.hr, bp_sys: v.bp_sys, spo2: v.spo2, at: v.recorded_at })) },
      });
    }
  }

  return alerts;
}

// ============================================================
// PERSIST ALERTS — write to DB, dedup by patient+type within 1 hour
// ============================================================
export async function persistAlerts(sb: any, alerts: AlertRecord[]): Promise<number> {
  if (alerts.length === 0) return 0;
  let created = 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  for (const a of alerts) {
    // Check if similar alert exists within last hour
    const { data: existing } = await sb
      .from('hmis_clinical_alerts')
      .select('id')
      .eq('patient_id', a.patient_id)
      .eq('alert_type', a.alert_type)
      .eq('status', 'active')
      .gte('created_at', oneHourAgo)
      .limit(1);

    if (existing && existing.length > 0) continue; // Skip duplicate

    await sb.from('hmis_clinical_alerts').insert(a);
    created++;
  }

  return created;
}

// ============================================================
// CLIENT-SIDE HOOK — useAlerts()
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function clientSb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export function useAlerts(centreId: string, admissionId?: string | null) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientSb() || !centreId) return;
    let query = clientSb()
      .from('hmis_clinical_alerts')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid), ack_staff:hmis_staff!hmis_clinical_alerts_acknowledged_by_fkey(full_name)')
      .eq('centre_id', centreId)
      .eq('status', 'active')
      .order('severity', { ascending: true }) // emergency first
      .order('created_at', { ascending: false });

    if (admissionId) query = query.eq('admission_id', admissionId);

    const { data } = await query.limit(50);
    setAlerts(data || []);
    setLoading(false);
  }, [centreId, admissionId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!clientSb() || !centreId) return;
    const channel = clientSb()
      .channel(`alerts-${centreId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hmis_clinical_alerts',
        filter: `centre_id=eq.${centreId}`,
      }, () => { load(); })
      .subscribe();

    return () => { clientSb().removeChannel(channel); };
  }, [centreId, load]);

  const acknowledge = useCallback(async (alertId: string, staffId: string) => {
    if (!clientSb()) return;
    await clientSb().from('hmis_clinical_alerts').update({
      status: 'acknowledged',
      acknowledged_by: staffId,
      acknowledged_at: new Date().toISOString(),
    }).eq('id', alertId);
    load();
  }, [load]);

  const resolve = useCallback(async (alertId: string, staffId: string, note?: string) => {
    if (!clientSb()) return;
    await clientSb().from('hmis_clinical_alerts').update({
      status: 'resolved',
      resolved_by: staffId,
      resolved_at: new Date().toISOString(),
      resolve_note: note || '',
    }).eq('id', alertId);
    load();
  }, [load]);

  const counts = {
    total: alerts.length,
    emergency: alerts.filter(a => a.severity === 'emergency').length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
  };

  return { alerts, loading, counts, load, acknowledge, resolve };
}
