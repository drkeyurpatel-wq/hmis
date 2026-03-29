// lib/quality/quality-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// INCIDENT REPORTING
// ============================================================
export function useIncidentReporting(centreId: string | null) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; category?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_incidents')
      .select('*, reporter:hmis_staff!hmis_incidents_reported_by_fkey(full_name), investigator:hmis_staff!hmis_incidents_assigned_to_fkey(full_name), patient:hmis_patients(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.category && filters.category !== 'all') q = q.eq('category', filters.category);
    const { data } = await q;
    setIncidents(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const reportIncident = useCallback(async (data: {
    category: string; severity: string; description: string; location: string;
    patientId?: string; involvedStaff?: string;
    immediateAction?: string; reportedBy: string;
  }): Promise<{ success: boolean; error?: string; incidentNumber?: string }> => {
    if (!centreId || !sb()) return { success: false };
    const incidentNumber = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const { error } = await sb()!.from('hmis_incidents').insert({
      centre_id: centreId, incident_number: incidentNumber,
      category: data.category, severity: data.severity,
      description: data.description, location: data.location,
      patient_id: data.patientId || null, involved_staff: data.involvedStaff || null,
      immediate_action: data.immediateAction || null,
      reported_by: data.reportedBy, status: 'reported',
    });
    if (error) return { success: false, error: error.message };
    load();
    return { success: true, incidentNumber };
  }, [centreId, load]);

  const updateIncident = useCallback(async (id: string, updates: any) => {
    await sb()!.from('hmis_incidents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter((i: any) => ['reported', 'investigating'].includes(i.status)).length,
    critical: incidents.filter((i: any) => i.severity === 'sentinel' || i.severity === 'serious').length,
    bySeverity: incidents.reduce((acc: Record<string, number>, i: any) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {}),
    byCategory: incidents.reduce((acc: Record<string, number>, i: any) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {}),
  }), [incidents]);

  return { incidents, loading, stats, load, reportIncident, updateIncident };
}

// ============================================================
// QUALITY INDICATORS (NABH KPIs)
// ============================================================
export const NABH_INDICATORS = [
  { code: 'QI-01', name: 'Hand Hygiene Compliance', target: 85, unit: '%', frequency: 'monthly', category: 'infection_control' },
  { code: 'QI-02', name: 'Surgical Site Infection Rate', target: 2, unit: '%', frequency: 'monthly', category: 'infection_control' },
  { code: 'QI-03', name: 'Catheter-Associated UTI Rate', target: 3, unit: '/1000 catheter days', frequency: 'monthly', category: 'infection_control' },
  { code: 'QI-04', name: 'Ventilator-Associated Pneumonia Rate', target: 5, unit: '/1000 ventilator days', frequency: 'monthly', category: 'infection_control' },
  { code: 'QI-05', name: 'Blood Stream Infection Rate (CLABSI)', target: 2, unit: '/1000 central line days', frequency: 'monthly', category: 'infection_control' },
  { code: 'QI-06', name: 'Patient Fall Rate', target: 1, unit: '/1000 patient days', frequency: 'monthly', category: 'patient_safety' },
  { code: 'QI-07', name: 'Medication Error Rate', target: 0.5, unit: '%', frequency: 'monthly', category: 'patient_safety' },
  { code: 'QI-08', name: 'Adverse Drug Reaction Reporting', target: 100, unit: '%', frequency: 'monthly', category: 'patient_safety' },
  { code: 'QI-09', name: 'Unplanned Return to OT', target: 1, unit: '%', frequency: 'monthly', category: 'clinical' },
  { code: 'QI-10', name: 'Unplanned ICU Readmission', target: 2, unit: '%', frequency: 'monthly', category: 'clinical' },
  { code: 'QI-11', name: 'Hospital Mortality Rate', target: 2, unit: '%', frequency: 'monthly', category: 'clinical' },
  { code: 'QI-12', name: 'Average Length of Stay', target: 5, unit: 'days', frequency: 'monthly', category: 'operational' },
  { code: 'QI-13', name: 'Bed Occupancy Rate', target: 80, unit: '%', frequency: 'monthly', category: 'operational' },
  { code: 'QI-14', name: 'OPD Wait Time', target: 30, unit: 'minutes', frequency: 'monthly', category: 'operational' },
  { code: 'QI-15', name: 'Discharge TAT (order to leave)', target: 4, unit: 'hours', frequency: 'monthly', category: 'operational' },
  { code: 'QI-16', name: 'Lab TAT (Critical Values)', target: 60, unit: 'minutes', frequency: 'monthly', category: 'diagnostics' },
  { code: 'QI-17', name: 'Radiology Report TAT', target: 120, unit: 'minutes', frequency: 'monthly', category: 'diagnostics' },
  { code: 'QI-18', name: 'Blood Transfusion Reaction Rate', target: 0.5, unit: '%', frequency: 'monthly', category: 'patient_safety' },
  { code: 'QI-19', name: 'Consent Compliance', target: 100, unit: '%', frequency: 'monthly', category: 'patient_safety' },
  { code: 'QI-20', name: 'Patient Satisfaction Score', target: 85, unit: '%', frequency: 'quarterly', category: 'patient_experience' },
];

export function useQualityIndicators(centreId: string | null) {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb()!.from('hmis_quality_indicators')
      .select('*').eq('centre_id', centreId)
      .order('period', { ascending: false }).limit(200)
      .then(({ data }: any) => setEntries(data || []));
  }, [centreId]);

  const submitEntry = useCallback(async (indicatorCode: string, period: string, value: number, numerator?: number, denominator?: number, staffId?: string) => {
    if (!centreId || !sb()) return;
    const indicator = NABH_INDICATORS.find(i => i.code === indicatorCode);
    await sb()!.from('hmis_quality_indicators').insert({
      centre_id: centreId, indicator_code: indicatorCode, indicator_name: indicator?.name || indicatorCode,
      period, value, numerator, denominator, target: indicator?.target,
      met_target: indicator ? value <= indicator.target : null, submitted_by: staffId,
    });
  }, [centreId]);

  return { entries, submitEntry, indicators: NABH_INDICATORS };
}

