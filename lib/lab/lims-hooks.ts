// lib/lab/lims-hooks.ts
// Core LIMS hooks for Health1 Laboratory Module

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { auditCreate, auditUpdate, auditSign } from '@/lib/audit/audit-logger';
import { smartPostLabCharge } from '@/lib/bridge/cross-module-bridge';
import { notifyLabResults } from '@/lib/notifications/notification-dispatcher';

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (typeof window === 'undefined') return null as any;
  if (!_sb) { try { _sb = createClient(); } catch { return null as any; } }
  return _sb;
}

// ============================================================
// TEST MASTER with parameters
// ============================================================
export function useTestMaster() {
  const [tests, setTests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data: t } = await sb().from('hmis_lab_test_master')
      .select('*, parameters:hmis_lab_test_parameters(*, ref_ranges:hmis_lab_ref_ranges(*))')
      .eq('is_active', true).order('category').order('test_name');
    setTests(t || []);
    const { data: p } = await sb().from('hmis_lab_profiles')
      .select('*, tests:hmis_lab_profile_tests(test:hmis_lab_test_master(id, test_code, test_name))')
      .eq('is_active', true).order('profile_name');
    setProfiles(p || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { tests, profiles, load };
}

// ============================================================
// LAB ORDERS (worklist)
// ============================================================
export interface LabOrder {
  id: string; testCode: string; testName: string; category: string;
  patientName: string; patientUhid: string; patientId: string;
  patientAge: number; patientGender: string;
  priority: string; status: string; orderedBy: string;
  sampleBarcode: string | null; sampleStatus: string | null;
  clinicalInfo: string | null; createdAt: string;
  tatDeadline: string | null; tatMet: boolean | null;
}

export function useLabWorklist(centreId: string | null) {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, collected: 0, processing: 0, completed: 0, tatBreached: 0 });

  const load = useCallback(async (statusFilter?: string, dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const dt = dateFilter || new Date().toISOString().split('T')[0];
    let query = sb().from('hmis_lab_orders')
      .select(`id, priority, status, clinical_info, created_at, tat_deadline, tat_met, reported_at,
        test:hmis_lab_test_master!inner(test_code, test_name, category),
        patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender),
        doctor:hmis_staff!hmis_lab_orders_ordered_by_fkey(full_name),
        sample:hmis_lab_samples(barcode, status)`)
      .eq('centre_id', centreId)
      .gte('created_at', dt + 'T00:00:00')
      .order('created_at', { ascending: false }).limit(200);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    const mapped: LabOrder[] = (data || []).map((o: any) => ({
      id: o.id, testCode: o.test?.test_code, testName: o.test?.test_name, category: o.test?.category,
      patientName: o.patient.first_name + ' ' + (o.patient.last_name || ''),
      patientUhid: o.patient.uhid, patientId: o.patient.id,
      patientAge: o.patient.age_years, patientGender: o.patient.gender,
      priority: o.priority || 'routine', status: o.status,
      orderedBy: o.doctor?.full_name || '', clinicalInfo: o.clinical_info,
      sampleBarcode: o.sample?.[0]?.barcode, sampleStatus: o.sample?.[0]?.status,
      createdAt: o.created_at, tatDeadline: o.tat_deadline, tatMet: o.tat_met,
    }));
    setOrders(mapped);
    setStats({
      total: mapped.length,
      pending: mapped.filter(o => o.status === 'ordered').length,
      collected: mapped.filter(o => o.status === 'sample_collected').length,
      processing: mapped.filter(o => o.status === 'processing').length,
      completed: mapped.filter(o => o.status === 'completed').length,
      tatBreached: mapped.filter(o => o.tatDeadline && new Date(o.tatDeadline) < new Date() && o.status !== 'completed').length,
    });
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('lab-worklist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_lab_orders', filter: `centre_id=eq.${centreId}` }, () => load())
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [centreId, load]);

  return { orders, loading, stats, load };
}

