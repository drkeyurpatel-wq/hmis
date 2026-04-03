// lib/billing/revenue-cycle-hooks.ts
import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// INSURANCE / CASHLESS WORKFLOW
// ============================================================
export function useCashlessWorkflow(centreId: string | null) {
  const [preAuths, setPreAuths] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPreAuths = useCallback(async (status?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_pre_auth_requests').select(`*, admission:hmis_admissions!inner(id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid)), insurance:hmis_patient_insurance!inner(policy_number, insurer:hmis_insurers(name, code), tpa:hmis_tpas(name, code), scheme)`).order('submitted_at', { ascending: false }).limit(100);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    setPreAuths(data || []);
    setLoading(false);
  }, [centreId]);

  const loadClaims = useCallback(async (status?: string) => {
    if (!centreId || !sb()) return;
    let q = sb().from('hmis_claims').select(`*, bill:hmis_bills!inner(bill_number, net_amount, patient:hmis_patients!inner(first_name, last_name, uhid)), preauth:hmis_pre_auth_requests(pre_auth_number, approved_amount)`).order('submitted_at', { ascending: false }).limit(100);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    setClaims(data || []);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPreAuths(); loadClaims(); }, [loadPreAuths, loadClaims]);

  const submitPreAuth = useCallback(async (data: { admissionId: string; insuranceId: string; amount: number; documents?: any }, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_pre_auth_requests').insert({ admission_id: data.admissionId, patient_insurance_id: data.insuranceId, requested_amount: data.amount, submitted_by: staffId, documents: data.documents || null });
    loadPreAuths();
  }, [loadPreAuths]);

  const updatePreAuth = useCallback(async (id: string, update: { status: string; approvedAmount?: number; preAuthNumber?: string; remarks?: string }) => {
    if (!sb()) return;
    const upd: any = { status: update.status, responded_at: new Date().toISOString() };
    if (update.approvedAmount) upd.approved_amount = update.approvedAmount;
    if (update.preAuthNumber) upd.pre_auth_number = update.preAuthNumber;
    if (update.remarks) upd.remarks = update.remarks;
    await sb().from('hmis_pre_auth_requests').update(upd).eq('id', id);

    // BRIDGE: Pre-auth approved → auto-check surgical planning checklist
    if (update.status === 'approved') {
      const { data: pa } = await sb().from('hmis_pre_auth_requests')
        .select('admission_id, approved_amount, admission:hmis_admissions!inner(centre_id)')
        .eq('id', id).single();
      if (pa) {
        const adm = pa.admission as any;
        import('@/lib/bridge/module-events').then(({ onPreAuthStatusChanged }) =>
          onPreAuthStatusChanged({
            centreId: adm?.centre_id || '', admissionId: pa.admission_id,
            status: 'approved', approvedAmount: pa.approved_amount,
          }).catch((_e) => { /* lib: non-blocking */ })
        );
      }
    }

    loadPreAuths();
  }, [loadPreAuths]);

  const submitClaim = useCallback(async (data: { billId: string; preAuthId?: string; claimedAmount: number; claimType: string }) => {
    if (!sb()) return;
    await sb().from('hmis_claims').insert({ bill_id: data.billId, pre_auth_id: data.preAuthId || null, claimed_amount: data.claimedAmount, claim_type: data.claimType, claim_number: `CLM-${Date.now()}` });
    loadClaims();
  }, [loadClaims]);

  const updateClaim = useCallback(async (id: string, update: { status?: string; approvedAmount?: number; settledAmount?: number; tdsAmount?: number; disallowanceAmount?: number; disallowanceReason?: string; utrNumber?: string }) => {
    if (!sb()) return;
    const upd: any = {};
    if (update.status) upd.status = update.status;
    if (update.approvedAmount !== undefined) upd.approved_amount = update.approvedAmount;
    if (update.settledAmount !== undefined) { upd.settled_amount = update.settledAmount; upd.settled_at = new Date().toISOString(); }
    if (update.tdsAmount !== undefined) upd.tds_amount = update.tdsAmount;
    if (update.disallowanceAmount !== undefined) upd.disallowance_amount = update.disallowanceAmount;
    if (update.disallowanceReason) upd.disallowance_reason = update.disallowanceReason;
    if (update.utrNumber) upd.utr_number = update.utrNumber;
    await sb().from('hmis_claims').update(upd).eq('id', id);

    // BRIDGE: When claim is settled, update the related bill balance
    if (update.settledAmount !== undefined && update.settledAmount > 0) {
      try {
        const { data: claim } = await sb().from('hmis_claims').select('bill_id').eq('id', id).single();
        if (claim?.bill_id) {
          const { data: bill } = await sb().from('hmis_bills')
            .select('paid_amount, net_amount').eq('id', claim.bill_id).single();
          if (bill) {
            const newPaid = parseFloat(bill.paid_amount || '0') + update.settledAmount - (update.tdsAmount || 0) - (update.disallowanceAmount || 0);
            const newBalance = Math.max(0, parseFloat(bill.net_amount || '0') - newPaid);
            const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'draft';
            await sb().from('hmis_bills').update({
              paid_amount: newPaid, balance_amount: newBalance, status: newStatus,
            }).eq('id', claim.bill_id);
          }
        }
      } catch (e) { console.error('Claim→Bill update failed:', e); }
    }

    loadClaims();
  }, [loadClaims]);

  const stats = {
    pendingPreAuths: preAuths.filter(p => p.status === 'pending').length,
    approvedPreAuths: preAuths.filter(p => p.status === 'approved').length,
    pendingClaims: claims.filter(c => c.status === 'submitted' || c.status === 'under_review').length,
    settledClaims: claims.filter(c => c.status === 'settled').length,
    totalClaimed: claims.reduce((s, c) => s + parseFloat(c.claimed_amount || 0), 0),
    totalSettled: claims.filter(c => c.status === 'settled').reduce((s, c) => s + parseFloat(c.settled_amount || 0), 0),
    totalDisallowance: claims.reduce((s, c) => s + parseFloat(c.disallowance_amount || 0), 0),
  };

  return { preAuths, claims, loading, stats, loadPreAuths, loadClaims, submitPreAuth, updatePreAuth, submitClaim, updateClaim };
}

