// lib/radiology/radiology-hooks.ts
// Complete radiology hooks — worklist, orders, reports, PACS links, patient imaging, templates, TAT
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { auditCreate, auditSign } from '@/lib/audit/audit-logger';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// TYPES
// ============================================================

export interface RadiologyOrder {
  id: string; centre_id: string; accession_number: string;
  test_id: string; patient_id: string; order_id?: string;
  admission_id?: string; encounter_id?: string;
  clinical_indication: string; urgency: 'routine' | 'urgent' | 'stat';
  modality: string; body_part: string;
  is_contrast: boolean; contrast_allergy_checked: boolean;
  creatinine_value?: number; pregnancy_status?: string; lmp_date?: string;
  scheduled_date?: string; scheduled_time?: string;
  room_id?: string; technician_id?: string; ordered_by?: string;
  status: 'ordered' | 'scheduled' | 'in_progress' | 'reported' | 'verified';
  pacs_study_uid?: string; pacs_accession?: string;
  stradus_viewer_url?: string;
  started_at?: string; completed_at?: string; reported_at?: string; verified_at?: string;
  tat_minutes?: number;
  created_at: string; updated_at: string;
  // Joined
  test?: any; patient?: any; ordered_by_doc?: any; technician?: any;
  report?: any[];
}

export interface RadiologyReport {
  id: string; radiology_order_id: string;
  technique?: string; clinical_history?: string; comparison?: string;
  findings: string; impression: string;
  reported_by: string; verified_by?: string;
  pacs_study_uid?: string; is_ai_assisted: boolean;
  is_critical: boolean; critical_notified: boolean;
  critical_notified_to?: string; critical_notified_at?: string;
  is_addendum: boolean; parent_report_id?: string;
  template_used?: string; status: 'draft' | 'finalized' | 'verified' | 'amended';
  verified_at?: string; created_at: string;
  // Joined
  reporter?: any; verifier?: any;
}

export interface PatientStudy {
  orderId: string; accessionNumber: string;
  testName: string; modality: string; bodyPart: string;
  date: string; status: string; urgency: string;
  stradusUrl?: string; pacsStudyUid?: string;
  hasReport: boolean; reportStatus?: string;
  impression?: string; isCritical?: boolean;
  reportedBy?: string; verifiedBy?: string;
  reportedAt?: string;
  isContrast: boolean;
  admissionId?: string;
}

// Alias for backward compat
export type ImagingStudy = PatientStudy & {
  studyDescription?: string;
  studyDate?: string;
  stradusStudyUrl?: string;
  referringDoctorName?: string;
  seriesCount?: number;
  imageCount?: number;
  report?: {
    findings?: string;
    impression?: string;
    technique?: string;
    comparison?: string;
    clinicalHistory?: string;
    isCritical?: boolean;
    criticalValue?: string;
    reportedBy?: string;
    verifiedBy?: string;
    reportedAt?: string;
    verifiedAt?: string;
    status?: string;
    source?: string;
    tatMinutes?: number;
  } | null;
};

