// lib/lab/blood-bank-hooks.ts
// Blood Bank / Blood Storage Unit hooks

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'] as const;
const COMPONENT_TYPES = ['whole_blood','prbc','ffp','platelet_concentrate','cryoprecipitate','sdp','washed_rbc','leukoreduced_rbc','irradiated_rbc'] as const;
const EXPIRY_DAYS: Record<string, number> = {
  whole_blood: 35, prbc: 42, ffp: 365, platelet_concentrate: 5,
  cryoprecipitate: 365, sdp: 5, washed_rbc: 1, leukoreduced_rbc: 42, irradiated_rbc: 28,
  cryo_poor_plasma: 365, packed_platelets: 5, granulocyte: 1,
};

export { BLOOD_GROUPS, COMPONENT_TYPES, EXPIRY_DAYS };

// ============================================================
// DONORS
// ============================================================
export function useDonors(centreId: string | null) {
  const [donors, setDonors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_bb_donors').select('*').eq('centre_id', centreId).eq('is_active', true).order('created_at', { ascending: false }).limit(100);
    if (search) q = q.or(`first_name.ilike.%${search}%,donor_number.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data } = await q;
    setDonors(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const register = useCallback(async (donor: any) => {
    if (!centreId || !sb()) return null;
    const { data: num } = await sb().rpc('hmis_next_donor_number');
    const { data, error } = await sb().from('hmis_bb_donors').insert({
      ...donor, donor_number: num || `D-${Date.now()}`, centre_id: centreId,
    }).select().single();
    if (!error) load();
    return data;
  }, [centreId, load]);

  const defer = useCallback(async (donorId: string, reason: string, type: string, until?: string) => {
    if (!sb()) return;
    await sb().from('hmis_bb_donors').update({
      is_deferred: true, deferral_reason: reason, deferral_type: type, deferral_until: until || null,
    }).eq('id', donorId);
    load();
  }, [load]);

  return { donors, loading, load, register, defer };
}

// ============================================================
// DONATIONS
// ============================================================
export function useDonations(centreId: string | null) {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_bb_donations')
      .select('*, donor:hmis_bb_donors(donor_number, first_name, last_name, blood_group)')
      .eq('centre_id', centreId).order('donation_date', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setDonations(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const collect = useCallback(async (donorId: string, bagNumber: string, aboGroup: string, rhType: string, staffId: string, volumeMl?: number) => {
    if (!centreId || !sb()) return null;
    const { data: num } = await sb().rpc('hmis_next_donation_number');
    const { data, error } = await sb().from('hmis_bb_donations').insert({
      donation_number: num || `BLD-${Date.now()}`, donor_id: donorId,
      bag_number: bagNumber, abo_group: aboGroup, rh_type: rhType,
      volume_ml: volumeMl || 450, collected_by: staffId, centre_id: centreId,
      status: 'collected',
    }).select().single();
    if (!error) {
      // Update donor stats
      await sb().from('hmis_bb_donors').update({
        total_donations: sb().rpc ? undefined : 1, // increment via SQL better
        last_donation_date: new Date().toISOString().split('T')[0],
      }).eq('id', donorId);
      load();
    }
    return data;
  }, [centreId, load]);

  const updateTTI = useCallback(async (donationId: string, results: { hbsag: string; hcv: string; hiv: string; vdrl: string; malaria: string }) => {
    if (!sb()) return;
    const allNR = Object.values(results).every(r => r === 'non_reactive');
    await sb().from('hmis_bb_donations').update({
      hbsag_result: results.hbsag, hcv_result: results.hcv, hiv_result: results.hiv,
      vdrl_result: results.vdrl, malaria_result: results.malaria,
      tti_status: allNR ? 'non_reactive' : 'reactive',
      status: allNR ? 'available' : 'quarantine',
    }).eq('id', donationId);
    load();
  }, [load]);

  return { donations, loading, load, collect, updateTTI };
}

// ============================================================
// COMPONENTS & INVENTORY
// ============================================================
export function useInventory(centreId: string | null) {
  const [components, setComponents] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data: comp } = await sb().from('hmis_bb_components')
      .select('*, donation:hmis_bb_donations(donation_number, donor:hmis_bb_donors(first_name, last_name))')
      .eq('centre_id', centreId).in('status', ['available','reserved','crossmatched'])
      .order('expiry_date');
    setComponents(comp || []);

    // Aggregate inventory by group + component type
    const inv: Record<string, number> = {};
    (comp || []).forEach((c: any) => {
      if (c.status === 'available') {
        const key = `${c.blood_group}__${c.component_type}`;
        inv[key] = (inv[key] || 0) + 1;
      }
    });
    const invArr = Object.entries(inv).map(([k, v]) => {
      const [group, type] = k.split('__');
      return { bloodGroup: group, componentType: type, units: v };
    });
    setInventory(invArr);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const separate = useCallback(async (donationId: string, componentTypes: string[], staffId: string, bloodGroup: string) => {
    if (!centreId || !sb()) return;
    for (const cType of componentTypes) {
      const expiryDays = EXPIRY_DAYS[cType] || 35;
      const expiry = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];
      const compNum = `${cType.toUpperCase().replace(/_/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await sb().from('hmis_bb_components').insert({
        component_number: compNum, donation_id: donationId,
        component_type: cType, blood_group: bloodGroup,
        volume_ml: cType === 'prbc' ? 280 : cType === 'ffp' ? 200 : cType === 'platelet_concentrate' ? 50 : cType === 'cryoprecipitate' ? 20 : 450,
        prepared_date: new Date().toISOString().split('T')[0], expiry_date: expiry,
        prepared_by: staffId, centre_id: centreId, status: 'available',
      });
    }
    // Update donation status
    await sb().from('hmis_bb_donations').update({ status: 'separated' }).eq('id', donationId);
    load();
  }, [centreId, load]);

  const discard = useCallback(async (componentId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_bb_components').update({ status: 'discarded' }).eq('id', componentId);
    // Also update donation discard reason if needed
    load();
  }, [load]);

  return { components, inventory, loading, load, separate, discard };
}

// ============================================================
// CROSSMATCH
// ============================================================
export function useCrossmatch(centreId: string | null) {
  const [matches, setMatches] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_bb_crossmatch')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), component:hmis_bb_components(component_number, component_type, blood_group)')
      .eq('centre_id', centreId).order('requested_at', { ascending: false }).limit(50);
    setMatches(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const request = useCallback(async (patientId: string, admissionId: string | null, componentId: string, patientAbo: string, patientRh: string, staffId: string, urgency: string, indication?: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_bb_crossmatch').insert({
      patient_id: patientId, admission_id: admissionId, component_id: componentId,
      patient_abo: patientAbo, patient_rh: patientRh, requested_by: staffId,
      urgency, clinical_indication: indication, centre_id: centreId,
      valid_until: new Date(Date.now() + 72 * 3600000).toISOString(),
    });
    await sb().from('hmis_bb_components').update({ status: 'crossmatched', reserved_for_patient: patientId }).eq('id', componentId);
    load();
  }, [centreId, load]);

  const complete = useCallback(async (xmatchId: string, result: string, immediateSpin: string, incubation: string, ictAgt: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_bb_crossmatch').update({
      result, immediate_spin: immediateSpin, incubation_37c: incubation, ict_agt: ictAgt,
      performed_by: staffId, completed_at: new Date().toISOString(),
    }).eq('id', xmatchId);
    load();
  }, [load]);

  return { matches, load, request, complete };
}