// ============================================================
// AUTO-CALCULATE KPIs from live hospital data
// ============================================================
export function useAutoCalcKPIs(centreId: string | null) {
  const [kpis, setKpis] = useState<Record<string, { value: number; numerator: number; denominator: number; autoCalc: true }>>({});
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async (period?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const now = new Date();
    const monthStart = period ? `${period}-01` : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = period ? `${period}-31` : now.toISOString().split('T')[0];
    const result: typeof kpis = {};

    // QI-11: Hospital Mortality Rate
    const { count: totalDischarges } = await sb()!.from('hmis_admissions').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('status', 'discharged').gte('discharge_date', monthStart).lte('discharge_date', monthEnd);
    const { count: deaths } = await sb()!.from('hmis_admissions').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('discharge_type', 'death').gte('discharge_date', monthStart).lte('discharge_date', monthEnd);
    const denom11 = totalDischarges || 0;
    const num11 = deaths || 0;
    result['QI-11'] = { value: denom11 > 0 ? Math.round((num11 / denom11) * 10000) / 100 : 0, numerator: num11, denominator: denom11, autoCalc: true };

    // QI-12: Average Length of Stay
    const { data: admissions } = await sb()!.from('hmis_admissions')
      .select('admission_date, discharge_date')
      .eq('centre_id', centreId).eq('status', 'discharged').gte('discharge_date', monthStart).lte('discharge_date', monthEnd).not('discharge_date', 'is', null);
    const losArr = (admissions || []).map((a: any) => {
      const diff = new Date(a.discharge_date).getTime() - new Date(a.admission_date).getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    });
    const avgLOS = losArr.length > 0 ? Math.round((losArr.reduce((s: number, d: number) => s + d, 0) / losArr.length) * 100) / 100 : 0;
    result['QI-12'] = { value: avgLOS, numerator: losArr.reduce((s: number, d: number) => s + d, 0), denominator: losArr.length, autoCalc: true };

    // QI-13: Bed Occupancy Rate
    const { count: totalBeds } = await sb()!.from('hmis_beds').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('is_active', true);
    const { count: occupiedBeds } = await sb()!.from('hmis_beds').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('status', 'occupied');
    const tb = totalBeds || 0;
    const ob = occupiedBeds || 0;
    result['QI-13'] = { value: tb > 0 ? Math.round((ob / tb) * 10000) / 100 : 0, numerator: ob, denominator: tb, autoCalc: true };

    // QI-15: Discharge TAT (hours from discharge_initiated to discharged)
    const { data: discharged } = await sb()!.from('hmis_admissions')
      .select('discharge_initiated_at, discharge_date')
      .eq('centre_id', centreId).eq('status', 'discharged').gte('discharge_date', monthStart).lte('discharge_date', monthEnd)
      .not('discharge_initiated_at', 'is', null);
    const tatArr = (discharged || []).map((a: any) => {
      if (!a.discharge_initiated_at || !a.discharge_date) return 0;
      return (new Date(a.discharge_date).getTime() - new Date(a.discharge_initiated_at).getTime()) / (1000 * 60 * 60);
    }).filter((h: number) => h > 0 && h < 72);
    const avgTAT = tatArr.length > 0 ? Math.round((tatArr.reduce((s: number, h: number) => s + h, 0) / tatArr.length) * 100) / 100 : 0;
    result['QI-15'] = { value: avgTAT, numerator: Math.round(tatArr.reduce((s: number, h: number) => s + h, 0)), denominator: tatArr.length, autoCalc: true };

    // QI-06: Patient Fall Rate (per 1000 patient days)
    const { count: falls } = await sb()!.from('hmis_incidents').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('category', 'fall').gte('created_at', monthStart + 'T00:00:00').lte('created_at', monthEnd + 'T23:59:59');
    const patientDays = losArr.reduce((s: number, d: number) => s + d, 0) || 1;
    result['QI-06'] = { value: Math.round(((falls || 0) / patientDays) * 1000 * 100) / 100, numerator: falls || 0, denominator: patientDays, autoCalc: true };

    // QI-09: Unplanned Return to OT
    const { count: totalOT } = await sb()!.from('hmis_ot_bookings').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).gte('scheduled_date', monthStart).lte('scheduled_date', monthEnd).in('status', ['completed', 'in_progress']);
    const { count: reOT } = await sb()!.from('hmis_ot_bookings').select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId).eq('is_unplanned_return', true).gte('scheduled_date', monthStart).lte('scheduled_date', monthEnd);
    const tOT = totalOT || 0;
    const rOT = reOT || 0;
    result['QI-09'] = { value: tOT > 0 ? Math.round((rOT / tOT) * 10000) / 100 : 0, numerator: rOT, denominator: tOT, autoCalc: true };

    // QI-14: OPD Wait Time (avg minutes from check-in to consultation start)
    const { data: opds } = await sb()!.from('hmis_opd_visits')
      .select('check_in_time, consultation_start_time')
      .eq('centre_id', centreId).gte('check_in_time', monthStart + 'T00:00:00').lte('check_in_time', monthEnd + 'T23:59:59')
      .not('consultation_start_time', 'is', null);
    const waitArr = (opds || []).map((v: any) => {
      if (!v.check_in_time || !v.consultation_start_time) return 0;
      return (new Date(v.consultation_start_time).getTime() - new Date(v.check_in_time).getTime()) / (1000 * 60);
    }).filter((m: number) => m > 0 && m < 300);
    const avgWait = waitArr.length > 0 ? Math.round(waitArr.reduce((s: number, m: number) => s + m, 0) / waitArr.length) : 0;
    result['QI-14'] = { value: avgWait, numerator: Math.round(waitArr.reduce((s: number, m: number) => s + m, 0)), denominator: waitArr.length, autoCalc: true };

    setKpis(result);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { calculate(); }, [calculate]);

  return { kpis, loading, calculate };
}

// ============================================================
// AUDIT TRAIL — comprehensive clinical change logging
// ============================================================
export function useAuditTrail(centreId: string | null) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { entityType?: string; userId?: string; dateFrom?: string; dateTo?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_audit_trail')
      .select('*, user:hmis_staff!hmis_audit_trail_user_id_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.entityType) q = q.eq('entity_type', filters.entityType);
    if (filters?.userId) q = q.eq('user_id', filters.userId);
    if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom + 'T00:00:00');
    if (filters?.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59');
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  return { logs, loading, load };
}
