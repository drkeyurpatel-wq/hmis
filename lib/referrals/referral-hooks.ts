// lib/referrals/referral-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface ReferringDoctor {
  id: string; name: string; phone: string; speciality: string;
  hospital_name: string; city: string; registration_number: string;
  default_fee_type: string; default_fee_pct: number; default_flat_amount: number;
  tds_pct: number; is_active: boolean;
  total_referrals: number; total_revenue: number; total_fees_paid: number;
}

export interface Referral {
  id: string; referral_type: string; status: string; urgency: string;
  patient_id: string; patient_name: string; uhid: string;
  referring_doctor_id: string | null; referring_doctor_name: string;
  referring_hospital: string; referring_city: string;
  internal_referring_staff_id: string | null; internal_staff_name: string | null;
  referred_to_doctor_id: string | null; referred_to_name: string;
  referred_to_department: string;
  reason: string; diagnosis: string;
  admission_id: string | null; bill_id: string | null;
  expected_revenue: number; actual_revenue: number;
  fee_type: string; referral_fee_pct: number; referral_fee_amount: number;
  fee_base_amount: number; tds_amount: number; net_fee_payable: number;
  fee_paid: boolean; payment_mode: string | null; payment_utr: string | null; payment_date: string | null;
  fee_services: any[];
  admitted_centre_id: string | null;
  created_at: string;
}