// ============================================================
// BLOOD REQUESTS
// ============================================================
export function useBloodRequests(centreId: string | null) {
  const [requests, setRequests] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_bb_requests')
      .select('*, patient:hmis_patients(first_name, last_name, uhid, blood_group), doctor:hmis_staff!hmis_bb_requests_requested_by_fkey(full_name)')
      .eq('centre_id', centreId).order('requested_at', { ascending: false }).limit(50);
    setRequests(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (req: {
    patientId: string; admissionId?: string; bloodGroup: string; componentType: string;
    unitsRequested: number; urgency: string; indication?: string; diagnosis?: string;
    hbLevel?: number; plateletCount?: number; inr?: number;
  }, staffId: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_bb_requests').insert({
      patient_id: req.patientId, admission_id: req.admissionId || null,
      requested_by: staffId, blood_group: req.bloodGroup, component_type: req.componentType,
      units_requested: req.unitsRequested, urgency: req.urgency,
      clinical_indication: req.indication, diagnosis: req.diagnosis,
      hb_level: req.hbLevel, platelet_count: req.plateletCount, inr: req.inr,
      centre_id: centreId,
    });
    load();
  }, [centreId, load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    if (!sb()) return;
    await sb().from('hmis_bb_requests').update({ status }).eq('id', id);
    load();
  }, [load]);

  return { requests, load, create, updateStatus };
}

