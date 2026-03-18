// lib/billing/charge-capture-hooks.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export interface ChargeEntry {
  id: string; centreId: string; patientId: string; admissionId?: string; billId?: string;
  chargeCode?: string; description: string; category: string;
  quantity: number; unitRate: number; amount: number;
  departmentId?: string; doctorId?: string;
  source: string; sourceRefId?: string; sourceRefType?: string;
  status: 'captured' | 'posted' | 'reversed' | 'disputed';
  serviceDate: string; notes?: string; createdAt: string;
  // Joined
  patientName?: string; uhid?: string; wardType?: string;
}

export interface AutoChargeRule {
  id: string; ruleName: string; triggerType: string;
  wardType?: string; chargeDescription: string; chargeAmount: number; isActive: boolean;
}

// ============================================================
// CHARGE CAPTURE — real-time charge posting from any source
// ============================================================
export function useChargeCapture(centreId: string | null) {
  const [charges, setCharges] = useState<ChargeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { admissionId?: string; patientId?: string; status?: string; date?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    let q = sb().from('hmis_charge_log')
      .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid)`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (filters?.admissionId) q = q.eq('admission_id', filters.admissionId);
    if (filters?.patientId) q = q.eq('patient_id', filters.patientId);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.date) q = q.eq('service_date', filters.date);

    const { data } = await q;
    setCharges((data || []).map((c: any) => ({
      id: c.id, centreId: c.centre_id, patientId: c.patient_id,
      admissionId: c.admission_id, billId: c.bill_id,
      chargeCode: c.charge_code, description: c.description, category: c.category,
      quantity: parseFloat(c.quantity), unitRate: parseFloat(c.unit_rate), amount: parseFloat(c.amount),
      departmentId: c.department_id, doctorId: c.doctor_id,
      source: c.source, sourceRefId: c.source_ref_id, sourceRefType: c.source_ref_type,
      status: c.status, serviceDate: c.service_date, notes: c.notes, createdAt: c.created_at,
      patientName: c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : '',
      uhid: c.patient?.uhid,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = useMemo(() => {
    const captured = charges.filter(c => c.status === 'captured');
    const posted = charges.filter(c => c.status === 'posted');
    return {
      capturedCount: captured.length,
      capturedAmount: captured.reduce((s, c) => s + c.amount, 0),
      postedCount: posted.length,
      postedAmount: posted.reduce((s, c) => s + c.amount, 0),
      totalToday: charges.filter(c => c.serviceDate === new Date().toISOString().split('T')[0]).reduce((s, c) => s + c.amount, 0),
      bySource: charges.reduce((acc, c) => { acc[c.source] = (acc[c.source] || 0) + c.amount; return acc; }, {} as Record<string, number>),
      byCategory: charges.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + c.amount; return acc; }, {} as Record<string, number>),
    };
  }, [charges]);

  // ---- Post a charge ----
  const postCharge = useCallback(async (data: {
    patientId: string; admissionId?: string;
    description: string; category: string;
    quantity: number; unitRate: number;
    source: string; sourceRefId?: string; sourceRefType?: string;
    departmentId?: string; doctorId?: string;
    chargeCode?: string; notes?: string;
    staffId: string;
  }): Promise<{ success: boolean; error?: string; chargeId?: string }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };
    if (!data.patientId) return { success: false, error: 'Patient ID required' };
    if (!data.description) return { success: false, error: 'Description required' };
    if (data.quantity <= 0) return { success: false, error: 'Quantity must be > 0' };
    if (data.unitRate < 0) return { success: false, error: 'Rate cannot be negative' };

    const amount = data.quantity * data.unitRate;

    const { data: charge, error } = await sb().from('hmis_charge_log').insert({
      centre_id: centreId, patient_id: data.patientId, admission_id: data.admissionId,
      charge_code: data.chargeCode, description: data.description, category: data.category,
      quantity: data.quantity, unit_rate: data.unitRate, amount,
      source: data.source, source_ref_id: data.sourceRefId, source_ref_type: data.sourceRefType,
      department_id: data.departmentId, doctor_id: data.doctorId,
      captured_by: data.staffId, notes: data.notes,
      service_date: new Date().toISOString().split('T')[0], status: 'captured',
    }).select('id').single();

    if (error) return { success: false, error: error.message };
    load();
    return { success: true, chargeId: charge?.id };
  }, [centreId, load]);

  // ---- Post charges to bill (captured → posted) ----
  const postToBill = useCallback(async (chargeIds: string[], billId: string): Promise<{ success: boolean; error?: string; count?: number }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    if (!chargeIds.length) return { success: false, error: 'No charges selected' };

    // Get the charges
    const { data: chargesToPost } = await sb().from('hmis_charge_log')
      .select('*').in('id', chargeIds).eq('status', 'captured');
    if (!chargesToPost?.length) return { success: false, error: 'No captured charges found' };

    // Insert into bill_items
    const items = chargesToPost.map((c: any) => ({
      bill_id: billId, tariff_id: c.tariff_id,
      description: c.description, quantity: c.quantity,
      unit_rate: c.unit_rate, amount: c.amount,
      discount: 0, tax: 0, net_amount: c.amount,
      service_date: c.service_date, department_id: c.department_id, doctor_id: c.doctor_id,
    }));

    const { error: insertErr } = await sb().from('hmis_bill_items').insert(items);
    if (insertErr) return { success: false, error: insertErr.message };

    // Mark charges as posted
    await sb().from('hmis_charge_log').update({
      status: 'posted', bill_id: billId, posted_to_bill_at: new Date().toISOString(),
    }).in('id', chargeIds);

    // Update bill totals
    const totalPosted = chargesToPost.reduce((s: number, c: any) => s + parseFloat(c.amount), 0);
    const { data: bill } = await sb().from('hmis_bills').select('gross_amount, net_amount, balance_amount').eq('id', billId).single();
    if (bill) {
      await sb().from('hmis_bills').update({
        gross_amount: parseFloat(bill.gross_amount) + totalPosted,
        net_amount: parseFloat(bill.net_amount) + totalPosted,
        balance_amount: parseFloat(bill.balance_amount) + totalPosted,
      }).eq('id', billId);
    }

    load();
    return { success: true, count: chargesToPost.length };
  }, [load]);

  // ---- Reverse a charge ----
  const reverseCharge = useCallback(async (chargeId: string, reason: string, staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    if (!reason.trim()) return { success: false, error: 'Reversal reason required' };

    const { data: charge } = await sb().from('hmis_charge_log').select('status, bill_id, amount').eq('id', chargeId).single();
    if (!charge) return { success: false, error: 'Charge not found' };
    if (charge.status === 'reversed') return { success: false, error: 'Already reversed' };
    if (charge.status === 'posted' && charge.bill_id) {
      return { success: false, error: 'Cannot reverse a posted charge. Use credit note from billing instead.' };
    }

    await sb().from('hmis_charge_log').update({
      status: 'reversed', reversed_at: new Date().toISOString(),
      reversed_by: staffId, reversal_reason: reason,
    }).eq('id', chargeId);

    load();
    return { success: true };
  }, [load]);

  return { charges, loading, stats, load, postCharge, postToBill, reverseCharge };
}

// ============================================================
// AUTO-CHARGE RULES
// ============================================================
export function useAutoChargeRules(centreId: string | null) {
  const [rules, setRules] = useState<AutoChargeRule[]>([]);
  const [lastRun, setLastRun] = useState<any>(null);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_billing_auto_rules').select('*').eq('centre_id', centreId).order('trigger_type, ward_type, charge_amount')
      .then(({ data }: any) => setRules((data || []).map((r: any) => ({
        id: r.id, ruleName: r.rule_name, triggerType: r.trigger_type,
        wardType: r.ward_type, chargeDescription: r.charge_description,
        chargeAmount: parseFloat(r.charge_amount), isActive: r.is_active,
      }))));

    // Last run
    const today = new Date().toISOString().split('T')[0];
    sb().from('hmis_auto_charge_runs').select('*').eq('centre_id', centreId)
      .order('run_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => setLastRun(data));
  }, [centreId]);

  const runDailyCharges = useCallback(async (staffId: string): Promise<{ success: boolean; error?: string; count?: number; total?: number }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };

    const today = new Date().toISOString().split('T')[0];

    // Check if already run
    const { data: existing } = await sb().from('hmis_auto_charge_runs')
      .select('id').eq('centre_id', centreId).eq('run_date', today).maybeSingle();
    if (existing) return { success: false, error: `Daily charges already run for ${today}` };

    // Call RPC
    const { data, error } = await sb().rpc('run_daily_auto_charges', {
      p_centre_id: centreId, p_date: today, p_staff_id: staffId,
    });

    if (error) return { success: false, error: error.message };
    const result = data?.[0] || { charges_posted: 0, total_amount: 0 };
    return { success: true, count: result.charges_posted, total: parseFloat(result.total_amount) };
  }, [centreId]);

  const toggleRule = useCallback(async (ruleId: string, isActive: boolean): Promise<void> => {
    if (!sb()) return;
    await sb().from('hmis_billing_auto_rules').update({ is_active: isActive }).eq('id', ruleId);
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive } : r));
  }, []);

  return { rules, lastRun, runDailyCharges, toggleRule };
}

// ============================================================
// BARCODE SCANNER — scan wristband → lookup patient
// ============================================================
export function useBarcodeScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ patientId: string; uhid: string; name: string; admissionId?: string; ipd?: string; wardType?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<string>('');
  const timeoutRef = useRef<any>(null);

  // Keyboard barcode scanner handler (most USB/Bluetooth scanners emit keystrokes)
  const handleKeyInput = useCallback((e: KeyboardEvent) => {
    if (!scanning) return;

    if (e.key === 'Enter') {
      const code = inputRef.current.trim();
      inputRef.current = '';
      if (code.length >= 3) lookup(code);
      return;
    }

    // Accumulate characters (scanners type fast)
    inputRef.current += e.key;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { inputRef.current = ''; }, 500); // reset after 500ms idle
  }, [scanning]);

  useEffect(() => {
    if (scanning) {
      window.addEventListener('keydown', handleKeyInput);
      return () => window.removeEventListener('keydown', handleKeyInput);
    }
  }, [scanning, handleKeyInput]);

  const lookup = useCallback(async (code: string) => {
    if (!sb()) return;
    setError(null);
    setResult(null);

    // Try UHID match first
    let { data: patient } = await sb().from('hmis_patients')
      .select('id, uhid, first_name, last_name')
      .eq('uhid', code).maybeSingle();

    // Try IPD number
    if (!patient) {
      const { data: admission } = await sb().from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(id, uhid, first_name, last_name), bed:hmis_beds(room:hmis_rooms(ward:hmis_wards(type)))')
        .eq('ipd_number', code).eq('status', 'active').maybeSingle();
      if (admission) {
        setResult({
          patientId: admission.patient.id, uhid: admission.patient.uhid,
          name: `${admission.patient.first_name} ${admission.patient.last_name}`,
          admissionId: admission.id, ipd: admission.ipd_number,
          wardType: admission.bed?.room?.ward?.type,
        });
        return;
      }
    }

    // Try partial UHID match
    if (!patient) {
      const { data: patients } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name')
        .ilike('uhid', `%${code}%`).limit(1);
      patient = patients?.[0];
    }

    if (!patient) {
      setError(`No patient found for barcode: ${code}`);
      return;
    }

    // Find active admission
    const { data: admission } = await sb().from('hmis_admissions')
      .select('id, ipd_number, bed:hmis_beds(room:hmis_rooms(ward:hmis_wards(type)))')
      .eq('patient_id', patient.id).eq('status', 'active').maybeSingle();

    setResult({
      patientId: patient.id, uhid: patient.uhid,
      name: `${patient.first_name} ${patient.last_name}`,
      admissionId: admission?.id, ipd: admission?.ipd_number,
      wardType: admission?.bed?.room?.ward?.type,
    });
  }, []);

  const manualLookup = useCallback(async (code: string) => {
    await lookup(code);
  }, [lookup]);

  const startScanning = () => { setScanning(true); setResult(null); setError(null); inputRef.current = ''; };
  const stopScanning = () => { setScanning(false); };
  const clear = () => { setResult(null); setError(null); };

  return { scanning, result, error, startScanning, stopScanning, manualLookup, clear, inputRef };
}

// ============================================================
// IPD RUNNING BILL — all charges for an admission
// ============================================================
export function useIPDRunningBill(admissionId: string | null) {
  const [charges, setCharges] = useState<ChargeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<any>(null);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);

    // Get all charges for this admission
    const { data } = await sb().from('hmis_charge_log')
      .select('*')
      .eq('admission_id', admissionId)
      .neq('status', 'reversed')
      .order('service_date', { ascending: true });

    setCharges((data || []).map((c: any) => ({
      id: c.id, centreId: c.centre_id, patientId: c.patient_id,
      admissionId: c.admission_id, billId: c.bill_id,
      chargeCode: c.charge_code, description: c.description, category: c.category,
      quantity: parseFloat(c.quantity), unitRate: parseFloat(c.unit_rate), amount: parseFloat(c.amount),
      departmentId: c.department_id, doctorId: c.doctor_id,
      source: c.source, sourceRefId: c.source_ref_id, sourceRefType: c.source_ref_type,
      status: c.status, serviceDate: c.service_date, notes: c.notes, createdAt: c.created_at,
    })));

    // Get linked bill
    const { data: billData } = await sb().from('hmis_bills')
      .select('id, bill_number, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status')
      .eq('encounter_id', admissionId).eq('bill_type', 'ipd').maybeSingle();
    setBill(billData);

    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const byDate = new Map<string, ChargeEntry[]>();
    const byCategory = new Map<string, number>();
    const bySource = new Map<string, number>();
    let total = 0;

    charges.forEach(c => {
      // By date
      if (!byDate.has(c.serviceDate)) byDate.set(c.serviceDate, []);
      byDate.get(c.serviceDate)!.push(c);
      // By category
      byCategory.set(c.category, (byCategory.get(c.category) || 0) + c.amount);
      // By source
      bySource.set(c.source, (bySource.get(c.source) || 0) + c.amount);
      total += c.amount;
    });

    return {
      total, chargeCount: charges.length,
      captured: charges.filter(c => c.status === 'captured').reduce((s, c) => s + c.amount, 0),
      posted: charges.filter(c => c.status === 'posted').reduce((s, c) => s + c.amount, 0),
      byDate: Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]),
      paid: bill ? parseFloat(bill.paid_amount || 0) : 0,
      balance: total - (bill ? parseFloat(bill.paid_amount || 0) : 0),
    };
  }, [charges, bill]);

  return { charges, bill, loading, summary, load };
}
