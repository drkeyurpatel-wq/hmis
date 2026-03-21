// lib/modules/module-hooks.ts
// Hooks for: Emergency, Dietary, CSSD, Dialysis, CathLab, Endoscopy, Physio, Referrals, Packages
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ═══ 1. EMERGENCY / TRIAGE ═══
export function useEmergency(centreId: string | null) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_er_visits')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender), doctor:hmis_staff!hmis_er_visits_attending_doctor_id_fkey(full_name), triage_staff:hmis_staff!hmis_er_visits_triage_by_fkey(full_name)')
      .eq('centre_id', centreId).gte('arrival_time', d + 'T00:00:00').order('arrival_time', { ascending: false }).limit(100);
    setVisits(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const register = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_er_visits').insert({ centre_id: centreId, triage_by: staffId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateStatus = useCallback(async (id: string, status: string, extras?: any) => {
    if (!sb()) return;
    await sb().from('hmis_er_visits').update({ status, ...extras, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: visits.length,
    red: visits.filter(v => v.triage_category === 'red').length,
    orange: visits.filter(v => v.triage_category === 'orange').length,
    yellow: visits.filter(v => v.triage_category === 'yellow').length,
    green: visits.filter(v => v.triage_category === 'green').length,
    mlc: visits.filter(v => v.is_mlc).length,
    active: visits.filter(v => !['discharged', 'admitted', 'referred', 'expired'].includes(v.status)).length,
  }), [visits]);

  return { visits, loading, stats, load, register, updateStatus };
}

// ═══ 2. DIETARY / KITCHEN ═══
export function useDietary(centreId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [o, m] = await Promise.all([
      sb().from('hmis_diet_orders').select('*, patient:hmis_patients!inner(first_name, last_name, uhid), admission:hmis_admissions(ipd_number, bed:hmis_beds(name, room:hmis_rooms(name, ward:hmis_wards(name))))')
        .eq('centre_id', centreId).eq('status', 'active').order('created_at', { ascending: false }),
      sb().from('hmis_meal_service').select('*, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('service_date', new Date().toISOString().split('T')[0]).order('created_at', { ascending: false }),
    ]);
    setOrders(o.data || []);
    setMeals(m.data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const createOrder = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_diet_orders').insert({ centre_id: centreId, ordered_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const serveMeal = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_meal_service').insert({ centre_id: centreId, served_by: staffId, served_at: new Date().toISOString(), ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      activeOrders: orders.length,
      mealsServed: meals.length,
      mealsNotServed: orders.length - meals.filter(m => m.consumed && m.consumed !== 'npo').length,
      byDietType: orders.reduce((a: Record<string, number>, o: any) => { a[o.diet_type] = (a[o.diet_type] || 0) + 1; return a; }, {}),
    };
  }, [orders, meals]);

  return { orders, meals, loading, stats, load, createOrder, serveMeal };
}

// ═══ 3. CSSD ═══
export function useCssd(centreId: string | null) {
  const [sets, setSets] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [s, c] = await Promise.all([
      sb().from('hmis_cssd_instrument_sets').select('*').eq('centre_id', centreId).order('set_name'),
      sb().from('hmis_cssd_cycles').select('*, operator:hmis_staff!hmis_cssd_cycles_operator_id_fkey(full_name)')
        .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50),
    ]);
    setSets(s.data || []);
    setCycles(c.data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const createSet = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_cssd_instrument_sets').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const startCycle = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const cycleNum = `CY-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_cssd_cycles').insert({ centre_id: centreId, cycle_number: cycleNum, operator_id: staffId, start_time: new Date().toISOString(), ...data });
    // Update set statuses
    for (const item of (data.load_items || [])) {
      if (item.set_id) await sb().from('hmis_cssd_instrument_sets').update({ status: 'sterilizing' }).eq('id', item.set_id);
    }
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const completeCycle = useCallback(async (cycleId: string, biResult: string) => {
    if (!sb()) return;
    const { data: cycle } = await sb().from('hmis_cssd_cycles').select('load_items').eq('id', cycleId).single();
    await sb().from('hmis_cssd_cycles').update({ status: biResult === 'pass' ? 'completed' : 'failed', bi_test_result: biResult, end_time: new Date().toISOString() }).eq('id', cycleId);
    if (biResult === 'pass' && cycle?.load_items) {
      for (const item of cycle.load_items) {
        if (item.set_id) await sb().from('hmis_cssd_instrument_sets').update({ status: 'available', last_sterilized_at: new Date().toISOString(), sterilization_count: sb().rpc ? undefined : 0 }).eq('id', item.set_id);
      }
    }
    load();
  }, [load]);

  const issueSet = useCallback(async (setId: string, issuedTo: string, staffId: string, otBookingId?: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_cssd_issue_return').insert({ centre_id: centreId, set_id: setId, issued_to: issuedTo, issued_by: staffId, ot_booking_id: otBookingId || null });
    await sb().from('hmis_cssd_instrument_sets').update({ status: 'in_use' }).eq('id', setId);
    load();
  }, [centreId, load]);

  const returnSet = useCallback(async (issueId: string, setId: string, condition: string, staffId: string, missingItems?: any[]) => {
    if (!sb()) return;
    await sb().from('hmis_cssd_issue_return').update({ returned_at: new Date().toISOString(), returned_by: staffId, condition_on_return: condition, missing_items: missingItems || [] }).eq('id', issueId);
    await sb().from('hmis_cssd_instrument_sets').update({ status: 'available' }).eq('id', setId);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    totalSets: sets.length,
    available: sets.filter(s => s.status === 'available').length,
    inUse: sets.filter(s => s.status === 'in_use').length,
    sterilizing: sets.filter(s => s.status === 'sterilizing').length,
    cyclesToday: cycles.filter(c => c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length,
    failedCycles: cycles.filter(c => c.status === 'failed').length,
  }), [sets, cycles]);

  return { sets, cycles, loading, stats, load, createSet, startCycle, completeCycle, issueSet, returnSet };
}

