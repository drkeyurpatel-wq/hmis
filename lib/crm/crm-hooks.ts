// lib/crm/crm-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';
import { getLeadSquaredClient, getDialShreeClient } from '@/lib/crm/integrations';

// ============================================================
// LEADS
// ============================================================
export function useLeads(centreId: string | null) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; source?: string; assigned?: string; search?: string; priority?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_crm_leads')
      .select('*, assigned:hmis_staff!hmis_crm_leads_assigned_to_fkey(full_name), doctor:hmis_staff!hmis_crm_leads_interested_doctor_id_fkey(full_name), patient:hmis_patients(uhid, first_name, last_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.source && filters.source !== 'all') q = q.eq('source', filters.source);
    if (filters?.priority && filters.priority !== 'all') q = q.eq('priority', filters.priority);
    if (filters?.assigned) q = q.eq('assigned_to', filters.assigned);
    if (filters?.search) q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any, staffId: string): Promise<{ success: boolean; lead?: any; error?: string }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    const { data: lead, error } = await sb().from('hmis_crm_leads').insert({
      centre_id: centreId, ...data, assigned_to: data.assigned_to || staffId,
      assigned_at: new Date().toISOString(),
    }).select('*').single();
    if (error) return { success: false, error: error.message };
    // Push to LeadSquared if configured
    const ls = await getLeadSquaredClient(centreId);
    if (ls && lead) {
      const res = await ls.pushLead(lead);
      if (res.lsId) await sb().from('hmis_crm_leads').update({ leadsquared_id: res.lsId }).eq('id', lead.id);
    }
    load();
    return { success: true, lead };
  }, [centreId, load]);

  const update = useCallback(async (leadId: string, updates: any): Promise<{ success: boolean }> => {
    if (!sb()) return { success: false };
    await sb().from('hmis_crm_leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', leadId);
    load();
    return { success: true };
  }, [load]);

  const convert = useCallback(async (leadId: string, patientId: string, appointmentId?: string): Promise<{ success: boolean }> => {
    if (!sb()) return { success: false };
    await sb().from('hmis_crm_leads').update({
      status: 'converted', patient_id: patientId, appointment_id: appointmentId || null,
      converted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', leadId);
    load();
    return { success: true };
  }, [load]);

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    booked: leads.filter(l => l.status === 'appointment_booked').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    hot: leads.filter(l => l.priority === 'hot').length,
    totalValue: leads.reduce((s: number, l: any) => s + parseFloat(l.estimated_value || 0), 0),
    conversionRate: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'converted').length / leads.length) * 100) : 0,
    bySource: leads.reduce((acc: Record<string, number>, l: any) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {}),
    byDept: leads.reduce((acc: Record<string, number>, l: any) => { if (l.interested_department) acc[l.interested_department] = (acc[l.interested_department] || 0) + 1; return acc; }, {}),
  }), [leads]);

  return { leads, loading, stats, load, create, update, convert };
}

// ============================================================
// ACTIVITIES
// ============================================================
export function useActivities(leadId: string | null) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!leadId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_crm_activities')
      .select('*, performer:hmis_staff!hmis_crm_activities_performed_by_fkey(full_name)')
      .eq('lead_id', leadId).order('performed_at', { ascending: false }).limit(50);
    setActivities(data || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (data: any, staffId: string): Promise<{ success: boolean }> => {
    if (!leadId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_crm_activities').insert({
      lead_id: leadId, centre_id: data.centre_id, performed_by: staffId, ...data,
    });
    if (!error) load();
    return { success: !error };
  }, [leadId, load]);

  return { activities, loading, load, add };
}

// ============================================================
// CLICK-TO-CALL
// ============================================================
export function useClickToCall(centreId: string | null) {
  const call = useCallback(async (phoneNumber: string, leadId?: string): Promise<{ success: boolean; callId?: string; error?: string }> => {
    if (!centreId) return { success: false, error: 'No centre' };
    const ds = await getDialShreeClient(centreId);
    if (!ds) {
      // Fallback: tel: link
      if (typeof window !== 'undefined') window.open(`tel:${phoneNumber}`, '_self');
      return { success: true };
    }
    return ds.clickToCall(phoneNumber, leadId);
  }, [centreId]);

  return { call };
}

// ============================================================
// FOLLOW-UPS (due today / overdue)
// ============================================================
export function useFollowUps(centreId: string | null, staffId?: string) {
  const [followUps, setFollowUps] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    let q = sb().from('hmis_crm_activities')
      .select('*, lead:hmis_crm_leads!inner(first_name, last_name, phone, status, interested_department, priority)')
      .eq('centre_id', centreId).eq('follow_up_done', false)
      .lte('follow_up_date', tomorrow + 'T23:59:59')
      .order('follow_up_date', { ascending: true }).limit(50);
    if (staffId) q = q.eq('performed_by', staffId);
    const { data } = await q;
    setFollowUps(data || []);
  }, [centreId, staffId]);

  useEffect(() => { load(); }, [load]);

  const markDone = useCallback(async (activityId: string) => {
    if (!sb()) return;
    await sb().from('hmis_crm_activities').update({ follow_up_done: true }).eq('id', activityId);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: followUps.length,
      overdue: followUps.filter(f => f.follow_up_date?.split('T')[0] < today).length,
      today: followUps.filter(f => f.follow_up_date?.split('T')[0] === today).length,
    };
  }, [followUps]);

  return { followUps, stats, load, markDone };
}

// ============================================================
// CAMPAIGNS
// ============================================================
export function useCampaigns(centreId: string | null) {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_crm_campaigns').select('*').eq('centre_id', centreId)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }: any) => setCampaigns(data || []));
  }, [centreId]);

  const create = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_crm_campaigns').insert({ centre_id: centreId, created_by: staffId, ...data });
  }, [centreId]);

  return { campaigns, create };
}

// ============================================================
// PIPELINE (Kanban data)
// ============================================================
export const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'bg-gray-100 text-gray-700', dotColor: 'bg-gray-400' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700', dotColor: 'bg-blue-500' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-50 text-purple-700', dotColor: 'bg-purple-500' },
  { key: 'appointment_booked', label: 'Appt Booked', color: 'bg-amber-50 text-amber-700', dotColor: 'bg-amber-500' },
  { key: 'visited', label: 'Visited', color: 'bg-teal-50 text-teal-700', dotColor: 'bg-teal-500' },
  { key: 'converted', label: 'Converted', color: 'bg-emerald-50 text-emerald-700', dotColor: 'bg-emerald-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-50 text-red-700', dotColor: 'bg-red-500' },
];

export const LEAD_SOURCES = [
  'walk_in', 'phone', 'website', 'google_ads', 'facebook', 'instagram',
  'referral', 'camp', 'corporate', 'leadsquared', 'dialshree', 'whatsapp', 'other',
];