// ============================================================
// LINK STRADUS STUDY TO HMIS ORDER
// ============================================================
export function useLinkStudy() {
  const [linking, setLinking] = useState(false);

  const link = useCallback(async (data: {
    centreId: string; patientId: string;
    accessionNumber?: string; modality: string;
    studyDescription: string; studyDate: string;
    stradusUrl?: string; pacsStudyUid?: string;
    orderId?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    setLinking(true);

    try {
      // If we have an existing order, just update it with the Stradus link
      if (data.orderId) {
        const update: any = {};
        if (data.stradusUrl) update.stradus_viewer_url = data.stradusUrl;
        if (data.pacsStudyUid) update.pacs_study_uid = data.pacsStudyUid;
        update.status = 'in_progress';
        update.updated_at = new Date().toISOString();

        const { error } = await sb().from('hmis_radiology_orders').update(update).eq('id', data.orderId);
        if (error) { setLinking(false); return { success: false, error: error.message }; }
        setLinking(false);
        return { success: true };
      }

      // Create a new order from Stradus study (study done outside HMIS workflow)
      const accession = data.accessionNumber || `RAD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

      // Try to find test in master
      const { data: testMatch } = await sb().from('hmis_radiology_test_master')
        .select('id, modality, body_part')
        .eq('modality', data.modality).limit(1).maybeSingle();

      const { error } = await sb().from('hmis_radiology_orders').insert({
        centre_id: data.centreId,
        patient_id: data.patientId,
        test_id: testMatch?.id || null,
        accession_number: accession,
        modality: data.modality,
        body_part: testMatch?.body_part || null,
        clinical_indication: data.studyDescription,
        status: 'in_progress',
        stradus_viewer_url: data.stradusUrl || null,
        pacs_study_uid: data.pacsStudyUid || null,
        scheduled_date: data.studyDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) { setLinking(false); return { success: false, error: error.message }; }
      setLinking(false);
      return { success: true };
    } catch (err: any) {
      setLinking(false);
      return { success: false, error: err.message || 'Link failed' };
    }
  }, []);

  return { link, linking };
}

// ============================================================
// TEST MASTER
// ============================================================
export function useRadiologyTests() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sb()) { setLoading(false); return; }
    sb().from('hmis_radiology_test_master').select('*').eq('is_active', true).order('modality, test_name')
      .then(({ data }: any) => { setTests(data || []); setLoading(false); });
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return tests.filter(t =>
      t.test_name?.toLowerCase().includes(lq) ||
      t.test_code?.toLowerCase().includes(lq) ||
      t.modality?.toLowerCase().includes(lq) ||
      t.body_part?.toLowerCase().includes(lq)
    ).slice(0, 10);
  }, [tests]);

  const byModality = useMemo(() => {
    const map = new Map<string, any[]>();
    tests.forEach(t => {
      if (!map.has(t.modality)) map.set(t.modality, []);
      map.get(t.modality)!.push(t);
    });
    return map;
  }, [tests]);

  const modalities = useMemo(() => [...new Set(tests.map(t => t.modality))].sort(), [tests]);
  return { tests, loading, search, byModality, modalities };
}

// ============================================================
// WORKLIST — main radiology queue
// ============================================================
export interface WorklistFilters {
  status?: string; modality?: string; urgency?: string;
  dateFrom?: string; dateTo?: string;
  search?: string; // patient name / UHID / accession
}

export function useRadiologyWorklist(centreId: string | null) {
  const [orders, setOrders] = useState<RadiologyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<WorklistFilters>({});

  const load = useCallback(async (f?: WorklistFilters) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const activeFilters = f || filters;

    let q = sb().from('hmis_radiology_orders')
      .select(`*, test:hmis_radiology_test_master(id, test_name, test_code, modality, body_part, tat_hours, is_contrast),
        patient:hmis_patients!inner(id, first_name, last_name, uhid, age_years, gender, phone_primary, date_of_birth),
        ordered_by_doc:hmis_staff!hmis_radiology_orders_ordered_by_fkey(id, full_name),
        technician:hmis_staff!hmis_radiology_orders_technician_id_fkey(id, full_name),
        report:hmis_radiology_reports(id, findings, impression, is_critical, status, reported_by, verified_by, created_at, technique, comparison, clinical_history, is_addendum, verified_at, template_used, reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name), verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name))`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (activeFilters.status && activeFilters.status !== 'all') q = q.eq('status', activeFilters.status);
    if (activeFilters.modality && activeFilters.modality !== 'all') q = q.eq('modality', activeFilters.modality);
    if (activeFilters.urgency && activeFilters.urgency !== 'all') q = q.eq('urgency', activeFilters.urgency);
    if (activeFilters.dateFrom) q = q.gte('created_at', activeFilters.dateFrom + 'T00:00:00');
    if (activeFilters.dateTo) q = q.lte('created_at', activeFilters.dateTo + 'T23:59:59');

    const { data } = await q;
    let result = data || [];

    // Client-side search filter (patient name, UHID, accession)
    if (activeFilters.search && activeFilters.search.length >= 2) {
      const s = activeFilters.search.toLowerCase();
      result = result.filter((o: any) =>
        o.patient?.first_name?.toLowerCase().includes(s) ||
        o.patient?.last_name?.toLowerCase().includes(s) ||
        o.patient?.uhid?.toLowerCase().includes(s) ||
        o.accession_number?.toLowerCase().includes(s)
      );
    }

    // Sort: STAT first, then urgent, then by created_at desc
    const urgOrder: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
    result.sort((a: any, b: any) => {
      const ua = urgOrder[a.urgency] ?? 2, ub = urgOrder[b.urgency] ?? 2;
      if (ua !== ub) return ua - ub;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setOrders(result);
    setLoading(false);
  }, [centreId, filters]);

  useEffect(() => { load(); }, [load]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const s = {
      total: orders.length,
      ordered: 0, scheduled: 0, inProgress: 0, reported: 0, verified: 0,
      stat: 0, urgent: 0, critical: 0, contrast: 0,
      avgTatMinutes: 0, medianTatMinutes: 0,
      tatBreaches: 0,
      byModality: {} as Record<string, { total: number; pending: number; reported: number }>,
      byUrgency: { stat: 0, urgent: 0, routine: 0 },
    };

    const tatValues: number[] = [];

    orders.forEach(o => {
      // Status counts
      if (o.status === 'ordered') s.ordered++;
      else if (o.status === 'scheduled') s.scheduled++;
      else if (o.status === 'in_progress') s.inProgress++;
      else if (o.status === 'reported') s.reported++;
      else if (o.status === 'verified') s.verified++;

      // Urgency
      if (o.urgency === 'stat') { s.stat++; s.byUrgency.stat++; }
      else if (o.urgency === 'urgent') { s.urgent++; s.byUrgency.urgent++; }
      else s.byUrgency.routine++;

      // Flags
      if (o.report?.[0]?.is_critical) s.critical++;
      if (o.is_contrast) s.contrast++;

      // TAT
      if (o.tat_minutes && o.tat_minutes > 0) {
        tatValues.push(o.tat_minutes);
        const expected = (o.test?.tat_hours || 24) * 60;
        if (o.tat_minutes > expected) s.tatBreaches++;
      }

      // By modality
      const mod = o.modality || o.test?.modality || 'Other';
      if (!s.byModality[mod]) s.byModality[mod] = { total: 0, pending: 0, reported: 0 };
      s.byModality[mod].total++;
      if (['ordered', 'scheduled', 'in_progress'].includes(o.status)) s.byModality[mod].pending++;
      else s.byModality[mod].reported++;
    });

    if (tatValues.length > 0) {
      s.avgTatMinutes = Math.round(tatValues.reduce((a, b) => a + b, 0) / tatValues.length);
      tatValues.sort((a, b) => a - b);
      s.medianTatMinutes = tatValues[Math.floor(tatValues.length / 2)];
    }

    return s;
  }, [orders]);

  // ---- Create Order ----
  const createOrder = useCallback(async (data: any): Promise<{ success: boolean; error?: string; order?: any }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.test_id) return { success: false, error: 'Select a test' };
    if (!data.patient_id) return { success: false, error: 'Select a patient' };

    // Generate accession: RAD-CENTREPREFIX-YYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const accession = `RAD-${dateStr}-${seq}`;

    // Get test details
    const { data: test } = await sb().from('hmis_radiology_test_master')
      .select('modality, body_part, is_contrast, tat_hours').eq('id', data.test_id).single();

    if (!test) return { success: false, error: 'Test not found in master' };

    // SAFETY VALIDATIONS
    if (test.is_contrast) {
      if (!data.creatinine_value && data.creatinine_value !== 0)
        return { success: false, error: 'Creatinine value is MANDATORY for contrast studies. Check recent labs.' };
      const cr = parseFloat(data.creatinine_value);
      if (isNaN(cr)) return { success: false, error: 'Invalid creatinine value' };
      if (cr > 1.5)
        return { success: false, error: `Creatinine ${cr} mg/dL exceeds 1.5. Contrast study requires nephrology clearance. Document clearance before proceeding.` };
      if (cr > 1.2)
        data._creatinine_warning = `Creatinine ${cr} — borderline. Ensure adequate hydration pre/post contrast.`;
      if (!data.contrast_allergy_checked)
        return { success: false, error: 'Confirm contrast allergy has been checked before ordering.' };
    }

    if (['CT', 'FLUORO'].includes(test.modality)) {
      if (data.pregnancy_status === 'pregnant')
        return { success: false, error: 'CT / Fluoroscopy is CONTRAINDICATED in pregnancy. Use USG or MRI.' };
      if (data.pregnancy_status === 'unknown')
        data._pregnancy_warning = 'Pregnancy status unknown — confirm with patient before proceeding with ionizing radiation.';
    }

    // Insert
    const { data: order, error } = await sb().from('hmis_radiology_orders').insert({
      centre_id: centreId,
      test_id: data.test_id,
      patient_id: data.patient_id,
      order_id: data.order_id || null,
      admission_id: data.admission_id || null,
      encounter_id: data.encounter_id || null,
      accession_number: accession,
      clinical_indication: data.clinical_indication || '',
      urgency: data.urgency || 'routine',
      modality: test.modality,
      body_part: test.body_part,
      is_contrast: test.is_contrast,
      contrast_allergy_checked: data.contrast_allergy_checked || false,
      creatinine_value: data.creatinine_value ? parseFloat(data.creatinine_value) : null,
      pregnancy_status: data.pregnancy_status || 'na',
      lmp_date: data.lmp_date || null,
      scheduled_date: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      ordered_by: data.ordered_by || null,
      status: 'ordered',
    }).select().single();

    if (error) return { success: false, error: error.message };
    auditCreate(centreId, data.ordered_by || '', 'radiology_order', order?.id, `Radiology: ${test.modality} ${test.body_part} [${accession}]`);
    load();
    return { success: true, order };
  }, [centreId, load]);

  // ---- Update Status ----
  const updateStatus = useCallback(async (orderId: string, status: string, extra?: any): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    const update: any = { status, updated_at: new Date().toISOString(), ...extra };

    if (status === 'in_progress' && !extra?.started_at) update.started_at = new Date().toISOString();
    if (status === 'reported') {
      if (!extra?.reported_at) update.reported_at = new Date().toISOString();
      const { data: order } = await sb().from('hmis_radiology_orders').select('created_at').eq('id', orderId).single();
      if (order) update.tat_minutes = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
    }
    if (status === 'verified' && !extra?.verified_at) update.verified_at = new Date().toISOString();

    const { error } = await sb().from('hmis_radiology_orders').update(update).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  // ---- Link Stradus URL to order ----
  const linkStudy = useCallback(async (orderId: string, stradusUrl: string, studyUid?: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    if (!stradusUrl.trim()) return { success: false, error: 'Stradus URL is required' };

    const update: any = {
      stradus_viewer_url: stradusUrl.trim(),
      updated_at: new Date().toISOString(),
    };
    if (studyUid) update.pacs_study_uid = studyUid;

    // Try to extract Study UID from URL
    if (!studyUid) {
      const match = stradusUrl.match(/StudyInstanceUID=([^&\s]+)/i);
      if (match) update.pacs_study_uid = decodeURIComponent(match[1]);
    }

    const { error } = await sb().from('hmis_radiology_orders').update(update).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  // ---- Assign technician ----
  const assignTechnician = useCallback(async (orderId: string, technicianId: string, scheduledDate?: string, scheduledTime?: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    const { error } = await sb().from('hmis_radiology_orders').update({
      technician_id: technicianId,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  return {
    orders, loading, stats, filters,
    load, setFilters: (f: WorklistFilters) => { setFilters(f); load(f); },
    createOrder, updateStatus, linkStudy, assignTechnician,
  };
}

// ============================================================
// REPORT — for reporting tab and Stradus incoming reports
// ============================================================
export function useRadiologyReport(orderId: string | null) {
  const [reports, setReports] = useState<RadiologyReport[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_radiology_reports')
      .select('*, reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name), verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name)')
      .eq('radiology_order_id', orderId).order('created_at', { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const latestReport = useMemo(() => reports[0] || null, [reports]);
  const addendums = useMemo(() => reports.filter(r => r.is_addendum), [reports]);

  const save = useCallback(async (data: any, staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!orderId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.findings?.trim()) return { success: false, error: 'Findings are required' };
    if (!data.impression?.trim()) return { success: false, error: 'Impression is required' };

    if (latestReport?.id && !data.is_addendum) {
      const { error } = await sb().from('hmis_radiology_reports').update({
        ...data, reported_by: staffId,
      }).eq('id', latestReport.id);
      if (error) return { success: false, error: error.message };
    } else {
      const insert: any = {
        radiology_order_id: orderId, reported_by: staffId, ...data,
      };
      if (data.is_addendum && latestReport?.id) insert.parent_report_id = latestReport.id;
      const { error } = await sb().from('hmis_radiology_reports').insert(insert);
      if (error) return { success: false, error: error.message };
    }
    load();
    return { success: true };
  }, [orderId, latestReport, load]);

  const verify = useCallback(async (staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!latestReport?.id || !sb()) return { success: false, error: 'No report to verify' };
    if (latestReport.reported_by === staffId) return { success: false, error: 'Cannot verify your own report. A different radiologist must verify.' };

    const { error } = await sb().from('hmis_radiology_reports').update({
      verified_by: staffId, verified_at: new Date().toISOString(), status: 'verified',
    }).eq('id', latestReport.id);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [latestReport, load]);

  const markCritical = useCallback(async (notifiedTo: string): Promise<{ success: boolean; error?: string }> => {
    if (!latestReport?.id || !sb()) return { success: false, error: 'No report' };
    const { error } = await sb().from('hmis_radiology_reports').update({
      is_critical: true, critical_notified: true,
      critical_notified_to: notifiedTo, critical_notified_at: new Date().toISOString(),
    }).eq('id', latestReport.id);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [latestReport, load]);

  return { reports, latestReport, addendums, loading, load, save, verify, markCritical };
}

// ============================================================
// PATIENT IMAGING HISTORY — for EMR integration
// This is the KEY hook: shows all studies for a patient with Stradus links
// ============================================================
export function usePatientImaging(patientId: string | null) {
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId || !sb()) return;
    setLoading(true);

    const { data } = await sb().from('hmis_radiology_orders')
      .select(`id, accession_number, modality, body_part, is_contrast, urgency, status, clinical_indication, admission_id,
        pacs_study_uid, stradus_viewer_url, created_at, reported_at,
        test:hmis_radiology_test_master(test_name, modality, body_part),
        report:hmis_radiology_reports(id, impression, findings, technique, comparison, clinical_history, is_critical, status, reported_by, verified_by, verified_at, created_at,
          reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name),
          verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name))`)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const mapped: ImagingStudy[] = (data || []).map((o: any) => {
      const rep = o.report?.[0];
      return {
        orderId: o.id,
        accessionNumber: o.accession_number,
        testName: o.test?.test_name || o.modality || 'Unknown',
        modality: o.modality || o.test?.modality || '',
        bodyPart: o.body_part || o.test?.body_part || '',
        date: o.created_at,
        status: o.status,
        urgency: o.urgency,
        stradusUrl: o.stradus_viewer_url || null,
        pacsStudyUid: o.pacs_study_uid || null,
        hasReport: !!rep,
        reportStatus: rep?.status,
        impression: rep?.impression,
        isCritical: rep?.is_critical,
        reportedBy: rep?.reporter?.full_name,
        verifiedBy: rep?.verifier?.full_name,
        reportedAt: rep?.created_at,
        isContrast: o.is_contrast,
        admissionId: o.admission_id || undefined,
        // ImagingStudy extra fields (for patient-imaging-panel.tsx)
        studyDescription: o.test?.test_name || o.clinical_indication || o.modality || '',
        studyDate: o.created_at?.split('T')[0] || '',
        stradusStudyUrl: o.stradus_viewer_url || null,
        report: rep ? {
          findings: rep.findings, impression: rep.impression,
          technique: rep.technique, comparison: rep.comparison,
          clinicalHistory: rep.clinical_history,
          isCritical: rep.is_critical, criticalValue: rep.is_critical ? rep.impression : undefined,
          reportedBy: rep.reporter?.full_name, verifiedBy: rep.verifier?.full_name,
          reportedAt: rep.created_at, verifiedAt: rep.verified_at,
          status: rep.status, source: 'hmis', tatMinutes: undefined,
        } : null,
      };
    });

    setStudies(mapped);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const byModality = useMemo(() => {
    const map = new Map<string, ImagingStudy[]>();
    studies.forEach(s => {
      const mod = s.modality || 'Other';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(s);
    });
    return map;
  }, [studies]);

  const stats = useMemo(() => ({
    total: studies.length,
    withImages: studies.filter(s => s.stradusUrl).length,
    withReports: studies.filter(s => s.hasReport).length,
    critical: studies.filter(s => s.isCritical).length,
    pending: studies.filter(s => !s.hasReport && s.status !== 'verified').length,
  }), [studies]);

  return { studies, loading, load, byModality, stats };
}

// ============================================================
// SINGLE STUDY DETAIL (for /radiology/[id])
// ============================================================
export function useStudyDetail(orderId: string | null) {
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId || !sb()) { setLoading(false); return; }
    setLoading(true);

    const { data } = await sb().from('hmis_radiology_orders')
      .select(`id, accession_number, modality, body_part, is_contrast, urgency, status, clinical_indication,
        pacs_study_uid, stradus_viewer_url, scheduled_date, scheduled_time, started_at, reported_at, verified_at, tat_minutes,
        centre_id, patient_id, created_at,
        test:hmis_radiology_test_master(test_name, test_code, modality, body_part, tat_hours),
        patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
        ordered_doc:hmis_staff!hmis_radiology_orders_ordered_by_fkey(full_name),
        technician:hmis_staff!hmis_radiology_orders_technician_id_fkey(full_name),
        reports:hmis_radiology_reports(id, findings, impression, technique, comparison, clinical_history,
          is_critical, status, template_used, is_addendum, created_at, verified_at,
          reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name),
          verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name))`)
      .eq('id', orderId).single();

    if (!data) { setStudy(null); setLoading(false); return; }

    const latestReport = data.reports?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())?.[0];

    setStudy({
      id: data.id, orderId: data.id, centreId: data.centre_id, patientId: data.patient_id,
      accessionNumber: data.accession_number, modality: data.modality || data.test?.modality || '',
      bodyPart: data.body_part || data.test?.body_part || '',
      studyDescription: data.test?.test_name || data.clinical_indication || data.modality || '',
      studyDate: data.created_at?.split('T')[0] || '', status: data.status, urgency: data.urgency,
      isContrast: data.is_contrast,
      // Patient
      patientName: `${data.patient?.first_name || ''} ${data.patient?.last_name || ''}`.trim(),
      patientUhid: data.patient?.uhid, patientAge: data.patient?.age_years, patientGender: data.patient?.gender,
      referringDoctorName: data.ordered_doc?.full_name, technicianName: data.technician?.full_name,
      // PACS
      pacsStudyUid: data.pacs_study_uid,
      stradusStudyUrl: data.stradus_viewer_url,
      pacsViewerUrl: data.stradus_viewer_url,
      // Timing
      startedAt: data.started_at, reportedAt: data.reported_at, verifiedAt: data.verified_at,
      tatMinutes: data.tat_minutes, expectedTatHours: data.test?.tat_hours || 24,
      // Reports
      report: latestReport ? {
        id: latestReport.id, findings: latestReport.findings, impression: latestReport.impression,
        technique: latestReport.technique, comparison: latestReport.comparison,
        clinicalHistory: latestReport.clinical_history, isCritical: latestReport.is_critical,
        status: latestReport.status, templateUsed: latestReport.template_used,
        reportedBy: latestReport.reporter?.full_name, verifiedBy: latestReport.verifier?.full_name,
        reportedAt: latestReport.created_at, verifiedAt: latestReport.verified_at,
      } : null,
      reports: (data.reports || []).map((r: any) => ({
        id: r.id, findings: r.findings, impression: r.impression,
        isCritical: r.is_critical, isAddendum: r.is_addendum, status: r.status,
        reportedBy: r.reporter?.full_name, verifiedBy: r.verifier?.full_name,
        reportedAt: r.created_at, verifiedAt: r.verified_at,
      })),
      // Counts (from Stradus if available — default 0)
      seriesCount: 0, imageCount: 0,
    });
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  return { study, loading, load };
}

// ============================================================
// TEMPLATES
// ============================================================
export function useRadiologyTemplates(modality?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (mod?: string) => {
    if (!sb()) return;
    setLoading(true);
    let q = sb().from('hmis_radiology_templates').select('*').eq('is_active', true).order('template_name');
    if (mod || modality) q = q.eq('modality', mod || modality);
    const { data } = await q;
    setTemplates(data || []);
    setLoading(false);
  }, [modality]);

  useEffect(() => { load(); }, [load]);

  const saveTemplate = useCallback(async (data: any): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    if (!data.template_name?.trim()) return { success: false, error: 'Template name required' };
    if (!data.modality) return { success: false, error: 'Modality required' };
    if (!data.findings_template?.trim()) return { success: false, error: 'Findings template required' };

    if (data.id) {
      const { error } = await sb().from('hmis_radiology_templates').update(data).eq('id', data.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await sb().from('hmis_radiology_templates').insert(data);
      if (error) return { success: false, error: error.message };
    }
    load();
    return { success: true };
  }, [load]);

  return { templates, loading, load, saveTemplate };
}

// ============================================================
// PACS CONFIG
// ============================================================
export function usePACSConfig(centreId: string | null) {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_pacs_config').select('*').eq('centre_id', centreId).eq('is_active', true).maybeSingle()
      .then(({ data }: any) => setConfig(data));
  }, [centreId]);

  const getViewerUrl = useCallback((studyUid?: string, accession?: string, patientUhid?: string): string | null => {
    if (!config?.viewer_url) return null;
    const base = config.viewer_url.replace(/\/$/, '');
    if (studyUid) return `${base}?StudyInstanceUID=${encodeURIComponent(studyUid)}`;
    if (accession) return `${base}?AccessionNumber=${encodeURIComponent(accession)}`;
    if (patientUhid) return `${base}?PatientID=${encodeURIComponent(patientUhid)}`;
    return null;
  }, [config]);

  const getPatientViewerUrl = useCallback((patientUhid: string): string | null => {
    if (!config?.viewer_url) return null;
    return `${config.viewer_url.replace(/\/$/, '')}?PatientID=${encodeURIComponent(patientUhid)}`;
  }, [config]);

  return { config, getViewerUrl, getPatientViewerUrl };
}

// ============================================================
// RADIOLOGY ROOMS / EQUIPMENT
// ============================================================
export function useRadiologyRooms(centreId: string | null) {
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_radiology_rooms').select('*').eq('centre_id', centreId).eq('is_active', true).order('modality, name')
      .then(({ data }: any) => setRooms(data || []));
  }, [centreId]);

  const saveRoom = useCallback(async (data: any): Promise<{ success: boolean; error?: string }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    if (data.id) {
      const { error } = await sb().from('hmis_radiology_rooms').update(data).eq('id', data.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await sb().from('hmis_radiology_rooms').insert({ ...data, centre_id: centreId });
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  }, [centreId]);

  return { rooms, saveRoom };
}