// ═══ 4. DIALYSIS ═══
export function useDialysis(centreId: string | null) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const [s, m] = await Promise.all([
      sb().from('hmis_dialysis_sessions').select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years), machine:hmis_dialysis_machines(machine_number), tech:hmis_staff!hmis_dialysis_sessions_technician_id_fkey(full_name), doctor:hmis_staff!hmis_dialysis_sessions_doctor_id_fkey(full_name)')
        .eq('centre_id', centreId).eq('session_date', d).order('actual_start', { ascending: true }),
      sb().from('hmis_dialysis_machines').select('*').eq('centre_id', centreId).eq('is_active', true).order('machine_number'),
    ]);
    setSessions(s.data || []);
    setMachines(m.data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const scheduleSession = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_dialysis_sessions').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateSession = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_dialysis_sessions').update(updates).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    totalToday: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    inProgress: sessions.filter(s => s.status === 'in_progress').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    machinesAvailable: machines.filter(m => m.status === 'available').length,
    machinesInUse: machines.filter(m => m.status === 'in_use').length,
    machinesTotal: machines.length,
  }), [sessions, machines]);

  return { sessions, machines, loading, stats, load, scheduleSession, updateSession };
}

// ═══ 5. CATH LAB ═══
export function useCathLab(centreId: string | null) {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_cathlab_procedures')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender), operator:hmis_staff!hmis_cathlab_procedures_primary_operator_fkey(full_name)')
      .eq('centre_id', centreId).eq('procedure_date', d).order('start_time', { ascending: true });
    setProcedures(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_cathlab_procedures').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const updateProcedure = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_cathlab_procedures').update(updates).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: procedures.length,
    cag: procedures.filter(p => p.procedure_type === 'cag').length,
    ptca: procedures.filter(p => p.procedure_type === 'ptca').length,
    ppi: procedures.filter(p => p.procedure_type === 'ppi').length,
    completed: procedures.filter(p => p.procedure_status === 'completed').length,
    inProgress: procedures.filter(p => p.procedure_status === 'in_progress').length,
  }), [procedures]);

  return { procedures, loading, stats, load, schedule, updateProcedure };
}

// ═══ 6. ENDOSCOPY ═══
export function useEndoscopy(centreId: string | null) {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_endoscopy_procedures')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender), endoscopist:hmis_staff!hmis_endoscopy_procedures_endoscopist_id_fkey(full_name)')
      .eq('centre_id', centreId).eq('procedure_date', d).order('start_time', { ascending: true });
    setProcedures(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_endoscopy_procedures').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const updateProcedure = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_endoscopy_procedures').update(updates).eq('id', id);
    load();
  }, [load]);

  return { procedures, loading, load, schedule, updateProcedure };
}

