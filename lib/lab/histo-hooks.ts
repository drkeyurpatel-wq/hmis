// lib/lab/histo-hooks.ts
// Histopathology & Cytology module hooks

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// HISTOPATHOLOGY CASES
// ============================================================
export function useHistoCase(orderId: string | null) {
  const [histoCase, setHistoCase] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_lab_histo_cases').select('*').eq('order_id', orderId).single();
    setHistoCase(data);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const createCase = useCallback(async (data: {
    specimenType: string; specimenSite?: string; laterality?: string;
    clinicalHistory?: string; clinicalDiagnosis?: string; surgeonName?: string;
  }, staffId: string) => {
    if (!orderId || !sb()) return null;
    // Get next case number via RPC
    const { data: caseNum } = await sb()!.rpc('hmis_next_histo_case');
    const { data: result, error } = await sb()!.from('hmis_lab_histo_cases').insert({
      order_id: orderId, case_number: caseNum || `HP-${Date.now()}`,
      specimen_type: data.specimenType, specimen_site: data.specimenSite,
      laterality: data.laterality || 'na',
      clinical_history: data.clinicalHistory, clinical_diagnosis: data.clinicalDiagnosis,
      surgeon_name: data.surgeonName, received_by: staffId, status: 'accessioned',
    }).select().single();
    if (!error) { setHistoCase(result); return result; }
    return null;
  }, [orderId]);

  const updateGrossing = useCallback(async (data: {
    grossDescription: string; grossMeasurements?: string; grossWeight?: string;
    blocksCount?: number; slidesCount?: number;
  }, staffId: string) => {
    if (!histoCase?.id || !sb()) return;
    await sb()!.from('hmis_lab_histo_cases').update({
      gross_description: data.grossDescription, gross_measurements: data.grossMeasurements,
      gross_weight: data.grossWeight, blocks_count: data.blocksCount || 1,
      slides_count: data.slidesCount || 1, grossing_by: staffId,
      grossing_done_at: new Date().toISOString(), status: 'processing',
    }).eq('id', histoCase.id);
    load();
  }, [histoCase, load]);

  const updateMicroscopy = useCallback(async (microDescription: string) => {
    if (!histoCase?.id || !sb()) return;
    await sb()!.from('hmis_lab_histo_cases').update({
      micro_description: microDescription, status: 'reporting',
    }).eq('id', histoCase.id);
    load();
  }, [histoCase, load]);

  const reportDiagnosis = useCallback(async (data: {
    diagnosis: string; icdCode?: string; tumorGrade?: string;
    marginStatus?: string; lymphNodeStatus?: string; tnmStaging?: string;
    synopticData?: any; specialStains?: string[]; ihcMarkers?: string[];
  }, staffId: string) => {
    if (!histoCase?.id || !sb()) return;
    await sb()!.from('hmis_lab_histo_cases').update({
      histo_diagnosis: data.diagnosis, icd_code: data.icdCode,
      tumor_grade: data.tumorGrade, margin_status: data.marginStatus || 'not_applicable',
      lymph_node_status: data.lymphNodeStatus, tnm_staging: data.tnmStaging,
      synoptic_data: data.synopticData || {}, special_stains: data.specialStains || [],
      ihc_markers: data.ihcMarkers || [], reported_by: staffId,
      reported_at: new Date().toISOString(), status: 'verified',
    }).eq('id', histoCase.id);
    // Update order
    await sb()!.from('hmis_lab_orders').update({ status: 'completed', reported_at: new Date().toISOString(), reported_by: staffId }).eq('id', orderId);
    load();
  }, [histoCase, orderId, load]);

  const addAddendum = useCallback(async (text: string, staffId: string) => {
    if (!histoCase?.id || !sb()) return;
    await sb()!.from('hmis_lab_histo_cases').update({
      addendum: text, addendum_date: new Date().toISOString(), addendum_by: staffId, status: 'amended',
    }).eq('id', histoCase.id);
    load();
  }, [histoCase, load]);

  return { histoCase, loading, load, createCase, updateGrossing, updateMicroscopy, reportDiagnosis, addAddendum };
}

