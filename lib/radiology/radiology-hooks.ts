// lib/radiology/radiology-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// TYPES
// ============================================================
export interface ImagingStudy {
  id: string;
  centreId: string;
  patientId: string;
  orderId?: string;
  admissionId?: string;
  accessionNumber: string;
  studyInstanceUid?: string;
  modality: string;
  studyDescription: string;
  bodyPart?: string;
  isContrast: boolean;
  seriesCount: number;
  imageCount: number;
  stradusStudyUrl?: string;
  pacsViewerUrl?: string;
  studyDate: string;
  studyTime?: string;
  acquiredAt?: string;
  technicianName?: string;
  referringDoctorName?: string;
  referringDoctorId?: string;
  status: string;
  // Joined
  patientName?: string;
  patientUhid?: string;
  patientAge?: number;
  patientGender?: string;
  report?: ImagingReport | null;
  reports?: ImagingReport[];
}

export interface ImagingReport {
  id: string;
  studyId: string;
  reportStatus: string;
  technique?: string;
  clinicalHistory?: string;
  comparison?: string;
  findings: string;
  impression: string;
  isCritical: boolean;
  criticalValue?: string;
  reportedByName?: string;
  reportedAt?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  source: string;
  tatMinutes?: number;
}

function mapStudy(raw: any): ImagingStudy {
  return {
    id: raw.id,
    centreId: raw.centre_id,
    patientId: raw.patient_id,
    orderId: raw.order_id,
    admissionId: raw.admission_id,
    accessionNumber: raw.accession_number,
    studyInstanceUid: raw.study_instance_uid,
    modality: raw.modality,
    studyDescription: raw.study_description,
    bodyPart: raw.body_part,
    isContrast: raw.is_contrast,
    seriesCount: raw.series_count,
    imageCount: raw.image_count,
    stradusStudyUrl: raw.stradus_study_url,
    pacsViewerUrl: raw.pacs_viewer_url,
    studyDate: raw.study_date,
    studyTime: raw.study_time,
    acquiredAt: raw.acquired_at,
    technicianName: raw.technician_name,
    referringDoctorName: raw.referring_doctor?.full_name || raw.referring_doctor_name,
    referringDoctorId: raw.referring_doctor_id,
    status: raw.status,
    patientName: raw.patient ? `${raw.patient.first_name} ${raw.patient.last_name}` : undefined,
    patientUhid: raw.patient?.uhid,
    patientAge: raw.patient?.age_years,
    patientGender: raw.patient?.gender,
    report: raw.reports?.[0] ? mapReport(raw.reports[0]) : null,
    reports: raw.reports?.map(mapReport),
  };
}

function mapReport(raw: any): ImagingReport {
  return {
    id: raw.id,
    studyId: raw.study_id,
    reportStatus: raw.report_status,
    technique: raw.technique,
    clinicalHistory: raw.clinical_history,
    comparison: raw.comparison,
    findings: raw.findings,
    impression: raw.impression,
    isCritical: raw.is_critical,
    criticalValue: raw.critical_value,
    reportedByName: raw.reported_by_name,
    reportedAt: raw.reported_at,
    verifiedByName: raw.verified_by_name,
    verifiedAt: raw.verified_at,
    source: raw.source,
    tatMinutes: raw.tat_minutes,
  };
}

// ============================================================
// 1. PATIENT IMAGING HISTORY — the most important hook
//    Used in patient file, EMR, IPD, anywhere patient context exists
// ============================================================
export function usePatientImaging(patientId: string | null) {
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId || !sb()) return;
    setLoading(true);
    const { data } = await sb()
      .from('hmis_imaging_studies')
      .select(`*, reports:hmis_imaging_reports(*), referring_doctor:hmis_staff!hmis_imaging_studies_referring_doctor_id_fkey(full_name), patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender)`)
      .eq('patient_id', patientId)
      .neq('status', 'cancelled')
      .order('study_date', { ascending: false })
      .limit(100);
    setStudies((data || []).map(mapStudy));
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // Group by modality
  const byModality = useMemo(() => {
    const map: Record<string, ImagingStudy[]> = {};
    studies.forEach(s => {
      if (!map[s.modality]) map[s.modality] = [];
      map[s.modality].push(s);
    });
    return map;
  }, [studies]);

  // Group by body part
  const byBodyPart = useMemo(() => {
    const map: Record<string, ImagingStudy[]> = {};
    studies.forEach(s => {
      const part = s.bodyPart || 'Other';
      if (!map[part]) map[part] = [];
      map[part].push(s);
    });
    return map;
  }, [studies]);

  // Timeline (for patient file)
  const timeline = useMemo(() =>
    studies.map(s => ({
      id: s.id,
      date: s.studyDate,
      modality: s.modality,
      description: s.studyDescription,
      hasReport: !!s.report,
      isCritical: s.report?.isCritical || false,
      status: s.status,
      viewerUrl: s.stradusStudyUrl || s.pacsViewerUrl,
    })), [studies]);

  return { studies, loading, load, byModality, byBodyPart, timeline, count: studies.length };
}

