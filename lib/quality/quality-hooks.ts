// lib/quality/quality-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// INCIDENT REPORTING
// ============================================================
export function useIncidentReporting(centreId: string | null) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; category?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_incidents')
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
    const incidentNumber = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
    const { error } = await sb().from('hmis_incidents').insert({
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
    await sb().from('hmis_incidents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
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
    sb().from('hmis_quality_indicators')
      .select('*').eq('centre_id', centreId)
      .order('period', { ascending: false }).limit(200)
      .then(({ data }: any) => setEntries(data || []));
  }, [centreId]);

  const submitEntry = useCallback(async (indicatorCode: string, period: string, value: number, numerator?: number, denominator?: number, staffId?: string) => {
    if (!centreId || !sb()) return;
    const indicator = NABH_INDICATORS.find(i => i.code === indicatorCode);
    await sb().from('hmis_quality_indicators').insert({
      centre_id: centreId, indicator_code: indicatorCode, indicator_name: indicator?.name || indicatorCode,
      period, value, numerator, denominator, target: indicator?.target,
      met_target: indicator ? value <= indicator.target : null, submitted_by: staffId,
    });
  }, [centreId]);

  return { entries, submitEntry, indicators: NABH_INDICATORS };
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
    let q = sb().from('hmis_audit_trail')
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
