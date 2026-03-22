// lib/emr/hooks.ts
// Supabase hooks for EMR v3

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// Types
// ============================================================
export interface EMRPatient {
  id: string; uhid: string; name: string; age: string; gender: string;
  phone: string; bloodGroup: string; allergies: string[]; chronicConditions: string[];
  lastVisit: string | null;
}

export interface EncounterData {
  vitals: any; complaints: any[]; examFindings: any[]; diagnoses: any[];
  investigations: any[]; prescriptions: any[]; advice: string[];
  followUp: any; referral: any; status?: string;
}

export interface EncounterSummary {
  id: string; date: string; status: string; primaryDx: string;
  primaryDxCode: string; prescriptionCount: number; investigationCount: number;
}

export interface EMRTemplate {
  id: string; name: string; data: { meds: any[]; labs: string[]; advice: string[] };
  usageCount: number; isShared: boolean;
}

// ============================================================
// #1 PATIENT LOOKUP
// ============================================================
export function usePatient(patientId: string | null) {
  const [patient, setPatient] = useState<EMRPatient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !sb()) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const { data: pt, error: ptErr } = await sb().from('hmis_patients').select('*').eq('id', patientId).single();
        if (ptErr) throw ptErr;
        if (cancelled) return;

        const { data: allergies } = await sb().from('hmis_patient_allergies').select('allergen, severity').eq('patient_id', patientId);

        let age = pt.age_years?.toString() || '--';
        if (pt.date_of_birth) {
          const dob = new Date(pt.date_of_birth);
          age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toString();
        }

        const { data: lastVisit } = await sb().from('hmis_emr_encounters').select('encounter_date').eq('patient_id', patientId).order('encounter_date', { ascending: false }).limit(1);

        if (cancelled) return;
        setPatient({
          id: pt.id, uhid: pt.uhid,
          name: [pt.first_name, pt.middle_name, pt.last_name].filter(Boolean).join(' '),
          age, gender: pt.gender, phone: pt.phone_primary,
          bloodGroup: pt.blood_group || '',
          allergies: (allergies || []).map((a: any) => a.allergen),
          chronicConditions: [],
          lastVisit: lastVisit?.[0]?.encounter_date || null,
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [patientId]);

  const addAllergy = useCallback(async (allergen: string, staffId: string) => {
    if (!patientId || !sb()) return;
    const { error } = await sb().from('hmis_patient_allergies').insert({ patient_id: patientId, allergen, severity: 'moderate', recorded_by: staffId });
    if (!error && patient) setPatient({ ...patient, allergies: [...patient.allergies, allergen] });
  }, [patientId, patient]);

  const removeAllergy = useCallback(async (allergen: string) => {
    if (!patientId || !sb()) return;
    await sb().from('hmis_patient_allergies').delete().eq('patient_id', patientId).eq('allergen', allergen);
    if (patient) setPatient({ ...patient, allergies: patient.allergies.filter(a => a !== allergen) });
  }, [patientId, patient]);

  return { patient, loading, error, addAllergy, removeAllergy, setPatient };
}

// ============================================================
// PATIENT SEARCH
// ============================================================
export function usePatientSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 2 || !sb()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, blood_group')
        .or(`uhid.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_primary.ilike.%${query}%`)
        .eq('is_active', true).limit(10);
      setResults(data || []);
    } catch { setResults([]); }
    setSearching(false);
  }, []);

  return { results, searching, search };
}

