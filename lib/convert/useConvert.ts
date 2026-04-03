'use client';
// lib/convert/useConvert.ts
// Hooks for the OPD→IPD Conversion module

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type {
  ConversionLead, ConversionFollowup, FunnelStage,
  ConversionTask, DoctorConversionRate, ActionType, FollowupOutcome,
} from './types';

// ---- Conversion Funnel ----
export function useConversionFunnel(centreId: string | null, from: string, to: string) {
  const [data, setData] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await sb().rpc('get_conversion_funnel', {
      p_centre_id: centreId, p_from: from, p_to: to,
    });
    setData(rows || []);
    setLoading(false);
  }, [centreId, from, to]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

// ---- Counselor Tasks ----
export function useConversionTasks(centreId: string | null, counselorId?: string | null) {
  const [data, setData] = useState<ConversionTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const params: Record<string, unknown> = { p_centre_id: centreId };
    if (counselorId) params.p_counselor_id = counselorId;
    const { data: rows } = await sb().rpc('get_conversion_tasks', params);
    setData(rows || []);
    setLoading(false);
  }, [centreId, counselorId]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

// ---- Doctor Conversion Rates ----
export function useDoctorConversionRates(centreId: string | null, from: string, to: string) {
  const [data, setData] = useState<DoctorConversionRate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await sb().rpc('get_doctor_conversion_rates', {
      p_centre_id: centreId, p_from: from, p_to: to,
    });
    setData(rows || []);
    setLoading(false);
  }, [centreId, from, to]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

// ---- Single Lead ----
export function useConversionLead(leadId: string | null) {
  const [lead, setLead] = useState<ConversionLead | null>(null);
  const [patient, setPatient] = useState<{ first_name: string; last_name: string; uhid: string; phone_primary: string; gender: string; age_years: number } | null>(null);
  const [doctor, setDoctor] = useState<{ full_name: string } | null>(null);
  const [department, setDepartment] = useState<{ name: string } | null>(null);
  const [followups, setFollowups] = useState<(ConversionFollowup & { performer_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!leadId || !sb()) { setLoading(false); return; }
    setLoading(true);

    const { data: leadData } = await sb()
      .from('hmis_conversion_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadData) {
      setLead(leadData as ConversionLead);

      const [patRes, docRes, deptRes, fuRes] = await Promise.all([
        sb().from('hmis_patients').select('first_name, last_name, uhid, phone_primary, gender, age_years').eq('id', leadData.patient_id).single(),
        leadData.consulting_doctor_id
          ? sb().from('hmis_staff').select('full_name').eq('id', leadData.consulting_doctor_id).single()
          : Promise.resolve({ data: null }),
        leadData.department_id
          ? sb().from('hmis_departments').select('name').eq('id', leadData.department_id).single()
          : Promise.resolve({ data: null }),
        sb().from('hmis_conversion_followups').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      ]);

      setPatient(patRes.data);
      setDoctor(docRes.data);
      setDepartment(deptRes.data);

      // Enrich followups with performer names
      const fups = (fuRes.data || []) as ConversionFollowup[];
      const performerIds = [...new Set(fups.map(f => f.performed_by))];
      if (performerIds.length > 0) {
        const { data: performers } = await sb().from('hmis_staff').select('id, full_name').in('id', performerIds);
        const nameMap = new Map((performers || []).map(p => [p.id, p.full_name]));
        setFollowups(fups.map(f => ({ ...f, performer_name: nameMap.get(f.performed_by) || 'Unknown' })));
      } else {
        setFollowups(fups);
      }
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);
  return { lead, patient, doctor, department, followups, loading, refetch: load };
}

// ---- Create Lead ----
export async function createConversionLead(params: {
  centre_id: string;
  patient_id: string;
  opd_visit_id?: string;
  consulting_doctor_id?: string;
  department_id?: string;
  visit_date: string;
  advised_procedure: string;
  advised_type?: string;
  diagnosis?: string;
  icd_code?: string;
  urgency?: string;
  estimated_cost?: number;
  estimated_stay_days?: number;
  patient_concern?: string;
  insurance_applicable?: boolean;
  insurance_coverage_pct?: number;
  created_by: string;
}) {
  const { data, error } = await sb()
    .from('hmis_conversion_leads')
    .insert(params)
    .select()
    .single();
  return { data, error };
}

// ---- Log Follow-up ----
export async function logFollowup(params: {
  lead_id: string;
  action_type: ActionType;
  action_description: string;
  outcome?: FollowupOutcome;
  next_followup_date?: string;
  performed_by: string;
}) {
  const { data, error } = await sb()
    .from('hmis_conversion_followups')
    .insert(params)
    .select()
    .single();
  return { data, error };
}

// ---- Update Lead Status ----
export async function updateLeadStatus(leadId: string, status: string, extra?: Record<string, unknown>) {
  const { data, error } = await sb()
    .from('hmis_conversion_leads')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', leadId)
    .select()
    .single();
  return { data, error };
}

// ---- Update Lead ----
export async function updateLead(leadId: string, updates: Record<string, unknown>) {
  const { data, error } = await sb()
    .from('hmis_conversion_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single();
  return { data, error };
}