// ============================================================
// 2. WORKLIST — radiology department queue
// ============================================================
export function useRadiologyWorklist(centreId: string | null) {
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: {
    status?: string; modality?: string; date?: string; urgency?: string;
  }) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    let q = sb().from('hmis_imaging_studies')
      .select(`*, reports:hmis_imaging_reports(*), referring_doctor:hmis_staff!hmis_imaging_studies_referring_doctor_id_fkey(full_name), patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender, phone_primary)`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.modality && filters.modality !== 'all') q = q.eq('modality', filters.modality);
    if (filters?.date) q = q.eq('study_date', filters.date);

    const { data } = await q;
    setStudies((data || []).map(mapStudy));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const s = {
      total: studies.length,
      ordered: studies.filter(s => s.status === 'ordered').length,
      acquired: studies.filter(s => s.status === 'acquired').length,
      reported: studies.filter(s => s.status === 'reported').length,
      verified: studies.filter(s => s.status === 'verified').length,
      critical: studies.filter(s => s.report?.isCritical).length,
      unreported: studies.filter(s => ['ordered', 'acquired'].includes(s.status)).length,
      byModality: {} as Record<string, number>,
      avgTat: 0,
    };
    studies.forEach(st => { s.byModality[st.modality] = (s.byModality[st.modality] || 0) + 1; });
    const withTat = studies.filter(st => st.report?.tatMinutes && st.report.tatMinutes > 0);
    if (withTat.length > 0) s.avgTat = Math.round(withTat.reduce((sum, st) => sum + (st.report!.tatMinutes || 0), 0) / withTat.length);
    return s;
  }, [studies]);

  return { studies, loading, stats, load };
}

// ============================================================
// 3. STUDY DETAIL — single study with all reports
// ============================================================
export function useStudyDetail(studyId: string | null) {
  const [study, setStudy] = useState<ImagingStudy | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!studyId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_imaging_studies')
      .select(`*, reports:hmis_imaging_reports(*, reporter:hmis_staff!hmis_imaging_reports_reported_by_id_fkey(full_name)), referring_doctor:hmis_staff!hmis_imaging_studies_referring_doctor_id_fkey(full_name), patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender, phone_primary, date_of_birth)`)
      .eq('id', studyId).single();
    setStudy(data ? mapStudy(data) : null);
    setLoading(false);
  }, [studyId]);

  useEffect(() => { load(); }, [load]);
  return { study, loading, load };
}

// ============================================================
// 4. MANUAL STUDY LINK — link Stradus URL to patient
// ============================================================
export function useLinkStudy() {
  const [linking, setLinking] = useState(false);

  const link = useCallback(async (data: {
    centreId: string; patientId: string; accessionNumber: string;
    modality: string; studyDescription: string; studyDate: string;
    stradusUrl: string; studyInstanceUid?: string; orderId?: string;
    admissionId?: string; referringDoctorId?: string;
  }): Promise<{ success: boolean; error?: string; studyId?: string }> => {
    setLinking(true);
    try {
      const resp = await fetch('/api/radiology/link-study', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();
      setLinking(false);
      return result;
    } catch (err: any) {
      setLinking(false);
      return { success: false, error: err.message };
    }
  }, []);

  return { link, linking };
}

// ============================================================
// 5. RADIOLOGY TEST MASTER
// ============================================================
export function useRadiologyTests() {
  const [tests, setTests] = useState<any[]>([]);
  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_radiology_test_master').select('*').eq('is_active', true).order('modality, test_name')
      .then(({ data }: any) => setTests(data || []));
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return tests.filter(t =>
      t.test_name?.toLowerCase().includes(lq) ||
      t.test_code?.toLowerCase().includes(lq) ||
      t.modality?.toLowerCase().includes(lq) ||
      t.body_part?.toLowerCase().includes(lq)
    ).slice(0, 12);
  }, [tests]);

  const modalities = useMemo(() => [...new Set(tests.map(t => t.modality))].sort(), [tests]);
  return { tests, search, modalities };
}

