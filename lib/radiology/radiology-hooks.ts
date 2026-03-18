// lib/radiology/radiology-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// TEST MASTER
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
    return tests.filter(t => t.test_name?.toLowerCase().includes(lq) || t.test_code?.toLowerCase().includes(lq) || t.modality?.toLowerCase().includes(lq) || t.body_part?.toLowerCase().includes(lq)).slice(0, 10);
  }, [tests]);

  const modalities = useMemo(() => [...new Set(tests.map(t => t.modality))].sort(), [tests]);
  return { tests, search, modalities };
}

// ============================================================
// WORKLIST — main radiology queue
// ============================================================
export function useRadiologyWorklist(centreId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; modality?: string; urgency?: string; date?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_radiology_orders')
      .select(`*, test:hmis_radiology_test_master(test_name, test_code, modality, body_part, tat_hours, is_contrast),
        patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender, phone_primary),
        ordered_by_doc:hmis_staff!hmis_radiology_orders_ordered_by_fkey(full_name),
        technician:hmis_staff!hmis_radiology_orders_technician_id_fkey(full_name),
        report:hmis_radiology_reports(id, findings, impression, is_critical, status, reported_by, verified_by)`)
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);

    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.modality && filters.modality !== 'all') q = q.eq('modality', filters.modality);
    if (filters?.urgency && filters.urgency !== 'all') q = q.eq('urgency', filters.urgency);
    if (filters?.date) q = q.gte('created_at', filters.date + 'T00:00:00').lte('created_at', filters.date + 'T23:59:59');

    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = useMemo(() => ({
    total: orders.length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    scheduled: orders.filter(o => o.status === 'scheduled').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    reported: orders.filter(o => o.status === 'reported').length,
    verified: orders.filter(o => o.status === 'verified').length,
    stat: orders.filter(o => o.urgency === 'stat').length,
    critical: orders.filter(o => o.report?.[0]?.is_critical).length,
    contrast: orders.filter(o => o.is_contrast).length,
    // TAT
    avgTat: (() => {
      const reported = orders.filter(o => o.tat_minutes && o.tat_minutes > 0);
      return reported.length > 0 ? Math.round(reported.reduce((s, o) => s + o.tat_minutes, 0) / reported.length) : 0;
    })(),
    // By modality
    byModality: orders.reduce((acc: Record<string, number>, o) => {
      const mod = o.modality || o.test?.modality || 'Other';
      acc[mod] = (acc[mod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  }), [orders]);

  // ---- Create order ----
  const createOrder = useCallback(async (data: any): Promise<{ success: boolean; error?: string; order?: any }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.test_id) return { success: false, error: 'Select a radiology test' };
    if (!data.patient_id) return { success: false, error: 'Select a patient' };

    // Generate accession number: RAD-YYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const accession = `RAD-${dateStr}-${seq}`;

    // Get test details for modality/body_part
    const { data: test } = await sb().from('hmis_radiology_test_master').select('modality, body_part, is_contrast').eq('id', data.test_id).single();

    // Contrast safety check
    if (test?.is_contrast && data.is_contrast !== false) {
      if (!data.creatinine_value) return { success: false, error: 'Creatinine value required for contrast studies' };
      if (parseFloat(data.creatinine_value) > 1.5) return { success: false, error: `Creatinine ${data.creatinine_value} mg/dL exceeds safe limit (1.5). Contrast study requires nephrology clearance.` };
      if (!data.contrast_allergy_checked) return { success: false, error: 'Confirm contrast allergy has been checked' };
    }

    // Pregnancy check for CT/Fluoro
    if (['CT', 'FLUORO'].includes(test?.modality) && data.pregnancy_status === 'pregnant') {
      return { success: false, error: 'CT/Fluoroscopy contraindicated in pregnancy. Use USG or MRI instead.' };
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

  // ---- Update status ----
  const updateStatus = useCallback(async (orderId: string, status: string, extra?: any): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    const update: any = { status, updated_at: new Date().toISOString(), ...extra };

    if (status === 'in_progress' && !extra?.started_at) update.started_at = new Date().toISOString();
    if (status === 'reported' && !extra?.reported_at) {
      update.reported_at = new Date().toISOString();
      // Calculate TAT
      const { data: order } = await sb().from('hmis_radiology_orders').select('created_at').eq('id', orderId).single();
      if (order) update.tat_minutes = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
    }
    if (status === 'verified' && !extra?.verified_at) update.verified_at = new Date().toISOString();

    const { error } = await sb().from('hmis_radiology_orders').update(update).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  return { orders, loading, stats, load, createOrder, updateStatus };
}

// ============================================================
// REPORT
// ============================================================
export function useRadiologyReport(orderId: string | null) {
  const [report, setReport] = useState<any>(null);

  const load = useCallback(async () => {
    if (!orderId || !sb()) return;
    const { data } = await sb().from('hmis_radiology_reports')
      .select('*, reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name), verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name)')
      .eq('radiology_order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setReport(data);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data: any, staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!orderId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.findings?.trim()) return { success: false, error: 'Findings are required' };
    if (!data.impression?.trim()) return { success: false, error: 'Impression is required' };

    if (report?.id) {
      const { error } = await sb().from('hmis_radiology_reports').update(data).eq('id', report.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await sb().from('hmis_radiology_reports').insert({
        radiology_order_id: orderId, reported_by: staffId, ...data,
      });
      if (error) return { success: false, error: error.message };
    }
    load();
    return { success: true };
  }, [orderId, report, load]);

  const verify = useCallback(async (staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!report?.id || !sb()) return { success: false, error: 'No report to verify' };
    if (report.reported_by === staffId) return { success: false, error: 'Report cannot be verified by the same person who reported it' };

    const { error } = await sb().from('hmis_radiology_reports').update({
      verified_by: staffId, verified_at: new Date().toISOString(), status: 'verified',
    }).eq('id', report.id);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [report, load]);

  return { report, load, save, verify };
}

// ============================================================
// TEMPLATES
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
// PACS CONFIG
// ============================================================
export function usePACSConfig(centreId: string | null) {
  const [config, setConfig] = useState<any>(null);
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_pacs_config').select('*').eq('centre_id', centreId).eq('is_active', true).maybeSingle()
      .then(({ data }: any) => setConfig(data));
  }, [centreId]);

  // Build Stradus viewer URL for a study
  const getViewerUrl = useCallback((studyUid?: string, accession?: string): string | null => {
    if (!config?.viewer_url) return null;
    const base = config.viewer_url.replace(/\/$/, '');
    if (studyUid) return `${base}?StudyInstanceUID=${studyUid}`;
    if (accession) return `${base}?AccessionNumber=${accession}`;
    return null;
  }, [config]);

  return { config, getViewerUrl };
}
