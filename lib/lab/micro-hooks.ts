// lib/lab/micro-hooks.ts
// Microbiology module hooks — culture, sensitivity, antibiogram

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// ORGANISM & ANTIBIOTIC MASTERS
// ============================================================
export function useOrganismMaster() {
  const [organisms, setOrganisms] = useState<any[]>([]);
  const [antibiotics, setAntibiotics] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const [{ data: org }, { data: abx }, { data: pan }] = await Promise.all([
      sb().from('hmis_lab_organisms').select('*').eq('is_active', true).order('organism_name'),
      sb().from('hmis_lab_antibiotics').select('*').eq('is_active', true).order('sort_order'),
      sb().from('hmis_lab_antibiotic_panels').select('*, antibiotic:hmis_lab_antibiotics(*)').order('sort_order'),
    ]);
    setOrganisms(org || []);
    setAntibiotics(abx || []);
    setPanels(pan || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getPanelForOrganism = useCallback((organismType: string) => {
    const panelName = organismType === 'bacteria_gn' ? 'GN_Systemic' :
      organismType === 'bacteria_gp' ? 'GP_General' :
      organismType === 'fungi' ? 'Fungal' : 'GN_Urinary';
    return panels.filter(p => p.panel_name === panelName);
  }, [panels]);

  return { organisms, antibiotics, panels, load, getPanelForOrganism };
}

// ============================================================
// CULTURE WORKFLOW
// ============================================================
export function useCulture(orderId: string | null) {
  const [culture, setCulture] = useState<any>(null);
  const [isolates, setIsolates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !sb()) return;
    setLoading(true);
    const { data: c } = await sb().from('hmis_lab_cultures').select('*').eq('order_id', orderId).single();
    setCulture(c);
    if (c) {
      const { data: iso } = await sb().from('hmis_lab_culture_isolates')
        .select('*, organism:hmis_lab_organisms(*), sensitivities:hmis_lab_sensitivity(*, antibiotic:hmis_lab_antibiotics(antibiotic_code, antibiotic_name, antibiotic_class, is_restricted))')
        .eq('culture_id', c.id).order('isolate_number');
      setIsolates(iso || []);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Create or get culture record
  const initCulture = useCallback(async (specimenType: string, specimenSource?: string) => {
    if (!orderId || !sb()) return null;
    if (culture) return culture;
    const { data, error } = await sb().from('hmis_lab_cultures').insert({
      order_id: orderId, specimen_type: specimenType, specimen_source: specimenSource,
      incubation_start: new Date().toISOString(), culture_status: 'incubating',
    }).select().single();
    if (!error) { setCulture(data); return data; }
    return null;
  }, [orderId, culture]);

  // Update culture status
  const updateCulture = useCallback(async (updates: any) => {
    if (!culture?.id || !sb()) return;
    await sb().from('hmis_lab_cultures').update(updates).eq('id', culture.id);
    load();
  }, [culture, load]);

  // Report no growth
  const reportNoGrowth = useCallback(async (staffId: string) => {
    if (!culture?.id || !sb()) return;
    await sb().from('hmis_lab_cultures').update({
      culture_status: 'no_growth', is_sterile: true, final_report: 'No bacterial growth after 48 hours of incubation.',
      reported_by: staffId, reported_at: new Date().toISOString(),
    }).eq('id', culture.id);
    // Update order status
    await sb().from('hmis_lab_orders').update({ status: 'completed', reported_at: new Date().toISOString(), reported_by: staffId }).eq('id', orderId);
    load();
  }, [culture, orderId, load]);

  // Add isolate
  const addIsolate = useCallback(async (organismId: string, quantity: string, morphology?: string, notes?: string) => {
    if (!culture?.id || !sb()) return;
    const nextNum = isolates.length + 1;
    await sb().from('hmis_lab_culture_isolates').insert({
      culture_id: culture.id, organism_id: organismId, isolate_number: nextNum,
      quantity, colony_morphology: morphology, notes, is_significant: true,
    });
    await sb().from('hmis_lab_cultures').update({ culture_status: 'growth', growth_description: `${nextNum} organism(s) isolated` }).eq('id', culture.id);
    load();
  }, [culture, isolates, load]);

  // Add sensitivity result for an isolate
  const addSensitivity = useCallback(async (isolateId: string, antibioticId: string, interpretation: string, zoneMm?: number, mic?: number, method?: string) => {
    if (!sb()) return;
    await sb().from('hmis_lab_sensitivity').upsert({
      isolate_id: isolateId, antibiotic_id: antibioticId, interpretation,
      zone_diameter_mm: zoneMm || null, mic_value: mic || null,
      method: method || 'disc_diffusion',
    }, { onConflict: 'isolate_id,antibiotic_id' });
    load();
  }, [load]);

  // Batch save sensitivities
  const saveSensitivities = useCallback(async (isolateId: string, results: { antibioticId: string; interpretation: string; zoneMm?: number; mic?: number }[]) => {
    if (!sb()) return;
    const inserts = results.map(r => ({
      isolate_id: isolateId, antibiotic_id: r.antibioticId,
      interpretation: r.interpretation, zone_diameter_mm: r.zoneMm || null,
      mic_value: r.mic || null, method: 'disc_diffusion',
    }));
    for (const ins of inserts) {
      await sb().from('hmis_lab_sensitivity').upsert(ins, { onConflict: 'isolate_id,antibiotic_id' });
    }
    load();
  }, [load]);

  // Finalize culture report
  const finalizeCulture = useCallback(async (finalReport: string, staffId: string) => {
    if (!culture?.id || !sb()) return;
    await sb().from('hmis_lab_cultures').update({
      final_report: finalReport, reported_by: staffId, reported_at: new Date().toISOString(),
    }).eq('id', culture.id);
    await sb().from('hmis_lab_orders').update({ status: 'completed', reported_at: new Date().toISOString(), reported_by: staffId }).eq('id', orderId);
    load();
  }, [culture, orderId, load]);

  // Verify culture
  const verifyCulture = useCallback(async (staffId: string) => {
    if (!culture?.id || !sb()) return;
    await sb().from('hmis_lab_cultures').update({
      verified_by: staffId, verified_at: new Date().toISOString(),
    }).eq('id', culture.id);
    await sb().from('hmis_lab_orders').update({ verified_at: new Date().toISOString(), verified_by: staffId }).eq('id', orderId);
    load();
  }, [culture, orderId, load]);

  return { culture, isolates, loading, load, initCulture, updateCulture, reportNoGrowth, addIsolate, addSensitivity, saveSensitivities, finalizeCulture, verifyCulture };
}

// ============================================================
// ANTIBIOGRAM
// ============================================================
export function useAntibiogram(centreId: string | null) {
  const [data, setData] = useState<any[]>([]);

  const load = useCallback(async (periodStart?: string, periodEnd?: string) => {
    if (!centreId || !sb()) return;
    let q = sb().from('hmis_lab_antibiogram')
      .select('*, organism:hmis_lab_organisms(organism_name, organism_type), antibiotic:hmis_lab_antibiotics(antibiotic_name, antibiotic_code)')
      .eq('centre_id', centreId);
    if (periodStart) q = q.gte('period_start', periodStart);
    if (periodEnd) q = q.lte('period_end', periodEnd);
    const { data: d } = await q.order('organism_id').order('antibiotic_id');
    setData(d || []);
  }, [centreId]);

  // Generate antibiogram from raw sensitivity data
  const generate = useCallback(async (periodStart: string, periodEnd: string) => {
    if (!centreId || !sb()) return;
    // Fetch all sensitivities in period
    const { data: sens } = await sb().from('hmis_lab_sensitivity')
      .select('interpretation, antibiotic_id, isolate:hmis_lab_culture_isolates!inner(organism_id, culture:hmis_lab_cultures!inner(created_at))')
      .gte('isolate.culture.created_at', periodStart + 'T00:00:00')
      .lte('isolate.culture.created_at', periodEnd + 'T23:59:59');
    if (!sens?.length) return;

    // Aggregate
    const agg: Record<string, { total: number; S: number; I: number; R: number }> = {};
    sens.forEach((s: any) => {
      const key = `${s.isolate.organism_id}__${s.antibiotic_id}`;
      if (!agg[key]) agg[key] = { total: 0, S: 0, I: 0, R: 0 };
      agg[key].total++;
      if (s.interpretation === 'S') agg[key].S++;
      else if (s.interpretation === 'I') agg[key].I++;
      else if (s.interpretation === 'R') agg[key].R++;
    });

    // Upsert
    for (const [key, val] of Object.entries(agg)) {
      const [orgId, abxId] = key.split('__');
      await sb().from('hmis_lab_antibiogram').upsert({
        centre_id: centreId, period_start: periodStart, period_end: periodEnd,
        organism_id: orgId, antibiotic_id: abxId,
        total_isolates: val.total, sensitive_count: val.S,
        intermediate_count: val.I, resistant_count: val.R,
      }, { onConflict: 'centre_id,period_start,period_end,organism_id,antibiotic_id' });
    }
    load(periodStart, periodEnd);
  }, [centreId, load]);

  return { data, load, generate };
}