// ============================================================
// TRANSFUSIONS & REACTIONS
// ============================================================
export function useTransfusions(centreId: string | null) {
  const [transfusions, setTransfusions] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_bb_transfusions')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), component:hmis_bb_components(component_number, component_type, blood_group)')
      .eq('centre_id', centreId).order('issued_at', { ascending: false }).limit(50);
    setTransfusions(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const issue = useCallback(async (patientId: string, admissionId: string | null, componentId: string, crossmatchId: string | null, staffId: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_bb_transfusions').insert({
      patient_id: patientId, admission_id: admissionId, component_id: componentId,
      crossmatch_id: crossmatchId, issued_by: staffId, centre_id: centreId, status: 'issued',
    });
    await sb().from('hmis_bb_components').update({ status: 'issued' }).eq('id', componentId);
    load();
  }, [centreId, load]);

  const startTransfusion = useCallback(async (transfusionId: string, staffId: string, vitals: { temp: number; pulse: number; bpSys: number; bpDia: number }) => {
    if (!sb()) return;
    await sb().from('hmis_bb_transfusions').update({
      status: 'in_progress', transfusion_start: new Date().toISOString(), administered_by: staffId,
      pre_temp: vitals.temp, pre_pulse: vitals.pulse, pre_bp_sys: vitals.bpSys, pre_bp_dia: vitals.bpDia,
    }).eq('id', transfusionId);
    load();
  }, [load]);

  const completeTransfusion = useCallback(async (transfusionId: string, componentId: string, volumeMl: number, vitals: { temp: number; pulse: number; bpSys: number; bpDia: number }) => {
    if (!sb()) return;
    await sb().from('hmis_bb_transfusions').update({
      status: 'completed', transfusion_end: new Date().toISOString(), volume_transfused_ml: volumeMl,
      post_temp: vitals.temp, post_pulse: vitals.pulse, post_bp_sys: vitals.bpSys, post_bp_dia: vitals.bpDia,
    }).eq('id', transfusionId);
    await sb().from('hmis_bb_components').update({ status: 'transfused' }).eq('id', componentId);
    load();
  }, [load]);

  const reportReaction = useCallback(async (transfusionId: string, patientId: string, reactionType: string, severity: string, symptoms: string, actions: string, staffId: string) => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_bb_reactions').insert({
      transfusion_id: transfusionId, patient_id: patientId,
      reaction_type: reactionType, severity, symptoms, actions_taken: actions,
      reported_by: staffId,
    }).select().single();
    if (data) {
      await sb().from('hmis_bb_transfusions').update({ has_reaction: true, reaction_id: data.id, status: 'stopped' }).eq('id', transfusionId);
    }
    load();
  }, [load]);

  return { transfusions, load, issue, startTransfusion, completeTransfusion, reportReaction };
}
