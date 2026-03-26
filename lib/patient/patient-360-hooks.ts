// lib/patient/patient-360-hooks.ts
// Single hook that loads the complete clinical picture for one patient.
// Used by the Patient 360 view — the unified clinical workspace.

'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface Patient360 {
  // Demographics
  patient: any;
  allergies: any[];
  // Current admission (if admitted)
  admission: any | null;
  bed: any | null;
  ward: any | null;
  primaryDoctor: any | null;
  // Clinical — live
  latestVitals: any | null;
  vitalsTrend: any[];      // last 10 readings
  news2Score: number | null;
  news2Risk: string | null;
  activeMeds: any[];        // active medication orders
  medsNextDue: any[];       // MAR entries due in next 2 hours
  pendingLabOrders: any[];
  pendingRadOrders: any[];
  activeOrders: any[];      // all active CPOE orders
  nursingTasks: any[];      // overdue + due now
  dietOrder: any | null;
  // Results — recent
  recentLabResults: any[];  // last 48 hours
  criticalAlerts: any[];
  recentRadReports: any[];
  recentNotes: any[];       // clinical notes last 24h
  // Billing
  billingSummary: { totalCharged: number; totalPaid: number; balance: number; advanceBalance: number; payorType: string };
  // Surgical
  surgicalPlan: any | null;
  otBookings: any[];
  // Flags
  isAdmitted: boolean;
  isICU: boolean;
  daysAdmitted: number;
  // Meta
  loading: boolean;
  lastRefresh: string;
}