// ============================================================
// CORPORATE BILLING
// ============================================================
export function useCorporateBilling(centreId: string | null) {
  const [corporates, setCorporates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const loadCorporates = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_corporates').select('*').eq('centre_id', centreId).eq('status', 'active').order('company_name');
    setCorporates(data || []);
  }, [centreId]);

  const loadEmployees = useCallback(async (corporateId: string) => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_corporate_employees').select('*, patient:hmis_patients(first_name, last_name, uhid), corporate:hmis_corporates(company_name)').eq('corporate_id', corporateId).eq('is_active', true);
    setEmployees(data || []);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCorporates(); }, [loadCorporates]);

  const addCorporate = useCallback(async (data: { company_name: string; contact_person?: string; phone?: string; email?: string; gst_number?: string; credit_limit?: number; discount_percentage?: number; billing_cycle?: string }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_corporates').insert({ centre_id: centreId, ...data, status: 'active', current_outstanding: 0 });
    loadCorporates();
  }, [centreId, loadCorporates]);

  const addEmployee = useCallback(async (corporateId: string, patientId: string, empId: string, relationship: string, coverage: string) => {
    if (!sb()) return;
    await sb().from('hmis_corporate_employees').insert({ corporate_id: corporateId, patient_id: patientId, employee_id: empId, relationship, coverage_type: coverage });
    loadEmployees(corporateId);
  }, [loadEmployees]);

  const getCorporateRate = useCallback((corporate: any, baseRate: number) => {
    const disc = parseFloat(corporate?.discount_percentage || 0);
    return baseRate * (1 - disc / 100);
  }, []);

  const checkCreditLimit = useCallback((corporate: any, billAmount: number) => {
    const limit = parseFloat(corporate?.credit_limit || 0);
    const outstanding = parseFloat(corporate?.current_outstanding || 0);
    const available = limit - outstanding;
    return { limit, outstanding, available, canBill: available >= billAmount, shortfall: Math.max(0, billAmount - available) };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const creditBills = useCallback(async (corporateId: string): Promise<any[]> => {
    if (!centreId || !sb()) return [];
    const { data: employees } = await sb().from('hmis_corporate_employees')
      .select('patient_id').eq('corporate_id', corporateId).eq('is_active', true);
    if (!employees?.length) return [];
    const patientIds = employees.map((e: any) => e.patient_id);
    const { data: bills } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_date, net_amount, paid_amount, balance_amount, status, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .eq('centre_id', centreId).in('patient_id', patientIds).gt('balance_amount', 0).order('bill_date', { ascending: false });
    return bills || [];
  }, [centreId]);

  return { corporates, employees, loadCorporates, loadEmployees, addCorporate, addEmployee, getCorporateRate, checkCreditLimit, creditBills };
}

// ============================================================
// ACCOUNTS RECEIVABLE
// ============================================================
export function useAccountsReceivable(centreId: string | null) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({});

  const load = useCallback(async (filters?: { arType?: string; status?: string; agingBucket?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_ar_entries').select('*, patient:hmis_patients(first_name, last_name, uhid), bill:hmis_bills(bill_number), corporate:hmis_corporates(company_name)').eq('centre_id', centreId).order('created_at', { ascending: false });
    if (filters?.arType && filters.arType !== 'all') q = q.eq('ar_type', filters.arType);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.agingBucket && filters.agingBucket !== 'all') q = q.eq('aging_bucket', filters.agingBucket);
    const { data } = await q;
    setEntries(data || []);

    // Calculate stats
    const all = data || [];
    const open = all.filter((e: any) => e.status === 'open' || e.status === 'partial');
    const byType: Record<string, number> = {};
    const byBucket: Record<string, number> = {};
    open.forEach((e: any) => {
      const bal = parseFloat(e.balance_amount || 0);
      byType[e.ar_type] = (byType[e.ar_type] || 0) + bal;
      byBucket[e.aging_bucket || 'current'] = (byBucket[e.aging_bucket || 'current'] || 0) + bal;
    });
    setStats({
      totalOpen: open.length,
      totalOutstanding: open.reduce((s: number, e: any) => s + parseFloat(e.balance_amount || 0), 0),
      byType, byBucket,
      overdue90: open.filter((e: any) => ['90','120','180','365','bad_debt'].includes(e.aging_bucket)).reduce((s: number, e: any) => s + parseFloat(e.balance_amount || 0), 0),
    });
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const createEntry = useCallback(async (data: any) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_ar_entries').insert({ ...data, centre_id: centreId });
    load();
  }, [centreId, load]);

  const addFollowup = useCallback(async (arId: string, data: any, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_ar_followups').insert({ ar_entry_id: arId, ...data, created_by: staffId });
    await sb().from('hmis_ar_entries').update({ last_followup_date: new Date().toISOString().split('T')[0], followup_notes: data.response, updated_at: new Date().toISOString() }).eq('id', arId);
    load();
  }, [load]);

  const writeOff = useCallback(async (arId: string, amount: number, staffId: string) => {
    if (!sb()) return;
    const { data: entry } = await sb().from('hmis_ar_entries').select('written_off_amount, balance_amount').eq('id', arId).single();
    if (!entry) return;
    const newWO = parseFloat(entry.written_off_amount) + amount;
    const newBal = parseFloat(entry.balance_amount) - amount;
    await sb().from('hmis_ar_entries').update({ written_off_amount: newWO, balance_amount: newBal, status: newBal <= 0 ? 'written_off' : 'partial', updated_at: new Date().toISOString() }).eq('id', arId);
    load();
  }, [load]);

  return { entries, loading, stats, load, createEntry, addFollowup, writeOff };
}

// ============================================================
// SETTLEMENTS / RECONCILIATION
// ============================================================
export function useSettlements(centreId: string | null) {
  const [settlements, setSettlements] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_settlements').select('*, insurer:hmis_insurers(name), tpa:hmis_tpas(name), corporate:hmis_corporates(company_name)').eq('centre_id', centreId).order('settlement_date', { ascending: false }).limit(50);
    setSettlements(data || []);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const createSettlement = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_settlements').insert({ ...data, centre_id: centreId });
    load();
  }, [centreId, load]);

  const reconcile = useCallback(async (settlementId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_settlements').update({ reconciled: true, reconciled_by: staffId, reconciled_at: new Date().toISOString() }).eq('id', settlementId);
    load();
  }, [load]);

  return { settlements, load, createSettlement, reconcile };
}

