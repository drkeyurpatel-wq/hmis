// lib/ipd/clinical-hooks.ts
// Supabase hooks for IPD clinical workflows

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// DOCTOR ROUNDS
// ============================================================
export function useDoctorRounds(admissionId: string | null) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_doctor_rounds')
      .select('*, doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)')
      .eq('admission_id', admissionId).order('created_at', { ascending: false });
    setRounds(data || []);
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addRound = useCallback(async (round: {
    doctorId: string; roundType: string; subjective?: string; objective?: string;
    vitalsData?: any; assessment?: string; plan?: string; ordersGiven?: any[];
    dietInstruction?: string; activityLevel?: string; codeStatus?: string; isCritical?: boolean;
  }) => {
    if (!admissionId || !sb()) return null;
    const { data, error } = await sb().from('hmis_doctor_rounds').insert({
      admission_id: admissionId, doctor_id: round.doctorId, round_type: round.roundType,
      subjective: round.subjective, objective: round.objective, vitals_data: round.vitalsData,
      assessment: round.assessment, plan: round.plan, orders_given: round.ordersGiven || [],
      diet_instruction: round.dietInstruction, activity_level: round.activityLevel,
      code_status: round.codeStatus, is_critical: round.isCritical || false,
    }).select().single();
    if (!error) load();
    return { data, error };
  }, [admissionId, load]);

  return { rounds, loading, load, addRound };
}

// ============================================================
// ICU CHARTING
// ============================================================
export function useICUChart(admissionId: string | null) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (hoursBack: number = 24) => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data } = await sb().from('hmis_icu_charts')
      .select('*, nurse:hmis_staff!hmis_icu_charts_recorded_by_fkey(full_name)')
      .eq('admission_id', admissionId).gte('recorded_at', since)
      .order('recorded_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = useCallback(async (entry: any, staffId: string) => {
    if (!admissionId || !sb()) return null;
    const gcsTotal = (entry.gcs_eye || 0) + (entry.gcs_verbal || 0) + (entry.gcs_motor || 0);
    const { data, error } = await sb().from('hmis_icu_charts').insert({
      admission_id: admissionId, recorded_by: staffId, ...entry,
      gcs_total: gcsTotal > 0 ? gcsTotal : null,
    }).select().single();
    if (!error) load();
    return { data, error };
  }, [admissionId, load]);

  return { entries, loading, load, addEntry };
}

// ============================================================
// ICU SCORES
// ============================================================
export function useICUScores(admissionId: string | null) {
  const [scores, setScores] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    const { data } = await sb().from('hmis_icu_scores')
      .select('*, scorer:hmis_staff!hmis_icu_scores_scored_by_fkey(full_name)')
      .eq('admission_id', admissionId).order('created_at', { ascending: false });
    setScores(data || []);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addScore = useCallback(async (scoreType: string, scoreValue: number, components: any, interpretation: string, staffId: string) => {
    if (!admissionId || !sb()) return;
    await sb().from('hmis_icu_scores').insert({
      admission_id: admissionId, scored_by: staffId,
      score_type: scoreType, score_value: scoreValue,
      components, interpretation,
    });
    load();
  }, [admissionId, load]);

  return { scores, load, addScore };
}

// ============================================================
// I/O CHART
// ============================================================
export function useIOChart(admissionId: string | null) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_io_chart')
      .select('*, nurse:hmis_staff!hmis_io_chart_recorded_by_fkey(full_name)')
      .eq('admission_id', admissionId).order('io_date', { ascending: false }).order('shift').limit(50);
    setEntries(data || []);
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = useCallback(async (entry: any, staffId: string) => {
    if (!admissionId || !sb()) return;
    await sb().from('hmis_io_chart').insert({ admission_id: admissionId, recorded_by: staffId, ...entry });
    load();
  }, [admissionId, load]);

  return { entries, loading, load, addEntry };
}

// ============================================================
// IPD MEDICATION ORDERS
// ============================================================
export function useMedicationOrders(admissionId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_ipd_medication_orders')
      .select('*, doctor:hmis_staff!hmis_ipd_medication_orders_ordered_by_fkey(full_name)')
      .eq('admission_id', admissionId).order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addOrder = useCallback(async (order: {
    drugName: string; genericName?: string; dose: string; route: string; frequency: string;
    startDate?: string; endDate?: string; isStat?: boolean; isPrn?: boolean;
    prnInstruction?: string; specialInstructions?: string;
  }, staffId: string) => {
    if (!admissionId || !sb()) return;
    await sb().from('hmis_ipd_medication_orders').insert({
      admission_id: admissionId, ordered_by: staffId,
      drug_name: order.drugName, generic_name: order.genericName,
      dose: order.dose, route: order.route, frequency: order.frequency,
      start_date: order.startDate || new Date().toISOString().split('T')[0],
      end_date: order.endDate || null, is_stat: order.isStat || false,
      is_prn: order.isPrn || false, prn_instruction: order.prnInstruction,
      special_instructions: order.specialInstructions,
    });
    load();
  }, [admissionId, load]);

  const discontinue = useCallback(async (orderId: string, staffId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_ipd_medication_orders').update({
      status: 'discontinued', discontinued_by: staffId, discontinue_reason: reason,
    }).eq('id', orderId);
    load();
  }, [load]);

  return { orders, loading, load, addOrder, discontinue };
}