// ═══ 7. PHYSIOTHERAPY ═══
export function usePhysio(centreId: string | null) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const [s, p] = await Promise.all([
      sb().from('hmis_physio_sessions').select('*, patient:hmis_patients!inner(first_name, last_name, uhid), therapist:hmis_staff!hmis_physio_sessions_therapist_id_fkey(full_name)')
        .eq('centre_id', centreId).eq('session_date', d).order('created_at', { ascending: false }),
      sb().from('hmis_physio_plans').select('*, patient:hmis_patients!inner(first_name, last_name, uhid), therapist:hmis_staff!hmis_physio_plans_therapist_id_fkey(full_name)')
        .eq('centre_id', centreId).eq('status', 'active'),
    ]);
    setSessions(s.data || []);
    setPlans(p.data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const createSession = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_physio_sessions').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const updateSession = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_physio_sessions').update(updates).eq('id', id);
    load();
  }, [load]);

  const createPlan = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_physio_plans').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    todaySessions: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    activePlans: plans.length,
    noShows: sessions.filter(s => s.status === 'no_show').length,
  }), [sessions, plans]);

  return { sessions, plans, loading, stats, load, createSession, updateSession, createPlan };
}

// ═══ 8. REFERRALS ═══
export function useReferrals(centreId: string | null) {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; type?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_referrals')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid), referred_doc:hmis_staff!hmis_referrals_referred_to_doctor_id_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.type && filters.type !== 'all') q = q.eq('referral_type', filters.type);
    const { data } = await q;
    setReferrals(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_referrals').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_referrals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: referrals.length,
    thisMonth: referrals.filter(r => r.created_at >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).length,
    converted: referrals.filter(r => ['visited', 'admitted', 'completed'].includes(r.status)).length,
    revenue: referrals.reduce((s: number, r: any) => s + parseFloat(r.actual_revenue || 0), 0),
    feesPending: referrals.filter(r => parseFloat(r.referral_fee_amount || 0) > 0 && !r.fee_paid).length,
    feesPendingAmt: referrals.filter(r => !r.fee_paid).reduce((s: number, r: any) => s + parseFloat(r.referral_fee_amount || 0), 0),
    topReferrers: Object.entries(referrals.reduce((a: Record<string, number>, r: any) => { const n = r.referring_doctor_name || 'Unknown'; a[n] = (a[n] || 0) + 1; return a; }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10),
    conversionRate: referrals.length > 0 ? Math.round((referrals.filter(r => ['visited', 'admitted', 'completed'].includes(r.status)).length / referrals.length) * 100) : 0,
  }), [referrals]);

  return { referrals, loading, stats, load, create, update };
}

// ═══ 9. PACKAGES ═══
export function usePackages(centreId: string | null) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_packages').select('*').eq('centre_id', centreId).eq('is_active', true).order('package_name');
    if (search) q = q.ilike('package_name', `%${search}%`);
    const { data } = await q;
    setPackages(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const code = `PKG-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_packages').insert({ centre_id: centreId, package_code: code, created_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_packages').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: packages.length,
    byCategory: packages.reduce((a: Record<string, number>, p: any) => { a[p.category || 'other'] = (a[p.category || 'other'] || 0) + 1; return a; }, {}),
    byDepartment: packages.reduce((a: Record<string, number>, p: any) => { if (p.department) a[p.department] = (a[p.department] || 0) + 1; return a; }, {}),
  }), [packages]);

  return { packages, loading, stats, load, create, update };
}

// ═══ 10. DISCHARGE PLANNING ═══
export function useDischargeChecklist(admissionId: string | null) {
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_discharge_checklists').select('*').eq('admission_id', admissionId).maybeSingle();
    setChecklist(data);
    setLoading(false);
  }, [admissionId]);
  useEffect(() => { load(); }, [load]);

  const initChecklist = useCallback(async (centreId: string) => {
    if (!admissionId || !sb()) return;
    const { data } = await sb().from('hmis_discharge_checklists').insert({ admission_id: admissionId, centre_id: centreId }).select('*').single();
    setChecklist(data);
  }, [admissionId]);

  const updateItem = useCallback(async (field: string, value: boolean) => {
    if (!checklist || !sb()) return;
    await sb().from('hmis_discharge_checklists').update({ [field]: value }).eq('id', checklist.id);
    setChecklist((prev: any) => prev ? { ...prev, [field]: value } : prev);
  }, [checklist]);

  const complete = useCallback(async (staffId: string) => {
    if (!checklist || !sb()) return;
    await sb().from('hmis_discharge_checklists').update({ status: 'completed', completed_by: staffId, completed_at: new Date().toISOString() }).eq('id', checklist.id);
    load();
  }, [checklist, load]);

  const completedCount = checklist ? Object.entries(checklist).filter(([k, v]) => typeof v === 'boolean' && v === true).length : 0;
  const totalItems = 16; // count of boolean fields
  const progress = Math.round((completedCount / totalItems) * 100);

  return { checklist, loading, progress, completedCount, totalItems, load, initChecklist, updateItem, complete };
}