// ============================================================
// GOVERNMENT SCHEMES
// ============================================================
export function useGovtSchemes(centreId: string | null) {
  const [schemes, setSchemes] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_govt_scheme_config').select('*').eq('centre_id', centreId).eq('is_active', true);
    setSchemes(data || []);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { schemes, load };
}

// ============================================================
// LOYALTY PROGRAM
// ============================================================
export function useLoyalty(centreId: string | null) {
  const [cards, setCards] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_loyalty_cards').select('*, patient:hmis_patients(first_name, last_name, uhid)').eq('centre_id', centreId).eq('is_active', true).order('created_at', { ascending: false }).limit(100);
    setCards(data || []);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const issueCard = useCallback(async (patientId: string, cardType: string, discountRules: any) => {
    if (!centreId || !sb()) return;
    const num = `H1-${cardType.toUpperCase().substring(0,3)}-${Date.now().toString().slice(-6)}`;
    await sb().from('hmis_loyalty_cards').insert({ centre_id: centreId, patient_id: patientId, card_number: num, card_type: cardType, ...discountRules, valid_until: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0] });
    load();
  }, [centreId, load]);

  const getDiscount = useCallback((card: any, billType: string) => {
    if (!card) return 0;
    switch (billType) {
      case 'opd': return parseFloat(card.discount_opd || 0);
      case 'ipd': return parseFloat(card.discount_ipd || 0);
      case 'pharmacy': return parseFloat(card.discount_pharmacy || 0);
      case 'lab': case 'radiology': return parseFloat(card.discount_lab || 0);
      default: return 0;
    }
  }, []);

  return { cards, load, issueCard, getDiscount };
}