// ============================================================
// SAMPLE MANAGEMENT
// ============================================================
export function useSamples(centreId: string | null) {
  const generateBarcode = useCallback((testCode: string) => {
    const d = new Date();
    const prefix = testCode.substring(0, 3).toUpperCase();
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `H1-${prefix}-${d.getFullYear().toString().slice(2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${seq}`;
  }, []);

  const collectSample = useCallback(async (orderId: string, sampleType: string, staffId: string, testCode: string) => {
    if (!sb()) return null;
    const barcode = generateBarcode(testCode);
    const { data: sample, error } = await sb().from('hmis_lab_samples').insert({
      lab_order_id: orderId, barcode, sample_type: sampleType,
      collected_by: staffId, collected_at: new Date().toISOString(),
      status: 'collected',
    }).select().single();
    if (!error) {
      await sb().from('hmis_lab_orders').update({ status: 'sample_collected' }).eq('id', orderId);
      // Log
      if (sample) await sb().from('hmis_lab_sample_log').insert({ sample_id: sample.id, action: 'collected', performed_by: staffId, location: 'Collection counter' });
      // Auto-post charge from tariff
      const { data: order } = await sb().from('hmis_lab_orders')
        .select('centre_id, patient_id, admission_id, test:hmis_lab_test_master(test_name), patient:hmis_patients!inner(payor_type)')
        .eq('id', orderId).maybeSingle();
      if (order?.test?.test_name) {
        await smartPostLabCharge({
          centreId: order.centre_id, patientId: order.patient_id,
          admissionId: order.admission_id || undefined,
          labOrderId: orderId, testName: order.test.test_name,
          payorType: order.patient?.payor_type || 'self', staffId,
        });
      }
    }
    return { sample, barcode, error };
  }, [generateBarcode]);

  const receiveSample = useCallback(async (sampleId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_lab_samples').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', sampleId);
    await sb().from('hmis_lab_sample_log').insert({ sample_id: sampleId, action: 'received', performed_by: staffId, location: 'Lab reception' });
  }, []);

  const rejectSample = useCallback(async (sampleId: string, orderId: string, reasonCode: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_lab_samples').update({ status: 'rejected' }).eq('id', sampleId);
    await sb().from('hmis_lab_orders').update({ status: 'ordered' }).eq('id', orderId); // back to ordered for recollection
    await sb().from('hmis_lab_sample_log').insert({ sample_id: sampleId, action: 'rejected', performed_by: staffId, notes: reasonCode });
  }, []);

  return { collectSample, receiveSample, rejectSample, generateBarcode };
}