// ── Referring Doctor Master ──
export function useReferringDoctors() {
  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string) => {
    if (!sb()) return;
    setLoading(true);
    let q = sb().from('hmis_referring_doctors').select('*').eq('is_active', true).order('name');
    if (search) q = q.or(`name.ilike.%${search}%,hospital_name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data } = await q;
    setDoctors(data || []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: Partial<ReferringDoctor>) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_referring_doctors').insert(data);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const update = useCallback(async (id: string, data: Partial<ReferringDoctor>) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_referring_doctors').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  return { doctors, loading, load, create, update };
}

// ── Referrals ──
export function useReferrals(centreId: string | null) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; type?: string; doctorId?: string; month?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_referrals')
      .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid),
        referred_doc:hmis_staff!hmis_referrals_referred_to_doctor_id_fkey(full_name),
        ref_doctor:hmis_referring_doctors(name, hospital_name, default_fee_type, default_fee_pct),
        internal_staff:hmis_staff!hmis_referrals_internal_referring_staff_id_fkey(full_name)`)
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(500);

    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.type && filters.type !== 'all') q = q.eq('referral_type', filters.type);
    if (filters?.doctorId) q = q.eq('referring_doctor_id', filters.doctorId);
    if (filters?.month) q = q.gte('created_at', `${filters.month}-01`).lte('created_at', `${filters.month}-31T23:59:59`);

    const { data } = await q;
    setReferrals((data || []).map((r: any) => ({
      id: r.id, referral_type: r.referral_type, status: r.status, urgency: r.urgency || 'routine',
      patient_id: r.patient_id,
      patient_name: `${r.patient?.first_name || ''} ${r.patient?.last_name || ''}`.trim(),
      uhid: r.patient?.uhid || '',
      referring_doctor_id: r.referring_doctor_id,
      referring_doctor_name: r.ref_doctor?.name || r.referring_doctor_name || '',
      referring_hospital: r.ref_doctor?.hospital_name || r.referring_hospital || '',
      referring_city: r.referring_city || '',
      internal_referring_staff_id: r.internal_referring_staff_id,
      internal_staff_name: r.internal_staff?.full_name || null,
      referred_to_doctor_id: r.referred_to_doctor_id,
      referred_to_name: r.referred_doc?.full_name || '',
      referred_to_department: r.referred_to_department || '',
      reason: r.reason || '', diagnosis: r.diagnosis || '',
      admission_id: r.admission_id, bill_id: r.bill_id,
      expected_revenue: parseFloat(r.expected_revenue || 0),
      actual_revenue: parseFloat(r.actual_revenue || 0),
      fee_type: r.fee_type || r.ref_doctor?.default_fee_type || 'percentage',
      referral_fee_pct: parseFloat(r.referral_fee_pct || r.ref_doctor?.default_fee_pct || 0),
      referral_fee_amount: parseFloat(r.referral_fee_amount || 0),
      fee_base_amount: parseFloat(r.fee_base_amount || 0),
      tds_amount: parseFloat(r.tds_amount || 0),
      net_fee_payable: parseFloat(r.net_fee_payable || 0),
      fee_paid: r.fee_paid || false,
      payment_mode: r.payment_mode, payment_utr: r.payment_utr,
      payment_date: r.payment_date,
      fee_services: r.fee_services || [],
      admitted_centre_id: r.admitted_centre_id,
      created_at: r.created_at,
    })));
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { data: ref, error } = await sb().from('hmis_referrals').insert({ centre_id: centreId, ...data }).select('id').maybeSingle();
    if (!error) {
      // BRIDGE: Create clinical alert for receiving department
      try {
        const patientName = data.patient_name || 'Patient';
        const fromDept = data.referring_department || 'OPD';
        const toDept = data.to_department || data.department || 'Unknown';
        await sb().from('hmis_clinical_alerts').insert({
          centre_id: centreId, patient_id: data.patient_id || null,
          alert_type: 'referral', severity: data.urgency === 'emergency' ? 'critical' : 'info',
          title: `Referral: ${patientName} → ${toDept}`,
          description: `${fromDept} referred ${patientName} to ${toDept}. Reason: ${data.reason || 'N/A'}`,
          source: 'referral', source_ref_id: ref?.id || null,
          status: 'active',
        });
      } catch (e) { console.error('Referral alert failed:', e); }
      load();
    }
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_referrals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const calculateFee = useCallback(async (id: string) => {
    if (!sb()) return null;
    const { data, error } = await sb().rpc('hmis_calculate_referral_fee', { p_referral_id: id });
    if (!error) load();
    return data;
  }, [load]);

  const markPaid = useCallback(async (id: string, payment: { mode: string; utr?: string; date: string; approved_by: string }) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_referrals').update({
      fee_paid: true, payment_mode: payment.mode, payment_utr: payment.utr || null,
      payment_date: payment.date, fee_paid_date: payment.date,
      payment_approved_by: payment.approved_by,
      status: 'completed', updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const linkAdmission = useCallback(async (referralId: string, admissionId: string) => {
    if (!sb()) return;
    await sb().from('hmis_referrals').update({ admission_id: admissionId, status: 'admitted', updated_at: new Date().toISOString() }).eq('id', referralId);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = referrals.filter(r => r.created_at >= monthStart);
    const converted = referrals.filter(r => ['visited', 'admitted', 'completed'].includes(r.status));
    const unpaid = referrals.filter(r => r.referral_fee_amount > 0 && !r.fee_paid);

    // Group by referring doctor
    const byDoctor: Record<string, { name: string; hospital: string; count: number; revenue: number; fees: number; unpaid: number }> = {};
    referrals.forEach(r => {
      const key = r.referring_doctor_id || r.referring_doctor_name || 'Unknown';
      if (!byDoctor[key]) byDoctor[key] = { name: r.referring_doctor_name, hospital: r.referring_hospital, count: 0, revenue: 0, fees: 0, unpaid: 0 };
      byDoctor[key].count++;
      byDoctor[key].revenue += r.actual_revenue;
      byDoctor[key].fees += r.fee_paid ? r.referral_fee_amount : 0;
      if (!r.fee_paid && r.referral_fee_amount > 0) byDoctor[key].unpaid += r.net_fee_payable;
    });

    const topDoctors = Object.values(byDoctor).sort((a, b) => b.revenue - a.revenue).slice(0, 15);

    // By status
    const byStatus: Record<string, number> = {};
    referrals.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    // By department
    const byDept: Record<string, { count: number; revenue: number }> = {};
    referrals.forEach(r => {
      const d = r.referred_to_department || 'Unassigned';
      if (!byDept[d]) byDept[d] = { count: 0, revenue: 0 };
      byDept[d].count++;
      byDept[d].revenue += r.actual_revenue;
    });

    return {
      total: referrals.length,
      thisMonth: thisMonth.length,
      converted: converted.length,
      conversionRate: referrals.length > 0 ? Math.round(converted.length / referrals.length * 100) : 0,
      totalRevenue: referrals.reduce((s, r) => s + r.actual_revenue, 0),
      totalFeesPaid: referrals.filter(r => r.fee_paid).reduce((s, r) => s + r.referral_fee_amount, 0),
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((s, r) => s + r.net_fee_payable, 0),
      topDoctors, byStatus, byDept,
    };
  }, [referrals]);

  return { referrals, loading, stats, load, create, update, calculateFee, markPaid, linkAdmission };
}