// ============================================================
// INTEGRATION BRIDGE (VPMS, MedPay, CashFlow)
// ============================================================
export function useIntegrationBridge(centreId: string | null) {
  const [pendingSync, setPendingSync] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_integration_bridge').select('*').eq('centre_id', centreId).eq('sync_status', 'pending').order('created_at', { ascending: false }).limit(50);
    setPendingSync(data || []);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const queueSync = useCallback(async (source: string, target: string, entityType: string, entityId: string, data: any) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_integration_bridge').insert({ centre_id: centreId, source_system: source, target_system: target, entity_type: entityType, entity_id: entityId, sync_data: data });
    load();
  }, [centreId, load]);

  // Push bill to CashFlow
  const pushToCashFlow = useCallback(async (bill: any) => {
    await queueSync('billing', 'cashflow', 'bill_payment', bill.id, {
      centre: bill.centre_id, date: bill.bill_date, amount: bill.paid_amount,
      type: 'income', category: 'patient_revenue', sub_category: bill.bill_type,
      payor: bill.payor_type, reference: bill.bill_number,
    });
  }, [queueSync]);

  // Push doctor fee to MedPay
  const pushToMedPay = useCallback(async (billId: string, doctorId: string, amount: number, billNumber: string) => {
    await queueSync('billing', 'medpay', 'doctor_fee', billId, {
      doctor_id: doctorId, amount, bill_number: billNumber, date: new Date().toISOString().split('T')[0],
    });
  }, [queueSync]);

  // Push vendor invoice from bill consumable to VPMS
  const pushToVPMS = useCallback(async (billId: string, consumable: string, amount: number) => {
    await queueSync('billing', 'vpms', 'consumable_usage', billId, {
      item: consumable, amount, date: new Date().toISOString().split('T')[0],
    });
  }, [queueSync]);

  const markSynced = useCallback(async (bridgeId: string) => {
    if (!sb()) return;
    await sb().from('hmis_integration_bridge').update({ sync_status: 'synced', synced_at: new Date().toISOString() }).eq('id', bridgeId);
    load();
  }, [load]);

  return { pendingSync, load, queueSync, pushToCashFlow, pushToMedPay, pushToVPMS, markSynced };
}