// ============================================================
// RESULT ENTRY with auto-validation
// ============================================================
export function useResultEntry(orderId: string | null) {
  const [parameters, setParameters] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [previousResults, setPreviousResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !sb()) return;
    setLoading(true);
    // Get order + test parameters
    const { data: order } = await sb().from('hmis_lab_orders')
      .select('test_id, patient_id, test:hmis_lab_test_master(test_code, test_name, parameters:hmis_lab_test_parameters(*, ref_ranges:hmis_lab_ref_ranges(*)))')
      .eq('id', orderId).single();
    if (order?.test?.parameters) {
      setParameters(order.test.parameters.sort((a: any, b: any) => a.sort_order - b.sort_order));
    }
    // Get existing results
    const { data: res } = await sb().from('hmis_lab_results').select('*').eq('lab_order_id', orderId).order('created_at');
    setResults(res || []);
    // Get previous results for delta check (last 3 results for same test, same patient)
    if (order?.patient_id && order?.test_id) {
      const { data: prev } = await sb().from('hmis_lab_results')
        .select('parameter_name, result_value, created_at, lab_order:hmis_lab_orders!inner(test_id, patient_id)')
        .neq('lab_order_id', orderId).order('created_at', { ascending: false }).limit(50);
      setPreviousResults(prev || []);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Auto-validate a result value against reference ranges and critical values
  const validateResult = useCallback((paramId: string, value: string, patientAge: number, patientGender: string) => {
    const param = parameters.find((p: any) => p.id === paramId);
    if (!param || param.data_type !== 'numeric') return { isAbnormal: false, isCritical: false, deltaFlag: false };

    const numVal = parseFloat(value);
    if (isNaN(numVal)) return { isAbnormal: false, isCritical: false, deltaFlag: false };

    // Find applicable reference range (age/gender specific first, then default)
    let refMin = param.ref_range_min;
    let refMax = param.ref_range_max;
    if (param.ref_ranges?.length > 0) {
      const specific = param.ref_ranges.find((r: any) =>
        (r.gender === patientGender || r.gender === 'all') &&
        patientAge >= r.age_min_years && patientAge <= r.age_max_years
      );
      if (specific) { refMin = specific.ref_min; refMax = specific.ref_max; }
    }

    const isAbnormal = (refMin !== null && numVal < refMin) || (refMax !== null && numVal > refMax);
    const isCritical = (param.critical_low !== null && numVal <= param.critical_low) || (param.critical_high !== null && numVal >= param.critical_high);

    // Delta check
    let deltaFlag = false;
    let deltaPrevious = null;
    let deltaPercent = null;
    if (param.delta_check_percent) {
      const prev = previousResults.find((r: any) => r.parameter_name === param.parameter_name);
      if (prev) {
        const prevVal = parseFloat(prev.result_value);
        if (!isNaN(prevVal) && prevVal !== 0) {
          deltaPercent = Math.abs((numVal - prevVal) / prevVal * 100);
          deltaFlag = deltaPercent > param.delta_check_percent;
          deltaPrevious = prev.result_value;
        }
      }
    }

    return { isAbnormal, isCritical, deltaFlag, deltaPrevious, deltaPercent, refMin, refMax };
  }, [parameters, previousResults]);

  // Save results
  const saveResults = useCallback(async (resultEntries: { parameterId: string; parameterName: string; value: string; unit: string; isAbnormal: boolean; isCritical: boolean; deltaFlag: boolean; deltaPrevious: string | null; deltaPercent: number | null; remarks?: string }[], staffId: string) => {
    if (!orderId || !sb()) return;
    // Upsert results
    for (const entry of resultEntries) {
      const existing = results.find((r: any) => r.parameter_id === entry.parameterId || r.parameter_name === entry.parameterName);
      if (existing) {
        await sb().from('hmis_lab_results').update({
          result_value: entry.value, unit: entry.unit,
          is_abnormal: entry.isAbnormal, is_critical: entry.isCritical,
          delta_flag: entry.deltaFlag, delta_previous: entry.deltaPrevious,
          delta_percent: entry.deltaPercent, remarks: entry.remarks,
          entered_by: staffId, entered_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await sb().from('hmis_lab_results').insert({
          lab_order_id: orderId, parameter_id: entry.parameterId,
          parameter_name: entry.parameterName, result_value: entry.value,
          unit: entry.unit, is_abnormal: entry.isAbnormal, is_critical: entry.isCritical,
          delta_flag: entry.deltaFlag, delta_previous: entry.deltaPrevious,
          delta_percent: entry.deltaPercent, remarks: entry.remarks,
          entered_by: staffId, entered_at: new Date().toISOString(),
        });
      }
    }
    // Check if all parameters have results → auto-complete
    const allDone = resultEntries.length >= parameters.filter((p: any) => p.is_reportable).length;
    if (allDone) {
      await sb().from('hmis_lab_orders').update({ status: 'processing' }).eq('id', orderId);
    }
    // Create critical alerts
    const criticals = resultEntries.filter(e => e.isCritical);
    for (const c of criticals) {
      await sb().from('hmis_lab_critical_alerts').insert({
        lab_order_id: orderId, result_id: results.find((r: any) => r.parameter_name === c.parameterName)?.id || orderId,
        parameter_name: c.parameterName, result_value: c.value,
        critical_type: parseFloat(c.value) < 0 ? 'low' : 'high', status: 'pending',
      }).then(() => {}).catch(() => {}); // ignore duplicates
    }
    load();
  }, [orderId, results, parameters, load]);

  // Verify/validate results (pathologist sign-off)
  const verifyResults = useCallback(async (staffId: string) => {
    if (!orderId || !sb()) return;
    // Mark all results as validated
    await sb().from('hmis_lab_results').update({ validated_by: staffId, validated_at: new Date().toISOString() }).eq('lab_order_id', orderId);
    // Mark order as completed
    const tatMet = await checkTAT(orderId);
    await sb().from('hmis_lab_orders').update({
      status: 'completed', reported_at: new Date().toISOString(), reported_by: staffId,
      verified_at: new Date().toISOString(), verified_by: staffId, tat_met: tatMet,
    }).eq('id', orderId);
    auditSign('', staffId, 'lab_result', orderId, `Lab results verified for order ${orderId}`);
    // Notify patient
    const { data: orderInfo } = await sb().from('hmis_lab_orders')
      .select('test:hmis_lab_test_master(test_name), patient:hmis_patients!inner(phone_primary, first_name, last_name)')
      .eq('id', orderId).maybeSingle();
    if (orderInfo?.patient?.phone_primary) {
      notifyLabResults({ phone: orderInfo.patient.phone_primary, patientName: `${orderInfo.patient.first_name} ${orderInfo.patient.last_name}`, testNames: [orderInfo?.test?.test_name || 'Lab test'] });
    }
    load();
  }, [orderId, load]);

  return { parameters, results, previousResults, loading, load, validateResult, saveResults, verifyResults };
}

// TAT check helper
async function checkTAT(orderId: string): Promise<boolean> {
  if (!sb()) return true;
  const { data } = await sb().from('hmis_lab_orders').select('tat_deadline').eq('id', orderId).single();
  if (!data?.tat_deadline) return true;
  return new Date() <= new Date(data.tat_deadline);
}

// ============================================================
// CRITICAL ALERTS
// ============================================================
export function useCriticalAlerts(centreId: string | null) {
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_lab_critical_alerts')
      .select('*, order:hmis_lab_orders!inner(centre_id, patient:hmis_patients!inner(first_name, last_name, uhid), test:hmis_lab_test_master!inner(test_name))')
      .in('status', ['pending', 'notified']).order('created_at', { ascending: false });
    setAlerts((data || []).filter((a: any) => a.order?.centre_id === centreId));
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = useCallback(async (alertId: string, doctorId: string, action: string) => {
    if (!sb()) return;
    await sb().from('hmis_lab_critical_alerts').update({
      status: 'acknowledged', acknowledged_at: new Date().toISOString(), action_taken: action,
    }).eq('id', alertId);
    load();
  }, [load]);

  const notify = useCallback(async (alertId: string, doctorId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_lab_critical_alerts').update({
      status: 'notified', notified_doctor_id: doctorId, notified_at: new Date().toISOString(), notified_by: staffId,
    }).eq('id', alertId);
    load();
  }, [load]);

  return { alerts, load, acknowledge, notify };
}

// ============================================================
// OUTSOURCED LAB
// ============================================================
export function useOutsourcedLab() {
  const [outsourced, setOutsourced] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_lab_outsourced')
      .select('*, order:hmis_lab_orders!inner(test:hmis_lab_test_master!inner(test_name), patient:hmis_patients!inner(first_name, last_name, uhid))')
      .order('dispatch_date', { ascending: false }).limit(100);
    setOutsourced(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dispatch = useCallback(async (orderId: string, labName: string, expectedReturn: string, cost?: number) => {
    if (!sb()) return;
    await sb().from('hmis_lab_outsourced').insert({
      lab_order_id: orderId, external_lab_name: labName,
      dispatch_date: new Date().toISOString().split('T')[0],
      expected_return: expectedReturn, cost, status: 'dispatched',
    });
    await sb().from('hmis_lab_orders').update({ status: 'processing' }).eq('id', orderId);
    load();
  }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    if (!sb()) return;
    const updates: any = { status };
    if (status === 'received_back') updates.actual_return = new Date().toISOString().split('T')[0];
    await sb().from('hmis_lab_outsourced').update(updates).eq('id', id);
    load();
  }, [load]);

  return { outsourced, load, dispatch, updateStatus };
}