// ============================================================
// HISTO CASE LIST
// ============================================================
export function useHistoCaseList(centreId: string | null) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (statusFilter?: string) => {
    if (!sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_lab_histo_cases')
      .select('*, order:hmis_lab_orders!inner(patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender))')
      .order('created_at', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setCases(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { cases, loading, load };
}

// ============================================================
// AUDIT TRAIL
// ============================================================
export function useAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (entityType?: string, entityId?: string, limit: number = 100) => {
    if (!sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_lab_audit_log')
      .select('*, staff:hmis_staff!hmis_lab_audit_log_performed_by_fkey(full_name)')
      .order('performed_at', { ascending: false }).limit(limit);
    if (entityType) q = q.eq('entity_type', entityType);
    if (entityId) q = q.eq('entity_id', entityId);
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }, []);

  const logAction = useCallback(async (data: {
    entityType: string; entityId: string; action: string;
    fieldName?: string; oldValue?: string; newValue?: string;
    reason?: string; metadata?: any;
  }, staffId: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_lab_audit_log').insert({
      entity_type: data.entityType, entity_id: data.entityId,
      action: data.action, performed_by: staffId,
      field_name: data.fieldName, old_value: data.oldValue, new_value: data.newValue,
      reason: data.reason, metadata: data.metadata || {},
    });
  }, []);

  return { logs, loading, load, logAction };
}

// ============================================================
// REFLEX TESTING
// ============================================================
export function useReflexRules() {
  const [rules, setRules] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb()!.from('hmis_lab_reflex_rules')
      .select('*, trigger_test:hmis_lab_test_master!hmis_lab_reflex_rules_trigger_test_id_fkey(test_code, test_name), reflex_test:hmis_lab_test_master!hmis_lab_reflex_rules_reflex_test_id_fkey(test_code, test_name)')
      .eq('is_active', true).order('rule_name');
    setRules(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Check if a result triggers any reflex rules
  const checkReflex = useCallback((testId: string, parameterId: string | null, value: number): {
    triggered: boolean; rules: any[];
  } => {
    const matched = rules.filter(r => {
      if (r.trigger_test_id !== testId) return false;
      if (r.trigger_parameter_id && parameterId && r.trigger_parameter_id !== parameterId) return false;
      const v1 = parseFloat(r.trigger_value_1);
      const v2 = r.trigger_value_2 ? parseFloat(r.trigger_value_2) : null;
      switch (r.trigger_condition) {
        case 'gt': return value > v1;
        case 'gte': return value >= v1;
        case 'lt': return value < v1;
        case 'lte': return value <= v1;
        case 'eq': return value === v1;
        case 'neq': return value !== v1;
        case 'between': return v2 !== null && value >= v1 && value <= v2;
        default: return false;
      }
    });
    return { triggered: matched.length > 0, rules: matched };
  }, [rules]);

  return { rules, load, checkReflex };
}

// ============================================================
// NCR (Non-Conformance Reports)
// ============================================================
export function useNCR() {
  const [ncrs, setNcrs] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb()!.from('hmis_lab_ncr')
      .select('*, reporter:hmis_staff!hmis_lab_ncr_reported_by_fkey(full_name), assignee:hmis_staff!hmis_lab_ncr_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false }).limit(50);
    setNcrs(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: {
    ncrType: string; title: string; description: string; severity?: string; assignedTo?: string;
  }, staffId: string) => {
    if (!sb()) return;
    const { data: seq } = await sb()!.rpc('nextval', { seq_name: 'hmis_ncr_seq' });
    const ncrNum = `NCR-${new Date().getFullYear()}-${String(seq || Date.now()).padStart(4, '0')}`;
    await sb()!.from('hmis_lab_ncr').insert({
      ncr_number: ncrNum, ncr_type: data.ncrType, title: data.title,
      description: data.description, severity: data.severity || 'minor',
      reported_by: staffId, assigned_to: data.assignedTo || null,
    });
    load();
  }, [load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb()!.from('hmis_lab_ncr').update(updates).eq('id', id);
    load();
  }, [load]);

  return { ncrs, load, create, update };
}