// ============================================================
// #4 ENCOUNTER CRUD
// ============================================================
export function useEncounters(patientId: string | null) {
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !sb()) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data } = await sb().from('hmis_emr_encounters')
        .select('id, encounter_date, status, primary_diagnosis_code, primary_diagnosis_label, prescription_count, investigation_count')
        .eq('patient_id', patientId).order('encounter_date', { ascending: false }).limit(50);

      if (!cancelled) {
        setEncounters((data || []).map((e: any) => ({
          id: e.id, date: e.encounter_date, status: e.status,
          primaryDx: e.primary_diagnosis_label || '', primaryDxCode: e.primary_diagnosis_code || '',
          prescriptionCount: e.prescription_count || 0, investigationCount: e.investigation_count || 0,
        })));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [patientId]);

  const loadEncounter = useCallback(async (encounterId: string): Promise<EncounterData | null> => {
    if (!sb()) return null;
    const { data, error } = await sb().from('hmis_emr_encounters').select('*').eq('id', encounterId).single();
    if (error || !data) return null;
    return {
      vitals: data.vitals || {}, complaints: data.complaints || [],
      examFindings: data.exam_findings || [], diagnoses: data.diagnoses || [],
      investigations: data.investigations || [], prescriptions: data.prescriptions || [],
      advice: data.advice || [], followUp: data.follow_up || {}, referral: data.referral || null,
    };
  }, []);

  const saveEncounter = useCallback(async (
    data: EncounterData,
    meta: { centreId: string; doctorId: string; opdVisitId?: string; encounterType?: string }
  ) => {
    if (!sb()) return { data: null, error: { message: 'No client' } };
    const payload = {
      centre_id: meta.centreId, patient_id: patientId, doctor_id: meta.doctorId,
      opd_visit_id: meta.opdVisitId || null, encounter_type: meta.encounterType || 'opd',
      vitals: data.vitals, complaints: data.complaints, exam_findings: data.examFindings,
      diagnoses: data.diagnoses, investigations: data.investigations, prescriptions: data.prescriptions,
      advice: data.advice, follow_up: data.followUp, referral: data.referral,
    };

    let result;
    if (activeEncounterId) {
      const updatePayload = data.status ? { ...payload, status: data.status, ...(data.status === 'signed' ? { signed_at: new Date().toISOString() } : {}) } : payload;
      result = await sb().from('hmis_emr_encounters').update(updatePayload).eq('id', activeEncounterId).select().single();
    } else {
      result = await sb().from('hmis_emr_encounters').insert({ ...payload, status: data.status || 'in_progress' }).select().single();
      if (result.data) setActiveEncounterId(result.data.id);
    }
    return result;
  }, [patientId, activeEncounterId]);

  const signEncounter = useCallback(async (encounterId: string, staffId: string) => {
    if (!sb()) return { error: { message: 'No client' } };
    return sb().from('hmis_emr_encounters').update({ status: 'signed', signed_at: new Date().toISOString(), signed_by: staffId }).eq('id', encounterId);
  }, []);

  return { encounters, loading, activeEncounterId, setActiveEncounterId, loadEncounter, saveEncounter, signEncounter };
}

// ============================================================
// TEMPLATES
// ============================================================
export function useEMRTemplates(doctorId: string | null) {
  const [templates, setTemplates] = useState<EMRTemplate[]>([]);

  useEffect(() => {
    if (!doctorId || !sb()) return;
    async function load() {
      const { data } = await sb().from('hmis_emr_templates').select('*')
        .or(`doctor_id.eq.${doctorId},is_shared.eq.true`).order('usage_count', { ascending: false });
      setTemplates((data || []).map((t: any) => ({
        id: t.id, name: t.name, data: t.data, usageCount: t.usage_count, isShared: t.is_shared,
      })));
    }
    load();
  }, [doctorId]);

  const saveTemplate = useCallback(async (name: string, data: any, centreId: string) => {
    if (!doctorId || !sb()) return;
    const { data: result } = await sb().from('hmis_emr_templates')
      .insert({ doctor_id: doctorId, centre_id: centreId, name, data, template_type: 'prescription' }).select().single();
    if (result) setTemplates(prev => [...prev, { id: result.id, name: result.name, data: result.data, usageCount: 0, isShared: false }]);
  }, [doctorId]);

  const useTemplate = useCallback(async (templateId: string) => {
    if (!sb()) return;
    try {
      await sb().from('hmis_emr_templates').update({ usage_count: (templates.find(t => t.id === templateId)?.usageCount || 0) + 1 }).eq('id', templateId);
    } catch { /* ignore */ }
  }, [templates]);

  return { templates, saveTemplate, useTemplate };
}

// ============================================================
// TODAY'S QUEUE
// ============================================================
export function useTodayQueue(doctorId: string | null, centreId: string | null) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doctorId || !centreId || !sb()) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await sb().from('hmis_opd_visits')
        .select('id, visit_number, token_number, status, check_in_time, patient:hmis_patients(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary)')
        .eq('doctor_id', doctorId).eq('centre_id', centreId)
        .gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59')
        .order('token_number', { ascending: true });
      if (!cancelled) { setQueue(data || []); setLoading(false); }
    }
    load();

    const channel = sb().channel('opd-queue-' + doctorId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_opd_visits', filter: `doctor_id=eq.${doctorId}` }, () => { load(); })
      .subscribe();

    return () => { cancelled = true; sb().removeChannel(channel); };
  }, [doctorId, centreId]);

  return { queue, loading };
}
