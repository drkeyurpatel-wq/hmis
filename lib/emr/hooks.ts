// lib/emr/hooks.ts
// Supabase hooks for EMR v3 — patient context, encounters, templates

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ============================================================
// PATIENT LOOKUP + ALLERGIES (#1)
// ============================================================

export interface EMRPatient {
  id: string;
  uhid: string;
  name: string;
  age: string;
  gender: string;
  phone: string;
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  lastVisit: string | null;
}

export function usePatient(patientId: string | null) {
  const [patient, setPatient] = useState<EMRPatient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        // Fetch patient
        const { data: pt, error: ptErr } = await supabase
          .from('hmis_patients')
          .select('*')
          .eq('id', patientId)
          .single();

        if (ptErr) throw ptErr;
        if (cancelled) return;

        // Fetch allergies
        const { data: allergies } = await supabase
          .from('hmis_patient_allergies')
          .select('allergen, severity')
          .eq('patient_id', patientId);

        // Calculate age
        let age = pt.age_years?.toString() || '--';
        if (pt.date_of_birth) {
          const dob = new Date(pt.date_of_birth);
          age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toString();
        }

        // Fetch last visit date
        const { data: lastVisit } = await supabase
          .from('hmis_emr_encounters')
          .select('encounter_date')
          .eq('patient_id', patientId)
          .order('encounter_date', { ascending: false })
          .limit(1);

        if (cancelled) return;

        setPatient({
          id: pt.id,
          uhid: pt.uhid,
          name: [pt.first_name, pt.middle_name, pt.last_name].filter(Boolean).join(' '),
          age,
          gender: pt.gender,
          phone: pt.phone_primary,
          bloodGroup: pt.blood_group || '',
          allergies: (allergies || []).map((a: any) => a.allergen),
          chronicConditions: [], // TODO: pull from problem list
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

  // Add allergy to DB
  const addAllergy = useCallback(async (allergen: string, staffId: string) => {
    if (!patientId) return;
    const { error } = await supabase.from('hmis_patient_allergies').insert({
      patient_id: patientId,
      allergen,
      severity: 'moderate',
      recorded_by: staffId,
    });
    if (!error && patient) {
      setPatient({ ...patient, allergies: [...patient.allergies, allergen] });
    }
  }, [patientId, patient]);

  // Remove allergy from DB
  const removeAllergy = useCallback(async (allergen: string) => {
    if (!patientId) return;
    await supabase.from('hmis_patient_allergies')
      .delete()
      .eq('patient_id', patientId)
      .eq('allergen', allergen);
    if (patient) {
      setPatient({ ...patient, allergies: patient.allergies.filter(a => a !== allergen) });
    }
  }, [patientId, patient]);

  return { patient, loading, error, addAllergy, removeAllergy, setPatient };
}

// ============================================================
// PATIENT SEARCH (for assignment from OPD queue)
// ============================================================

export function usePatientSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      // Search by UHID, name, or phone
      const { data } = await supabase
        .from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, blood_group')
        .or(`uhid.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_primary.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(10);
      setResults(data || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, []);

  return { results, searching, search };
}

// ============================================================
// ENCOUNTER CRUD (#4)
// ============================================================

export interface EncounterData {
  vitals: any;
  complaints: any[];
  examFindings: any[];
  diagnoses: any[];
  investigations: any[];
  prescriptions: any[];
  advice: string[];
  followUp: any;
  referral: any;
}

export interface EncounterSummary {
  id: string;
  date: string;
  status: string;
  primaryDx: string;
  primaryDxCode: string;
  prescriptionCount: number;
  investigationCount: number;
  doctorName?: string;
}

export function useEncounters(patientId: string | null) {
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);

  // Load past encounters for patient
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data } = await supabase
        .from('hmis_emr_encounters')
        .select('id, encounter_date, status, primary_diagnosis_code, primary_diagnosis_label, prescription_count, investigation_count, doctor_id')
        .eq('patient_id', patientId)
        .order('encounter_date', { ascending: false })
        .limit(50);

      if (!cancelled) {
        setEncounters((data || []).map(e => ({
          id: e.id,
          date: e.encounter_date,
          status: e.status,
          primaryDx: e.primary_diagnosis_label || '',
          primaryDxCode: e.primary_diagnosis_code || '',
          prescriptionCount: e.prescription_count || 0,
          investigationCount: e.investigation_count || 0,
        })));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [patientId]);

  // Load full encounter data
  const loadEncounter = useCallback(async (encounterId: string): Promise<EncounterData | null> => {
    const { data, error } = await supabase
      .from('hmis_emr_encounters')
      .select('*')
      .eq('id', encounterId)
      .single();

    if (error || !data) return null;

    return {
      vitals: data.vitals || {},
      complaints: data.complaints || [],
      examFindings: data.exam_findings || [],
      diagnoses: data.diagnoses || [],
      investigations: data.investigations || [],
      prescriptions: data.prescriptions || [],
      advice: data.advice || [],
      followUp: data.follow_up || {},
      referral: data.referral || null,
    };
  }, []);

  // Save encounter (create or update)
  const saveEncounter = useCallback(async (
    data: EncounterData,
    meta: { centreId: string; doctorId: string; opdVisitId?: string; encounterType?: string }
  ) => {
    const payload = {
      centre_id: meta.centreId,
      patient_id: patientId,
      doctor_id: meta.doctorId,
      opd_visit_id: meta.opdVisitId || null,
      encounter_type: meta.encounterType || 'opd',
      vitals: data.vitals,
      complaints: data.complaints,
      exam_findings: data.examFindings,
      diagnoses: data.diagnoses,
      investigations: data.investigations,
      prescriptions: data.prescriptions,
      advice: data.advice,
      follow_up: data.followUp,
      referral: data.referral,
    };

    let result;
    if (activeEncounterId) {
      // Update existing
      result = await supabase
        .from('hmis_emr_encounters')
        .update(payload)
        .eq('id', activeEncounterId)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from('hmis_emr_encounters')
        .insert({ ...payload, status: 'in_progress' })
        .select()
        .single();

      if (result.data) {
        setActiveEncounterId(result.data.id);
      }
    }

    return result;
  }, [patientId, activeEncounterId]);

  // Sign encounter (finalize)
  const signEncounter = useCallback(async (encounterId: string, staffId: string) => {
    return supabase
      .from('hmis_emr_encounters')
      .update({ status: 'signed', signed_at: new Date().toISOString(), signed_by: staffId })
      .eq('id', encounterId);
  }, []);

  return { encounters, loading, activeEncounterId, setActiveEncounterId, loadEncounter, saveEncounter, signEncounter };
}

// ============================================================
// TEMPLATES (#14 — persisted to Supabase)
// ============================================================

export interface EMRTemplate {
  id: string;
  name: string;
  data: { meds: any[]; labs: string[]; advice: string[] };
  usageCount: number;
  isShared: boolean;
}

export function useEMRTemplates(doctorId: string | null) {
  const [templates, setTemplates] = useState<EMRTemplate[]>([]);

  useEffect(() => {
    if (!doctorId) return;
    async function load() {
      const { data } = await supabase
        .from('hmis_emr_templates')
        .select('*')
        .or(`doctor_id.eq.${doctorId},is_shared.eq.true`)
        .order('usage_count', { ascending: false });
      setTemplates((data || []).map(t => ({
        id: t.id,
        name: t.name,
        data: t.data,
        usageCount: t.usage_count,
        isShared: t.is_shared,
      })));
    }
    load();
  }, [doctorId]);

  const saveTemplate = useCallback(async (name: string, data: any, centreId: string) => {
    if (!doctorId) return;
    const { data: result } = await supabase
      .from('hmis_emr_templates')
      .insert({ doctor_id: doctorId, centre_id: centreId, name, data, template_type: 'prescription' })
      .select()
      .single();
    if (result) {
      setTemplates(prev => [...prev, { id: result.id, name: result.name, data: result.data, usageCount: 0, isShared: false }]);
    }
  }, [doctorId]);

  const useTemplate = useCallback(async (templateId: string) => {
    // Increment usage count
    await supabase.rpc('increment_template_usage', { template_id: templateId }).catch(() => {
      // RPC not set up yet — just update directly
      supabase.from('hmis_emr_templates').update({ usage_count: templates.find(t => t.id === templateId)?.usageCount ?? 0 + 1 }).eq('id', templateId);
    });
  }, [templates]);

  return { templates, saveTemplate, useTemplate };
}

// ============================================================
// TODAY'S QUEUE (doctor's assigned patients)
// ============================================================

export function useTodayQueue(doctorId: string | null, centreId: string | null) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doctorId || !centreId) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('hmis_opd_visits')
        .select(`
          id, visit_number, token_number, status, check_in_time,
          patient:hmis_patients(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary)
        `)
        .eq('doctor_id', doctorId)
        .eq('centre_id', centreId)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59')
        .order('token_number', { ascending: true });

      if (!cancelled) {
        setQueue(data || []);
        setLoading(false);
      }
    }

    load();
    // Real-time subscription
    const channel = supabase
      .channel('opd-queue-' + doctorId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hmis_opd_visits',
        filter: `doctor_id=eq.${doctorId}`,
      }, () => { load(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [doctorId, centreId]);

  return { queue, loading };
}
