// lib/revenue/phase2-hooks.ts
// Supabase hooks for Phase 2: IPD, Radiology, OT, Insurance, Accounting, Reports

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendDischargeAlert } from '@/lib/notifications/whatsapp';

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (typeof window === 'undefined') return null as any;
  if (!_sb) { try { _sb = createClient(); } catch { return null as any; } }
  return _sb;
}

// ============================================================
// IPD / ADMISSIONS
// ============================================================
export interface Admission {
  id: string; ipdNumber: string; patientName: string; patientUhid: string; patientId: string;
  admittingDoctor: string; primaryDoctor: string; department: string;
  admissionType: string; admissionDate: string; expectedDischarge: string | null;
  actualDischarge: string | null; dischargeType: string | null;
  payorType: string; provisionalDiagnosis: string | null; status: string;
  bedNumber: string | null; wardName: string | null;
}

export function useIPD(centreId: string | null) {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAdmissions = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let query = sb().from('hmis_admissions')
      .select(`id, ipd_number, admission_type, admission_date, expected_discharge, actual_discharge, discharge_type, payor_type, provisional_diagnosis, status,
        patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender),
        admitting_doctor:hmis_staff!hmis_admissions_admitting_doctor_id_fkey(full_name),
        primary_doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
        department:hmis_departments!inner(name)`)
      .eq('centre_id', centreId).order('admission_date', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setAdmissions((data || []).map((a: any) => ({
      id: a.id, ipdNumber: a.ipd_number,
      patientName: a.patient.first_name + ' ' + (a.patient.last_name || ''),
      patientUhid: a.patient.uhid, patientId: a.patient.id,
      admittingDoctor: a.admitting_doctor?.full_name || '', primaryDoctor: a.primary_doctor?.full_name || '',
      department: a.department?.name || '', admissionType: a.admission_type,
      admissionDate: a.admission_date, expectedDischarge: a.expected_discharge,
      actualDischarge: a.actual_discharge, dischargeType: a.discharge_type,
      payorType: a.payor_type, provisionalDiagnosis: a.provisional_diagnosis, status: a.status,
      bedNumber: null, wardName: null,
    })));
    setLoading(false);
  }, [centreId]);

  const loadBeds = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_beds')
      .select('id, bed_number, status, room:hmis_rooms!inner(name, ward:hmis_wards!inner(name))')
      .eq('is_active', true).order('bed_number');
    setBeds(data || []);
  }, [centreId]);

  useEffect(() => { loadAdmissions('active'); loadBeds(); }, [loadAdmissions, loadBeds]);

  const admitPatient = useCallback(async (data: {
    patientId: string; admittingDoctorId: string; primaryDoctorId: string; departmentId: string;
    bedId?: string; admissionType: string; payorType: string; provisionalDiagnosis?: string; expectedDischarge?: string;
  }) => {
    if (!centreId || !sb()) return null;
    const { data: ipdNum } = await sb().rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'ipd' });
    const { data: admission, error } = await sb().from('hmis_admissions').insert({
      centre_id: centreId, patient_id: data.patientId, ipd_number: ipdNum || 'IPD-' + Date.now(),
      admitting_doctor_id: data.admittingDoctorId, primary_doctor_id: data.primaryDoctorId,
      department_id: data.departmentId, bed_id: data.bedId || null,
      admission_type: data.admissionType, admission_date: new Date().toISOString(),
      expected_discharge: data.expectedDischarge || null, payor_type: data.payorType,
      provisional_diagnosis: data.provisionalDiagnosis || null, status: 'active',
    }).select().single();
    if (data.bedId && !error) {
      await sb().from('hmis_beds').update({ status: 'occupied', current_admission_id: admission?.id }).eq('id', data.bedId);
    }
    if (!error) loadAdmissions('active');
    return { admission, error };
  }, [centreId, loadAdmissions]);

  const dischargePatient = useCallback(async (admissionId: string, dischargeType: string, finalDiagnosis?: string) => {
    if (!sb()) return;
    // Get patient info for WhatsApp before updating
    const { data: admInfo } = await sb().from('hmis_admissions')
      .select('bed_id, ipd_number, patient:hmis_patients!inner(phone_primary, first_name)')
      .eq('id', admissionId).single();
    await sb().from('hmis_admissions').update({
      status: 'discharged', actual_discharge: new Date().toISOString(),
      discharge_type: dischargeType, final_diagnosis: finalDiagnosis || null,
    }).eq('id', admissionId);
    // Free the bed
    if (admInfo?.bed_id) await sb().from('hmis_beds').update({ status: 'available', current_admission_id: null }).eq('id', admInfo.bed_id);
    // WhatsApp: discharge alert
    try {
      const pt = (admInfo as any)?.patient;
      if (pt?.phone_primary) {
        sendDischargeAlert(pt.phone_primary, pt.first_name || 'Patient', admInfo?.ipd_number || '', new Date().toLocaleDateString('en-IN'), 'As advised by doctor');
      }
    } catch { /* non-blocking */ }
    loadAdmissions('active');
  }, [loadAdmissions]);

  const initiateDischarge = useCallback(async (admissionId: string) => {
    if (!sb()) return;
    await sb().from('hmis_admissions').update({ status: 'discharge_initiated' }).eq('id', admissionId);
    loadAdmissions('active');
  }, [loadAdmissions]);

  return { admissions, beds, loading, loadAdmissions, loadBeds, admitPatient, dischargePatient, initiateDischarge };
}