// ============================================================
// MAR (Medication Administration Records)
// ============================================================
export function useMAR(admissionId: string | null) {
  const [records, setRecords] = useState<any[]>([]);

  const load = useCallback(async (dateFilter?: string) => {
    if (!admissionId || !sb()) return;
    const dt = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_mar')
      .select('*, medication:hmis_ipd_medication_orders(drug_name, dose, route, frequency)')
      .eq('admission_id', admissionId)
      .gte('scheduled_time', dt + 'T00:00:00').lte('scheduled_time', dt + 'T23:59:59')
      .order('scheduled_time');
    setRecords(data || []);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const administer = useCallback(async (marId: string, staffId: string, doseGiven?: string, site?: string, notes?: string) => {
    if (!sb()) return;
    await sb().from('hmis_mar').update({
      status: 'given', administered_by: staffId, administered_time: new Date().toISOString(),
      dose_given: doseGiven, site, notes,
    }).eq('id', marId);
    load();
  }, [load]);

  const holdDose = useCallback(async (marId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_mar').update({ status: 'held', hold_reason: reason }).eq('id', marId);
    load();
  }, [load]);

  return { records, load, administer, holdDose };
}

// ============================================================
// CONSENTS
// ============================================================
export function useConsents(admissionId: string | null, patientId?: string) {
  const [consents, setConsents] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    let query = sb().from('hmis_consents')
      .select('*, staff:hmis_staff!hmis_consents_obtained_by_fkey(full_name)')
      .order('consent_date', { ascending: false });
    if (admissionId) query = query.eq('admission_id', admissionId);
    else if (patientId) query = query.eq('patient_id', patientId);
    else return;
    const { data } = await query;
    setConsents(data || []);
  }, [admissionId, patientId]);

  useEffect(() => { load(); }, [load]);

  const addConsent = useCallback(async (consent: {
    consentType: string; procedureName?: string; risksExplained?: string;
    alternativesExplained?: string; witnessName?: string; witnessRelation?: string;
    patientId: string;
  }, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').insert({
      admission_id: admissionId, patient_id: consent.patientId,
      consent_type: consent.consentType, procedure_name: consent.procedureName,
      risks_explained: consent.risksExplained, alternatives_explained: consent.alternativesExplained,
      witness_name: consent.witnessName, witness_relation: consent.witnessRelation,
      obtained_by: staffId, consent_given: true,
    });
    load();
  }, [admissionId, load]);

  return { consents, load, addConsent };
}

// ============================================================
// PROCEDURAL NOTES
// ============================================================
export function useProceduralNotes(admissionId: string | null) {
  const [notes, setNotes] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    const { data } = await sb().from('hmis_procedural_notes')
      .select('*, doctor:hmis_staff!hmis_procedural_notes_performed_by_fkey(full_name)')
      .eq('admission_id', admissionId).order('procedure_date', { ascending: false });
    setNotes(data || []);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const addNote = useCallback(async (note: {
    procedureType: string; procedureName: string; indication: string; site?: string;
    laterality?: string; technique?: string; findings?: string; complications?: string;
    specimensSent?: string; eblMl?: number; consentId?: string;
  }, staffId: string, assistantId?: string) => {
    if (!admissionId || !sb()) return;
    await sb().from('hmis_procedural_notes').insert({
      admission_id: admissionId, performed_by: staffId, assisted_by: assistantId,
      procedure_type: note.procedureType, procedure_name: note.procedureName,
      indication: note.indication, site: note.site, laterality: note.laterality,
      technique: note.technique, findings: note.findings, complications: note.complications,
      specimens_sent: note.specimensSent, estimated_blood_loss_ml: note.eblMl,
      consent_id: note.consentId, consent_obtained: true,
    });
    load();
  }, [admissionId, load]);

  return { notes, load, addNote };
}

// ============================================================
// WHO SURGICAL SAFETY CHECKLIST
// ============================================================
export function useWHOChecklist(bookingId: string | null) {
  const [checklist, setChecklist] = useState<any>(null);

  const load = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb().from('hmis_ot_safety_checklist').select('*').eq('ot_booking_id', bookingId).single();
    setChecklist(data);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const createOrUpdate = useCallback(async (updates: any, staffId: string) => {
    if (!bookingId || !sb()) return;
    if (checklist?.id) {
      await sb().from('hmis_ot_safety_checklist').update(updates).eq('id', checklist.id);
    } else {
      await sb().from('hmis_ot_safety_checklist').insert({ ot_booking_id: bookingId, ...updates });
    }
    load();
  }, [bookingId, checklist, load]);

  return { checklist, load, createOrUpdate };
}

// ============================================================
// OT NOTES
// ============================================================
export function useOTNotes(bookingId: string | null) {
  const [notes, setNotes] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb().from('hmis_ot_notes')
      .select('*, author:hmis_staff!hmis_ot_notes_author_id_fkey(full_name)')
      .eq('ot_booking_id', bookingId).order('created_at');
    setNotes(data || []);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const addNote = useCallback(async (note: any, staffId: string) => {
    if (!bookingId || !sb()) return;
    await sb().from('hmis_ot_notes').insert({
      ot_booking_id: bookingId, author_id: staffId, ...note,
    });
    load();
  }, [bookingId, load]);

  return { notes, load, addNote };
}