export function usePatient360(patientId: string | null, centreId: string | null): Patient360 & { reload: () => void } {
  const [data, setData] = useState<Omit<Patient360, 'loading' | 'lastRefresh'>>({
    patient: null, allergies: [], admission: null, bed: null, ward: null, primaryDoctor: null,
    latestVitals: null, vitalsTrend: [], news2Score: null, news2Risk: null,
    activeMeds: [], medsNextDue: [], pendingLabOrders: [], pendingRadOrders: [], activeOrders: [],
    nursingTasks: [], dietOrder: null,
    recentLabResults: [], criticalAlerts: [], recentRadReports: [], recentNotes: [],
    billingSummary: { totalCharged: 0, totalPaid: 0, balance: 0, advanceBalance: 0, payorType: 'self' },
    surgicalPlan: null, otBookings: [],
    isAdmitted: false, isICU: false, daysAdmitted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const load = useCallback(async () => {
    if (!patientId || !centreId || !sb()) return;
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const h48ago = new Date(now.getTime() - 48 * 3600000).toISOString();
    const h24ago = new Date(now.getTime() - 24 * 3600000).toISOString();
    const h2later = new Date(now.getTime() + 2 * 3600000).toISOString();

    // 1. Patient demographics + allergies (parallel)
    const [patientRes, allergyRes] = await Promise.all([
      sb()!.from('hmis_patients').select('*').eq('id', patientId).single(),
      sb()!.from('hmis_patient_allergies').select('*').eq('patient_id', patientId).eq('is_active', true),
    ]);

    // 2. Active admission
    const { data: adm } = await sb()!.from('hmis_admissions')
      .select(`*, 
        bed:hmis_beds(id, bed_number, status, room:hmis_rooms(id, room_number, ward:hmis_wards(id, name, type, floor))),
        primary_doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(id, full_name, staff_type),
        admitting_doctor:hmis_staff!hmis_admissions_admitting_doctor_id_fkey(id, full_name)`)
      .eq('patient_id', patientId).eq('centre_id', centreId).eq('status', 'active')
      .order('admission_date', { ascending: false }).limit(1).maybeSingle();

    const isAdmitted = !!adm;
    const admissionId = adm?.id;
    const bedData = adm?.bed as any;
    const wardData = bedData?.room?.ward as any;
    const isICU = wardData?.type === 'icu' || wardData?.type === 'transplant_icu';
    const daysAdmitted = adm ? Math.ceil((now.getTime() - new Date(adm.admission_date).getTime()) / 86400000) : 0;

    // 3. Parallel clinical data load (only if admitted)
    let vitalsLatest: any = null, vitalsTrend: any[] = [], activeMeds: any[] = [], medsNextDue: any[] = [];
    let pendingLabs: any[] = [], pendingRad: any[] = [], activeOrders: any[] = [];
    let nursingTasks: any[] = [], dietOrder: any = null, surgicalPlan: any = null, otBookings: any[] = [];

    if (isAdmitted && admissionId) {
      const [vitalsRes, vitalsHistRes, medsRes, marRes, labRes, radRes, ordersRes, dietRes, planRes, otRes] = await Promise.all([
        // Latest vitals
        sb()!.from('hmis_vitals').select('*')
          .eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
        // Vitals trend (last 10)
        sb()!.from('hmis_vitals').select('heart_rate, systolic_bp, diastolic_bp, temperature, spo2, respiratory_rate, recorded_at')
          .eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(10),
        // Active medication orders
        sb()!.from('hmis_ipd_medication_orders').select('*')
          .eq('admission_id', admissionId).eq('status', 'active').order('created_at', { ascending: false }),
        // MAR — next due
        sb()!.from('hmis_mar').select('*')
          .eq('admission_id', admissionId).in('status', ['due', 'overdue'])
          .order('scheduled_time', { ascending: true }).limit(20),
        // Pending lab orders
        sb()!.from('hmis_lab_orders')
          .select('id, test_name, status, priority, created_at, test:hmis_lab_test_master(test_name, test_code)')
          .eq('patient_id', patientId).eq('centre_id', centreId)
          .in('status', ['ordered', 'sample_collected', 'processing'])
          .order('created_at', { ascending: false }),
        // Pending radiology orders
        sb()!.from('hmis_radiology_orders')
          .select('id, test_name, modality, status, priority, created_at')
          .eq('patient_id', patientId).eq('centre_id', centreId)
          .in('status', ['ordered', 'scheduled', 'in_progress'])
          .order('created_at', { ascending: false }),
        // Active CPOE orders
        sb()!.from('hmis_orders').select('*')
          .eq('patient_id', patientId).eq('status', 'active')
          .order('created_at', { ascending: false }).limit(20),
        // Diet order
        sb()!.from('hmis_diet_orders').select('*')
          .eq('patient_id', patientId).eq('centre_id', centreId).eq('status', 'active')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        // Surgical planning
        sb()!.from('hmis_surgical_planning').select('*')
          .eq('patient_id', patientId).eq('centre_id', centreId).in('status', ['pending', 'ready', 'in_progress'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        // OT bookings
        sb()!.from('hmis_ot_bookings').select('*, ot_room:hmis_ot_rooms(name)')
          .eq('admission_id', admissionId).in('status', ['scheduled', 'in_progress'])
          .order('scheduled_date', { ascending: true }),
      ]);

      vitalsLatest = vitalsRes.data;
      vitalsTrend = (vitalsHistRes.data || []).reverse();
      activeMeds = medsRes.data || [];
      medsNextDue = marRes.data || [];
      pendingLabs = labRes.data || [];
      pendingRad = radRes.data || [];
      activeOrders = ordersRes.data || [];
      dietOrder = dietRes.data;
      surgicalPlan = planRes.data;
      otBookings = otRes.data || [];
    }

    // 4. Results + notes + alerts (parallel, for all patients)
    const [labResultsRes, criticalRes, radReportsRes, notesRes] = await Promise.all([
      sb()!.from('hmis_lab_orders')
        .select('id, test_name, status, created_at, results:hmis_lab_results(parameter_name, result_value, unit, is_abnormal, is_critical, ref_range_min, ref_range_max)')
        .eq('patient_id', patientId).eq('centre_id', centreId)
        .in('status', ['reported', 'verified'])
        .gte('created_at', h48ago)
        .order('created_at', { ascending: false }).limit(20),
      sb()!.from('hmis_lab_critical_alerts').select('*')
        .eq('patient_id', patientId).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      sb()!.from('hmis_radiology_reports')
        .select('*, order:hmis_radiology_orders!inner(test_name, modality, patient_id)')
        .eq('order.patient_id', patientId)
        .gte('created_at', h48ago)
        .order('created_at', { ascending: false }).limit(10),
      sb()!.from('hmis_emr_encounters')
        .select('id, encounter_type, chief_complaint, assessment, plan, created_at, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId)
        .gte('created_at', h24ago)
        .order('created_at', { ascending: false }).limit(10),
    ]);

    // 5. Billing summary
    const { data: billData } = await sb()!.from('hmis_bills')
      .select('net_amount, paid_amount, balance_amount, payor_type')
      .eq('patient_id', patientId).eq('centre_id', centreId)
      .neq('status', 'cancelled');
    const { data: advData } = await sb()!.from('hmis_advances')
      .select('amount, used_amount')
      .eq('patient_id', patientId);

    const totalCharged = (billData || []).reduce((s: number, b: any) => s + (b.net_amount || 0), 0);
    const totalPaid = (billData || []).reduce((s: number, b: any) => s + (b.paid_amount || 0), 0);
    const balance = (billData || []).reduce((s: number, b: any) => s + (b.balance_amount || 0), 0);
    const advanceBalance = (advData || []).reduce((s: number, a: any) => s + ((a.amount || 0) - (a.used_amount || 0)), 0);
    const payorType = adm?.payor_type || (billData || [])[0]?.payor_type || 'self';

    // NEWS2 calculation
    let news2Score: number | null = null;
    let news2Risk: string | null = null;
    if (vitalsLatest) {
      try {
        const { calculateNEWS2 } = await import('@/lib/cdss/news2');
        const result = calculateNEWS2({
          respiratoryRate: vitalsLatest.respiratory_rate,
          spo2: vitalsLatest.spo2,
          systolic: vitalsLatest.systolic_bp,
          heartRate: vitalsLatest.heart_rate,
          temperature: vitalsLatest.temperature,
          onSupplementalO2: vitalsLatest.on_supplemental_o2,
        });
        if (result) { news2Score = result.total; news2Risk = result.risk; }
      } catch (e: any) { console.error("[HMIS Patient360]", e?.message || e); }
    }

    setData({
      patient: patientRes.data,
      allergies: allergyRes.data || [],
      admission: adm,
      bed: bedData,
      ward: wardData,
      primaryDoctor: adm?.primary_doctor as any,
      latestVitals: vitalsLatest,
      vitalsTrend,
      news2Score, news2Risk,
      activeMeds, medsNextDue, pendingLabOrders: pendingLabs, pendingRadOrders: pendingRad,
      activeOrders, nursingTasks, dietOrder,
      recentLabResults: labResultsRes.data || [],
      criticalAlerts: criticalRes.data || [],
      recentRadReports: radReportsRes.data || [],
      recentNotes: notesRes.data || [],
      billingSummary: { totalCharged, totalPaid, balance, advanceBalance, payorType },
      surgicalPlan, otBookings,
      isAdmitted, isICU, daysAdmitted,
    });
    setLoading(false);
    setLastRefresh(now.toISOString());
  }, [patientId, centreId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s for admitted patients
  useEffect(() => {
    if (!data.isAdmitted) return;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [data.isAdmitted, load]);

  return { ...data, loading, lastRefresh, reload: load };
}