// ============================================================
// OT SCHEDULING
// ============================================================
export interface OTBooking {
  id: string; patientName: string; patientUhid: string; surgeonName: string;
  anaesthetistName: string | null; procedureName: string; otRoom: string;
  scheduledDate: string; scheduledStart: string; estimatedDuration: number | null;
  actualStart: string | null; actualEnd: string | null; status: string;
  admissionId: string; ipdNumber: string;
}

export function useOT(centreId: string | null) {
  const [bookings, setBookings] = useState<OTBooking[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBookings = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const dt = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_ot_bookings')
      .select(`id, procedure_name, scheduled_date, scheduled_start, estimated_duration_min, actual_start, actual_end, status,
        admission:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid)),
        ot_room:hmis_ot_rooms!inner(name),
        surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
        anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name)`)
      .eq('scheduled_date', dt).order('scheduled_start');
    setBookings((data || []).map((b: any) => ({
      id: b.id, patientName: b.admission.patient.first_name + ' ' + (b.admission.patient.last_name || ''),
      patientUhid: b.admission.patient.uhid, surgeonName: b.surgeon?.full_name || '',
      anaesthetistName: b.anaesthetist?.full_name, procedureName: b.procedure_name,
      otRoom: b.ot_room.name, scheduledDate: b.scheduled_date, scheduledStart: b.scheduled_start,
      estimatedDuration: b.estimated_duration_min, actualStart: b.actual_start, actualEnd: b.actual_end,
      status: b.status, admissionId: b.admission.id || '', ipdNumber: b.admission.ipd_number,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => {
    if (!centreId || !sb()) return;
    async function loadRooms() {
      const { data } = await sb().from('hmis_ot_rooms').select('*').eq('centre_id', centreId).eq('is_active', true);
      setRooms(data || []);
    }
    loadRooms(); loadBookings();
  }, [centreId, loadBookings]);

  const createBooking = useCallback(async (data: {
    admissionId: string; otRoomId: string; surgeonId: string; anaesthetistId?: string;
    procedureName: string; scheduledDate: string; scheduledStart: string; estimatedDuration?: number;
  }) => {
    if (!sb()) return null;
    const { data: booking, error } = await sb().from('hmis_ot_bookings').insert({
      admission_id: data.admissionId, ot_room_id: data.otRoomId, surgeon_id: data.surgeonId,
      anaesthetist_id: data.anaesthetistId || null, procedure_name: data.procedureName,
      scheduled_date: data.scheduledDate, scheduled_start: data.scheduledStart,
      estimated_duration_min: data.estimatedDuration || null, status: 'scheduled',
    }).select().single();
    if (!error) loadBookings();
    return { booking, error };
  }, [loadBookings]);

  const updateBookingStatus = useCallback(async (bookingId: string, status: string) => {
    if (!sb()) return;
    const updates: any = { status };
    if (status === 'in_progress') updates.actual_start = new Date().toISOString();
    if (status === 'completed') updates.actual_end = new Date().toISOString();
    await sb().from('hmis_ot_bookings').update(updates).eq('id', bookingId);
    loadBookings();
  }, [loadBookings]);

  return { bookings, rooms, loading, loadBookings, createBooking, updateBookingStatus };
}

// ============================================================
// INSURANCE / TPA
// ============================================================
export interface PreAuthRequest {
  id: string; admissionId: string; ipdNumber: string; patientName: string;
  requestedAmount: number; approvedAmount: number | null; status: string;
  preAuthNumber: string | null; submittedAt: string; respondedAt: string | null;
  insurerName: string; remarks: string | null;
}

export interface Claim {
  id: string; billNumber: string; patientName: string; claimNumber: string | null;
  claimType: string; claimedAmount: number; approvedAmount: number | null;
  settledAmount: number | null; status: string; submittedAt: string;
}

export function useInsurance(centreId: string | null) {
  const [preAuths, setPreAuths] = useState<PreAuthRequest[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPreAuths = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let query = sb().from('hmis_pre_auth_requests')
      .select(`id, requested_amount, approved_amount, status, pre_auth_number, submitted_at, responded_at, remarks,
        admission:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(first_name, last_name)),
        patient_insurance:hmis_patient_insurance!inner(insurer:hmis_insurers!inner(name))`)
      .order('submitted_at', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setPreAuths((data || []).map((p: any) => ({
      id: p.id, admissionId: p.admission?.id || '', ipdNumber: p.admission?.ipd_number || '',
      patientName: (p.admission?.patient?.first_name || '') + ' ' + (p.admission?.patient?.last_name || ''),
      requestedAmount: p.requested_amount, approvedAmount: p.approved_amount,
      status: p.status, preAuthNumber: p.pre_auth_number,
      submittedAt: p.submitted_at, respondedAt: p.responded_at,
      insurerName: p.patient_insurance?.insurer?.name || '', remarks: p.remarks,
    })));
    setLoading(false);
  }, [centreId]);

  const loadClaims = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    let query = sb().from('hmis_claims')
      .select(`id, claim_number, claim_type, claimed_amount, approved_amount, settled_amount, status, submitted_at,
        bill:hmis_bills!inner(bill_number, patient:hmis_patients!inner(first_name, last_name))`)
      .order('submitted_at', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setClaims((data || []).map((c: any) => ({
      id: c.id, billNumber: c.bill?.bill_number || '', patientName: (c.bill?.patient?.first_name || '') + ' ' + (c.bill?.patient?.last_name || ''),
      claimNumber: c.claim_number, claimType: c.claim_type, claimedAmount: c.claimed_amount,
      approvedAmount: c.approved_amount, settledAmount: c.settled_amount,
      status: c.status, submittedAt: c.submitted_at,
    })));
  }, [centreId]);

  useEffect(() => { loadPreAuths(); loadClaims(); }, [loadPreAuths, loadClaims]);

  const updatePreAuth = useCallback(async (id: string, updates: { status: string; approvedAmount?: number; preAuthNumber?: string; remarks?: string }) => {
    if (!sb()) return;
    const payload: any = { status: updates.status, responded_at: new Date().toISOString() };
    if (updates.approvedAmount !== undefined) payload.approved_amount = updates.approvedAmount;
    if (updates.preAuthNumber) payload.pre_auth_number = updates.preAuthNumber;
    if (updates.remarks) payload.remarks = updates.remarks;
    await sb().from('hmis_pre_auth_requests').update(payload).eq('id', id);
    loadPreAuths();
  }, [loadPreAuths]);

  return { preAuths, claims, loading, loadPreAuths, loadClaims, updatePreAuth };
}

// ============================================================
// ACCOUNTING / GL
// ============================================================
export function useAccounting(centreId: string | null) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_chart_of_accounts').select('*').eq('is_active', true).order('account_code');
    setAccounts(data || []);
  }, []);

  const loadJournals = useCallback(async (dateFrom?: string, dateTo?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let query = sb().from('hmis_journal_entries')
      .select(`id, entry_number, entry_date, description, source_type, is_auto, status, created_by,
        lines:hmis_journal_lines(id, debit, credit, account:hmis_chart_of_accounts(account_code, account_name))`)
      .eq('centre_id', centreId).order('entry_date', { ascending: false }).limit(100);
    if (dateFrom) query = query.gte('entry_date', dateFrom);
    if (dateTo) query = query.lte('entry_date', dateTo);
    const { data } = await query;
    setJournals(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadAccounts(); loadJournals(); }, [loadAccounts, loadJournals]);

  const createJournal = useCallback(async (description: string, lines: { accountId: string; debit: number; credit: number }[], staffId: string) => {
    if (!centreId || !sb()) return null;
    const entryNum = 'JE-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Date.now().toString(36).slice(-4).toUpperCase();
    const { data: je, error } = await sb().from('hmis_journal_entries').insert({
      centre_id: centreId, entry_number: entryNum, entry_date: new Date().toISOString().split('T')[0],
      description, created_by: staffId, status: 'draft',
    }).select().single();
    if (je && !error) {
      const jLines = lines.map(l => ({ journal_entry_id: je.id, account_id: l.accountId, debit: l.debit, credit: l.credit, cost_centre_id: centreId }));
      await sb().from('hmis_journal_lines').insert(jLines);
      loadJournals();
    }
    return { je, error };
  }, [centreId, loadJournals]);

  // Trial balance
  const getTrialBalance = useCallback(async () => {
    if (!centreId || !sb()) return [];
    const { data } = await sb().from('hmis_journal_lines')
      .select('debit, credit, account:hmis_chart_of_accounts(account_code, account_name, account_type)');
    const grouped: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {};
    (data || []).forEach((l: any) => {
      const key = l.account?.account_code || 'unknown';
      if (!grouped[key]) grouped[key] = { code: key, name: l.account?.account_name || '', type: l.account?.account_type || '', debit: 0, credit: 0 };
      grouped[key].debit += l.debit || 0;
      grouped[key].credit += l.credit || 0;
    });
    return Object.values(grouped).sort((a, b) => a.code.localeCompare(b.code));
  }, [centreId]);

  return { accounts, journals, loading, loadAccounts, loadJournals, createJournal, getTrialBalance };
}

// ============================================================
// REPORTS / MIS
// ============================================================
export function useReports(centreId: string | null) {
  const [loading, setLoading] = useState(false);

  const getRevenueReport = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return { daily: [], byType: [], byPayor: [], total: 0 };
    setLoading(true);
    const { data: bills } = await sb().from('hmis_bills')
      .select('bill_date, bill_type, payor_type, net_amount, paid_amount, discount_amount, status')
      .eq('centre_id', centreId).gte('bill_date', dateFrom).lte('bill_date', dateTo);
    const b = bills || [];
    // Group by date
    const dailyMap: Record<string, { date: string; gross: number; collected: number; discount: number; count: number }> = {};
    b.forEach((bill: any) => {
      if (!dailyMap[bill.bill_date]) dailyMap[bill.bill_date] = { date: bill.bill_date, gross: 0, collected: 0, discount: 0, count: 0 };
      dailyMap[bill.bill_date].gross += bill.net_amount || 0;
      dailyMap[bill.bill_date].collected += bill.paid_amount || 0;
      dailyMap[bill.bill_date].discount += bill.discount_amount || 0;
      dailyMap[bill.bill_date].count++;
    });
    // Group by type
    const typeMap: Record<string, number> = {};
    b.forEach((bill: any) => { typeMap[bill.bill_type] = (typeMap[bill.bill_type] || 0) + (bill.net_amount || 0); });
    // Group by payor
    const payorMap: Record<string, number> = {};
    b.forEach((bill: any) => { payorMap[bill.payor_type] = (payorMap[bill.payor_type] || 0) + (bill.net_amount || 0); });

    setLoading(false);
    return {
      daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
      byType: Object.entries(typeMap).map(([type, amount]) => ({ type, amount })),
      byPayor: Object.entries(payorMap).map(([payor, amount]) => ({ payor, amount })),
      total: b.reduce((s: number, x: any) => s + (x.net_amount || 0), 0),
    };
  }, [centreId]);

  const getOPDReport = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return { daily: [], byDoctor: [], total: 0 };
    const { data } = await sb().from('hmis_opd_visits')
      .select('created_at, status, doctor:hmis_staff!inner(full_name)')
      .eq('centre_id', centreId).gte('created_at', dateFrom + 'T00:00:00').lte('created_at', dateTo + 'T23:59:59');
    const v = data || [];
    const dailyMap: Record<string, number> = {};
    const doctorMap: Record<string, number> = {};
    v.forEach((vis: any) => {
      const d = vis.created_at?.split('T')[0];
      dailyMap[d] = (dailyMap[d] || 0) + 1;
      const dr = vis.doctor?.full_name || 'Unknown';
      doctorMap[dr] = (doctorMap[dr] || 0) + 1;
    });
    return {
      daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      byDoctor: Object.entries(doctorMap).map(([doctor, count]) => ({ doctor, count })).sort((a, b) => b.count - a.count),
      total: v.length,
    };
  }, [centreId]);

  const getPharmacyReport = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return { orders: [], totalAmount: 0, totalOrders: 0, dispensed: 0, pending: 0 };
    const { data } = await sb().from('hmis_pharmacy_dispensing')
      .select('id, status, total_amount, dispensed_at, created_at, patient:hmis_patients!inner(first_name, last_name)')
      .eq('centre_id', centreId).gte('created_at', dateFrom + 'T00:00:00').lte('created_at', dateTo + 'T23:59:59');
    const d = data || [];
    return {
      orders: d.map((o: any) => ({ name: o.patient.first_name + ' ' + (o.patient.last_name || ''), status: o.status, amount: o.total_amount || 0, date: (o.dispensed_at || o.created_at)?.split('T')[0] })),
      totalAmount: d.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
      totalOrders: d.length,
      dispensed: d.filter((o: any) => o.status === 'dispensed').length,
      pending: d.filter((o: any) => o.status === 'pending' || o.status === 'in_progress').length,
    };
  }, [centreId]);

  const getLabReport = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return { encounters: [], totalTests: 0, completed: 0, pending: 0 };
    const { data } = await sb().from('hmis_emr_encounters')
      .select('id, encounter_date, investigations, patient:hmis_patients!inner(first_name, last_name), doctor:hmis_staff!inner(full_name)')
      .eq('centre_id', centreId).not('investigations', 'eq', '[]')
      .gte('encounter_date', dateFrom).lte('encounter_date', dateTo);
    const e = data || [];
    let totalTests = 0, completed = 0, pending = 0;
    e.forEach((enc: any) => {
      const invs = enc.investigations || [];
      totalTests += invs.length;
      invs.forEach((i: any) => { if (i.result) completed++; else pending++; });
    });
    return {
      encounters: e.map((enc: any) => ({
        patient: enc.patient.first_name + ' ' + (enc.patient.last_name || ''),
        doctor: enc.doctor.full_name, date: enc.encounter_date,
        tests: (enc.investigations || []).length,
        done: (enc.investigations || []).filter((i: any) => i.result).length,
      })),
      totalTests, completed, pending,
    };
  }, [centreId]);

  const getIPDReport = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return { admissions: [], total: 0, active: 0, discharged: 0, byDept: [], byPayor: [], avgLOS: 0 };
    const { data } = await sb().from('hmis_admissions')
      .select('id, admission_date, actual_discharge, status, admission_type, payor_type, department:hmis_departments!inner(name), patient:hmis_patients!inner(first_name, last_name)')
      .eq('centre_id', centreId).gte('admission_date', dateFrom + 'T00:00:00').lte('admission_date', dateTo + 'T23:59:59');
    const a = data || [];
    // LOS calculation
    let totalLOS = 0, losCount = 0;
    a.forEach((adm: any) => {
      if (adm.actual_discharge) {
        const days = Math.ceil((new Date(adm.actual_discharge).getTime() - new Date(adm.admission_date).getTime()) / 86400000);
        totalLOS += days; losCount++;
      }
    });
    const deptMap: Record<string, number> = {};
    a.forEach((adm: any) => { const d = adm.department?.name || 'Unknown'; deptMap[d] = (deptMap[d] || 0) + 1; });
    const payorMap: Record<string, number> = {};
    a.forEach((adm: any) => { payorMap[adm.payor_type] = (payorMap[adm.payor_type] || 0) + 1; });
    return {
      admissions: a.map((adm: any) => ({ patient: adm.patient.first_name + ' ' + (adm.patient.last_name || ''), dept: adm.department?.name, type: adm.admission_type, payor: adm.payor_type, status: adm.status, date: adm.admission_date?.split('T')[0] })),
      total: a.length,
      active: a.filter((x: any) => x.status === 'active').length,
      discharged: a.filter((x: any) => x.status === 'discharged').length,
      byDept: Object.entries(deptMap).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count),
      byPayor: Object.entries(payorMap).map(([payor, count]) => ({ payor, count })).sort((a, b) => b.count - a.count),
      avgLOS: losCount > 0 ? Math.round(totalLOS / losCount * 10) / 10 : 0,
    };
  }, [centreId]);

  return { loading, getRevenueReport, getOPDReport, getPharmacyReport, getLabReport, getIPDReport };
}