// ============================================================
// 6. REPORT TEMPLATES
// ============================================================
export function useRadiologyTemplates(modality?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!sb()) return;
    let q = sb().from('hmis_radiology_templates').select('*').eq('is_active', true).order('template_name');
    if (modality) q = q.eq('modality', modality);
    q.then(({ data }: any) => setTemplates(data || []));
  }, [modality]);
  return { templates };
}

// ============================================================
// 7. PROTOCOLS
// ============================================================
export function useRadiologyProtocols(modality?: string, bodyPart?: string) {
  const [protocols, setProtocols] = useState<any[]>([]);
  useEffect(() => {
    if (!sb()) return;
    let q = sb().from('hmis_radiology_protocols').select('*').eq('is_active', true);
    if (modality) q = q.eq('modality', modality);
    if (bodyPart) q = q.eq('body_part', bodyPart);
    q.order('protocol_name').then(({ data }: any) => setProtocols(data || []));
  }, [modality, bodyPart]);
  return { protocols };
}

// ============================================================
// 8. CRITICAL FINDINGS
// ============================================================
export function useCriticalFindings(centreId: string | null) {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_critical_findings')
      .select(`*, study:hmis_imaging_studies(modality, study_description, accession_number, stradus_study_url, patient:hmis_patients!inner(first_name, last_name, uhid))`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(50);
    setFindings(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = useCallback(async (id: string, name: string, action: string): Promise<{ success: boolean }> => {
    if (!sb()) return { success: false };
    await sb().from('hmis_critical_findings').update({
      acknowledged: true, acknowledged_at: new Date().toISOString(),
      acknowledged_by: name, action_taken: action,
    }).eq('id', id);
    load();
    return { success: true };
  }, [load]);

  const unacknowledged = useMemo(() => findings.filter(f => !f.acknowledged), [findings]);
  return { findings, loading, load, acknowledge, unacknowledged };
}

// ============================================================
// 9. PACS CONFIG
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
    if (studyUid) return `${base}?StudyInstanceUID=${studyUid}`;
    if (accession) return `${base}?AccessionNumber=${accession}`;
    if (patientUhid) return `${base}?PatientID=${patientUhid}`;
    return null;
  }, [config]);

  return { config, getViewerUrl };
}

// ============================================================
// 10. STRADUS SYNC LOG
// ============================================================
export function useStradusLog(limit = 50) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_stradus_sync_log').select('*').order('created_at', { ascending: false }).limit(limit)
      .then(({ data }: any) => setLogs(data || []));
  }, [limit]);
  return { logs };
}

// ============================================================
// 11. RADIOLOGY ORDERS (legacy, still useful for creating orders)
// ============================================================
export function useRadiologyOrders(centreId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_radiology_orders')
      .select(`*, test:hmis_radiology_test_master(test_name, test_code, modality, body_part, tat_hours, is_contrast),
        patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
        ordered_by_doc:hmis_staff!hmis_radiology_orders_ordered_by_fkey(full_name)`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false }).limit(200);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createOrder = useCallback(async (data: any): Promise<{ success: boolean; error?: string; order?: any }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.test_id) return { success: false, error: 'Select a radiology test' };
    if (!data.patient_id) return { success: false, error: 'Select a patient' };

    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const accession = `RAD-${dateStr}-${seq}`;

    const { data: test } = await sb().from('hmis_radiology_test_master').select('modality, body_part, is_contrast').eq('id', data.test_id).single();

    // Contrast safety
    if (test?.is_contrast && data.is_contrast !== false) {
      if (!data.creatinine_value) return { success: false, error: 'Creatinine value required for contrast studies' };
      if (parseFloat(data.creatinine_value) > 1.5) return { success: false, error: `Creatinine ${data.creatinine_value} exceeds 1.5. Nephrology clearance needed.` };
      if (!data.contrast_allergy_checked) return { success: false, error: 'Confirm contrast allergy check' };
    }
    // Pregnancy
    if (['CT', 'FLUORO'].includes(test?.modality) && data.pregnancy_status === 'pregnant') {
      return { success: false, error: 'CT/Fluoroscopy contraindicated in pregnancy' };
    }

    const { data: order, error } = await sb().from('hmis_radiology_orders').insert({
      ...data, centre_id: centreId, accession_number: accession,
      modality: test?.modality, body_part: test?.body_part,
      is_contrast: test?.is_contrast || false,
    }).select().single();

    if (error) return { success: false, error: error.message };
    load();
    return { success: true, order };
  }, [centreId, load]);

  return { orders, loading, load, createOrder };
}
