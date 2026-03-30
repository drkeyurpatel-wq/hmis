// lib/revenue-leakage/leakage-hooks.ts — Revenue leakage detection engine
import { useState, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface Leak {
  id: string; type: string; severity: 'critical' | 'high' | 'medium' | 'low';
  patient_name: string; uhid: string; patient_id?: string; admission_id?: string;
  description: string; amount: number; days_old: number;
  source_table?: string; source_id?: string;
}

export const LEAK_TYPES = {
  unbilled_charge: { label: 'Unbilled Charge', severity: 'high' as const, icon: '₹' },
  missing_room_charge: { label: 'Missing Room Charge', severity: 'critical' as const, icon: '' },
  unbilled_procedure: { label: 'Unbilled Procedure', severity: 'critical' as const, icon: '🔪' },
  unbilled_pharmacy: { label: 'Unbilled Pharmacy', severity: 'high' as const, icon: '' },
  unbilled_lab: { label: 'Unbilled Lab', severity: 'high' as const, icon: '' },
  unpaid_bill: { label: 'Unpaid Bill >3d', severity: 'medium' as const, icon: '⏳' },
  package_overstay: { label: 'Package Overstay', severity: 'high' as const, icon: '' },
  missing_consultation: { label: 'Missing Consult Charge', severity: 'medium' as const, icon: '👨‍⚕️' },
  missing_nursing: { label: 'Missing Nursing Charge', severity: 'low' as const, icon: '' },
  ot_unbilled: { label: 'OT Not Billed', severity: 'critical' as const, icon: '⚕️' },
};

export function useLeakageScanner(centreId: string | null) {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const found: Leak[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayMs = 86400000;

    try {
      // 1. Unbilled charges (charge_log without bill)
      const { data: charges } = await sb().from('hmis_charge_log')
        .select('id, amount, category, service_date, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).is('bill_id', null).neq('status', 'reversed')
        .gte('service_date', new Date(Date.now() - 30 * dayMs).toISOString().split('T')[0]).limit(100);
      (charges || []).forEach((c: any) => {
        const d = Math.floor((today.getTime() - new Date(c.service_date + 'T12:00:00').getTime()) / dayMs);
        found.push({ id: `ch-${c.id}`, type: 'unbilled_charge', severity: 'high',
          patient_name: `${c.patient?.first_name} ${c.patient?.last_name}`, uhid: c.patient?.uhid || '',
          description: `${c.category || 'Service'} ₹${Math.round(c.amount).toLocaleString('en-IN')} on ${c.service_date}`,
          amount: parseFloat(c.amount || 0), days_old: d });
      });

      // 2. Active admissions without today's room charge
      const { data: admissions } = await sb().from('hmis_admissions')
        .select('id, admission_date, patient:hmis_patients!inner(id, first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('status', 'active');
      for (const adm of (admissions || []) as any[]) {
        const { count } = await sb().from('hmis_charge_log').select('id', { count: 'exact', head: true })
          .eq('admission_id', adm.id).eq('category', 'room').eq('service_date', todayStr);
        if (count === 0) {
          const d = Math.floor((today.getTime() - new Date(adm.admission_date).getTime()) / dayMs);
          found.push({ id: `room-${adm.id}`, type: 'missing_room_charge', severity: 'critical',
            patient_name: `${adm.patient?.first_name} ${adm.patient?.last_name}`, uhid: adm.patient?.uhid || '',
            patient_id: adm.patient?.id, admission_id: adm.id,
            description: `No room charge today. Admitted ${d} days ago.`, amount: 0, days_old: 0 });
        }
      }

      // 3. Completed labs not billed
      const { data: labs } = await sb().from('hmis_lab_orders')
        .select('id, test_name, created_at, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('status', 'completed').is('bill_id', null)
        .gte('created_at', new Date(Date.now() - 7 * dayMs).toISOString()).limit(50);
      (labs || []).forEach((l: any) => {
        found.push({ id: `lab-${l.id}`, type: 'unbilled_lab', severity: 'high',
          patient_name: `${l.patient?.first_name} ${l.patient?.last_name}`, uhid: l.patient?.uhid || '',
          description: `Lab "${l.test_name}" completed, not billed`, amount: 0,
          days_old: Math.floor((today.getTime() - new Date(l.created_at).getTime()) / dayMs) });
      });

      // 4. Dispensed pharmacy not billed
      const { data: rx } = await sb().from('hmis_pharmacy_dispensing')
        .select('id, created_at, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('status', 'dispensed').is('bill_id', null)
        .gte('created_at', new Date(Date.now() - 7 * dayMs).toISOString()).limit(50);
      (rx || []).forEach((r: any) => {
        found.push({ id: `rx-${r.id}`, type: 'unbilled_pharmacy', severity: 'high',
          patient_name: `${r.patient?.first_name} ${r.patient?.last_name}`, uhid: r.patient?.uhid || '',
          description: 'Medication dispensed, not billed', amount: 0,
          days_old: Math.floor((today.getTime() - new Date(r.created_at).getTime()) / dayMs) });
      });

      // 5. Unpaid bills >3 days, >₹10K
      const { data: bills } = await sb().from('hmis_bills')
        .select('id, bill_number, balance_amount, bill_date, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).neq('status', 'cancelled').neq('status', 'paid')
        .gt('balance_amount', 10000).order('bill_date').limit(50);
      (bills || []).forEach((b: any) => {
        const d = Math.floor((today.getTime() - new Date(b.bill_date + 'T12:00:00').getTime()) / dayMs);
        if (d > 3) found.push({ id: `bill-${b.id}`, type: 'unpaid_bill', severity: d > 30 ? 'critical' : 'medium',
          patient_name: `${b.patient?.first_name} ${b.patient?.last_name}`, uhid: b.patient?.uhid || '',
          description: `Bill ${b.bill_number}: ₹${Math.round(b.balance_amount).toLocaleString('en-IN')} unpaid ${d}d`,
          amount: parseFloat(b.balance_amount || 0), days_old: d });
      });

      // 6. Completed OT bookings not billed — join through admission for centre_id + patient
      const { data: ot } = await sb().from('hmis_ot_bookings')
        .select('id, procedure_name, scheduled_date, admission:hmis_admissions!inner(centre_id, patient:hmis_patients!inner(first_name, last_name, uhid))')
        .eq('status', 'completed')
        .gte('scheduled_date', new Date(Date.now() - 14 * dayMs).toISOString().split('T')[0]).limit(30);
      (ot || []).forEach((o: any) => {
        if (o.admission?.centre_id !== centreId) return;
        found.push({ id: `ot-${o.id}`, type: 'ot_unbilled', severity: 'critical',
          patient_name: `${o.admission?.patient?.first_name} ${o.admission?.patient?.last_name}`, uhid: o.admission?.patient?.uhid || '',
          description: `OT "${o.procedure_name}" completed on ${o.scheduled_date}, not billed`, amount: 0,
          days_old: Math.floor((today.getTime() - new Date(o.scheduled_date + 'T12:00:00').getTime()) / dayMs) });
      });

      // 7. Package overstay
      const { data: pkgUtils } = await sb().from('hmis_package_utilization')
        .select('id, expected_los, package_rate, patient:hmis_patients(first_name, last_name, uhid), admission:hmis_admissions!inner(admission_date, status)')
        .eq('centre_id', centreId).eq('status', 'active');
      (pkgUtils || []).forEach((u: any) => {
        if (u.admission?.status !== 'active') return;
        const admDays = Math.floor((today.getTime() - new Date(u.admission.admission_date).getTime()) / dayMs);
        const overstay = admDays - (u.expected_los || 3);
        if (overstay > 0) {
          found.push({ id: `pkg-${u.id}`, type: 'package_overstay', severity: overstay > 3 ? 'critical' : 'high',
            patient_name: `${u.patient?.first_name} ${u.patient?.last_name}`, uhid: u.patient?.uhid || '',
            description: `Package LOS ${u.expected_los}d exceeded by ${overstay}d. Consider over-package billing.`,
            amount: 0, days_old: overstay });
        }
      });
    } catch (e) { console.error('Leakage scan error:', e); }

    found.sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sev[a.severity] - sev[b.severity]) || (b.amount - a.amount) || (b.days_old - a.days_old);
    });
    setLeaks(found);
    setLastScanned(new Date().toISOString());
    setLoading(false);
  }, [centreId]);

  const stats = useMemo(() => {
    const totalAmount = leaks.reduce((s, l) => s + l.amount, 0);
    const byType: Record<string, { count: number; amount: number }> = {};
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    leaks.forEach(l => {
      if (!byType[l.type]) byType[l.type] = { count: 0, amount: 0 };
      byType[l.type].count++; byType[l.type].amount += l.amount;
      bySeverity[l.severity]++;
    });
    return { totalLeaks: leaks.length, totalAmount, byType, bySeverity };
  }, [leaks]);

  return { leaks, loading, lastScanned, stats, scan };
}

// ============================================================
// Revenue Recovery Actions — one-click charge posting
// ============================================================

export function useLeakageActions(centreId: string | null) {
  const [posting, setPosting] = useState<string | null>(null);

  const postRoomCharge = useCallback(async (admissionId: string, staffId: string) => {
    if (!sb() || !centreId) return { success: false, error: 'No connection' };
    setPosting(admissionId);
    try {
      // Lookup bed rate from admission → bed → room
      const { data: adm } = await sb().from('hmis_admissions')
        .select('bed_id, patient_id, bed:hmis_beds!inner(room_id, bed_number, room:hmis_rooms!inner(room_type, daily_rate))')
        .eq('id', admissionId).single();

      if (!adm?.bed) return { success: false, error: 'Bed not found' };
      const room = (adm.bed as any)?.room;
      const rate = room?.daily_rate || 1500;
      const roomType = room?.room_type || 'General';
      const today = new Date().toISOString().split('T')[0];

      await sb().from('hmis_charge_log').insert({
        centre_id: centreId, patient_id: adm.patient_id, admission_id: admissionId,
        category: 'room', description: `Bed Charge (${roomType})`,
        quantity: 1, unit_rate: rate, amount: rate,
        service_date: today, status: 'posted', captured_by: staffId,
        source: 'leakage_recovery', source_ref_type: 'auto_charge',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally { setPosting(null); }
  }, [centreId]);

  const postLabCharge = useCallback(async (labOrderId: string, staffId: string) => {
    if (!sb() || !centreId) return { success: false, error: 'No connection' };
    setPosting(labOrderId);
    try {
      const { data: lab } = await sb().from('hmis_lab_orders')
        .select('id, test_name, patient_id, admission_id').eq('id', labOrderId).single();
      if (!lab) return { success: false, error: 'Lab order not found' };

      // Lookup tariff
      const { data: tariff } = await sb().from('hmis_tariff_master')
        .select('rate_self').ilike('service_name', `%${lab.test_name}%`).eq('centre_id', centreId).limit(1).maybeSingle();
      const rate = tariff?.rate_self || 500;

      await sb().from('hmis_charge_log').insert({
        centre_id: centreId, patient_id: lab.patient_id, admission_id: lab.admission_id,
        category: 'lab', description: lab.test_name,
        quantity: 1, unit_rate: rate, amount: rate,
        service_date: new Date().toISOString().split('T')[0], status: 'posted', captured_by: staffId,
        source: 'leakage_recovery', source_ref_id: labOrderId, source_ref_type: 'lab_order',
      });

      // Mark as billed (set bill_id to indicate charged)
      await sb().from('hmis_lab_orders').update({ bill_id: 'leakage-recovery' }).eq('id', labOrderId);

      return { success: true, amount: rate };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally { setPosting(null); }
  }, [centreId]);

  const postPharmacyCharge = useCallback(async (dispensingId: string, staffId: string) => {
    if (!sb() || !centreId) return { success: false, error: 'No connection' };
    setPosting(dispensingId);
    try {
      const { data: disp } = await sb().from('hmis_pharmacy_dispensing')
        .select('id, patient_id, prescription_data, encounter_id').eq('id', dispensingId).single();
      if (!disp) return { success: false, error: 'Dispensing record not found' };

      const items = disp.prescription_data || [];
      const totalAmount = items.reduce((s: number, i: any) => s + (parseFloat(i.price || 0) * (i.qty || 1)), 0) || 200;

      await sb().from('hmis_charge_log').insert({
        centre_id: centreId, patient_id: disp.patient_id,
        category: 'pharmacy', description: `Pharmacy (${items.length} items)`,
        quantity: 1, unit_rate: totalAmount, amount: totalAmount,
        service_date: new Date().toISOString().split('T')[0], status: 'posted', captured_by: staffId,
        source: 'leakage_recovery', source_ref_id: dispensingId, source_ref_type: 'pharmacy_dispense',
      });

      await sb().from('hmis_pharmacy_dispensing').update({ bill_id: 'leakage-recovery' }).eq('id', dispensingId);

      return { success: true, amount: totalAmount };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally { setPosting(null); }
  }, [centreId]);

  const markBilled = useCallback(async (chargeLogId: string, billId?: string) => {
    if (!sb()) return { success: false };
    const sourceId = chargeLogId.replace(/^ch-/, '');
    await sb().from('hmis_charge_log').update({
      bill_id: billId || 'manual', status: 'billed',
    }).eq('id', sourceId);
    return { success: true };
  }, []);

  return { posting, postRoomCharge, postLabCharge, postPharmacyCharge, markBilled };
}
