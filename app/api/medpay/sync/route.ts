export const dynamic = "force-dynamic";
// app/api/medpay/sync/route.ts
// POST: Push finalized HMIS bills to MedPay billing_rows
// GET: List unsynced bills
// MedPay's existing eCW flow is UNTOUCHED — this is an additional data source

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MEDPAY_URL = process.env.MEDPAY_SUPABASE_URL || '';
const MEDPAY_KEY = process.env.MEDPAY_SERVICE_ROLE_KEY || '';

function hmis() { return createClient(HMIS_URL, HMIS_KEY); }
function medpay() {
  if (!MEDPAY_KEY) throw new Error('MEDPAY_SERVICE_ROLE_KEY not set');
  return createClient(MEDPAY_URL, MEDPAY_KEY);
}

const CENTRE_NAMES: Record<string, string> = {
  'c0000001-0000-0000-0000-000000000001': 'Shilaj',
  'c0000001-0000-0000-0000-000000000002': 'Vastral',
  'c0000001-0000-0000-0000-000000000003': 'Modasa',
  'c0000001-0000-0000-0000-000000000004': 'Gandhinagar',
  'c0000001-0000-0000-0000-000000000005': 'Udaipur',
};

function payorToSponsor(payorType: string, insurerName?: string): string {
  const map: Record<string, string> = {
    self: 'CASH', insurance: insurerName?.toUpperCase() || 'CASHLESS',
    corporate: insurerName?.toUpperCase() || 'CORPORATE',
    govt_pmjay: 'PMJAY', govt_cghs: 'CGHS', govt_esi: 'ESI',
  };
  return map[payorType] || 'CASH';
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// ── GET: list unsynced bills ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const centreId = searchParams.get('centre_id');
  const month = searchParams.get('month');

  const db = hmis();
  let q = db.from('hmis_bills')
    .select(`id, bill_number, bill_type, bill_date, payor_type, net_amount, status,
      medpay_synced, case_type, billing_category,
      patient:hmis_patients(first_name, last_name, uhid)`)
    .in('status', ['final', 'paid', 'partially_paid'])
    .eq('medpay_synced', false)
    .order('bill_date', { ascending: false }).limit(500);

  if (centreId) q = q.eq('centre_id', centreId);
  if (month) q = q.gte('bill_date', `${month}-01`).lte('bill_date', `${month}-31`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    unsynced: data?.length || 0,
    bills: (data || []).map((b: any) => ({
      id: b.id, bill_number: b.bill_number, bill_type: b.bill_type,
      bill_date: b.bill_date, net_amount: b.net_amount,
      patient: `${b.patient?.first_name || ''} ${b.patient?.last_name || ''}`.trim(),
      payor: b.payor_type, case_type: b.case_type, category: b.billing_category,
    })),
  });
}

// ── POST: sync bills → MedPay ──
export async function POST(req: NextRequest) {
  try {
    const { bill_ids, centre_id, month, staff_id, sync_all } = await req.json();
    if (!MEDPAY_KEY) return NextResponse.json({ error: 'MEDPAY_SERVICE_ROLE_KEY not set' }, { status: 500 });

    const db = hmis();
    const mp = medpay();

    // Step 1: Auto-populate doctors on any bill that hasn't been populated yet
    if (bill_ids?.length) {
      for (const id of bill_ids) {
        await db.rpc('hmis_populate_bill_doctors', { p_bill_id: id });
      }
    }

    // Step 2: Query bills with all pre-populated fields
    let q = db.from('hmis_bills')
      .select(`id, bill_number, bill_type, bill_date, centre_id, payor_type,
        insurer_name, case_type, billing_category, admission_id,
        patient:hmis_patients!inner(first_name, last_name, uhid),
        items:hmis_bill_items(
          description, quantity, unit_rate, amount, net_amount, service_category,
          billing_category, admission_id, package_id,
          department:hmis_departments(name),
          package:hmis_packages!hmis_bill_items_package_id_fkey(name),
          service_doctor:hmis_staff!hmis_bill_items_service_doctor_id_fkey(full_name),
          consulting_doctor:hmis_staff!hmis_bill_items_consulting_doctor_id_fkey(full_name),
          referring_doctor_name, ot_booking_id
        )`)
      .in('status', ['final', 'paid', 'partially_paid'])
      .eq('medpay_synced', false);

    if (bill_ids?.length) q = q.in('id', bill_ids);
    else if (centre_id && month) q = q.eq('centre_id', centre_id).gte('bill_date', `${month}-01`).lte('bill_date', `${month}-31`);
    else if (sync_all) q = q.limit(500);
    else return NextResponse.json({ error: 'Provide bill_ids, centre_id+month, or sync_all' }, { status: 400 });

    const { data: bills, error: billErr } = await q;
    if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });
    if (!bills?.length) return NextResponse.json({ message: 'No unsynced bills', synced: 0 });

    // Step 3: Get IPD numbers for admission-linked bills
    const admIds = [...new Set(bills.map(b => (b as any).admission_id).filter(Boolean))];
    const admMap: Record<string, string> = {};
    const pkgMap: Record<string, string> = {}; // admission_id → package_name
    if (admIds.length) {
      const { data: adms } = await db.from('hmis_admissions').select('id, ipd_number').in('id', admIds);
      (adms || []).forEach((a: any) => { admMap[a.id] = a.ipd_number; });
      // Lookup package names via utilization
      const { data: pkgUtils } = await db.from('hmis_package_utilization')
        .select('admission_id, pkg:hmis_packages(package_name, name)').in('admission_id', admIds);
      (pkgUtils || []).forEach((u: any) => { pkgMap[u.admission_id] = u.pkg?.package_name || u.pkg?.name || ''; });
    }

    // Step 4: Get OT surgery details for items with ot_booking_id
    const otIds = [...new Set(bills.flatMap(b => ((b as any).items || []).map((i: any) => i.ot_booking_id).filter(Boolean)))];
    const otMap: Record<string, any> = {};
    if (otIds.length) {
      const { data: ots } = await db.from('hmis_ot_bookings')
        .select(`id, procedure_name, surgeon_charges, asst_surgeon_charges, anaesthetist_charges,
          surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
          asst:hmis_staff!hmis_ot_bookings_assistant_surgeon_id_fkey(full_name),
          anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name)`)
        .in('id', otIds);
      (ots || []).forEach((o: any) => { otMap[o.id] = o; });
    }

    // Step 5: Group by centre+month, create uploads, push rows
    const groups: Record<string, any[]> = {};
    for (const bill of bills) {
      const centre = CENTRE_NAMES[bill.centre_id] || 'Unknown';
      const m = bill.bill_date?.slice(0, 7) || 'unknown';
      const key = `${centre}|${m}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(bill);
    }

    let totalPushed = 0;
    let totalBills = 0;
    const errors: string[] = [];

    for (const [key, groupBills] of Object.entries(groups)) {
      const [centre, m] = key.split('|');

      // Build MedPay billing_rows
      const rows: any[] = [];
      for (const bill of groupBills) {
        const pt = (bill as any).patient;
        const items = (bill as any).items || [];
        const ipNo = admMap[(bill as any).admission_id] || '';
        const sponsor = payorToSponsor(bill.payor_type, bill.insurer_name);

        for (const item of items) {
          const ot = item.ot_booking_id ? otMap[item.ot_booking_id] : null;

          rows.push({
            upload_id: 0, // set after creating upload
            centre,
            month: m,
            bill_no: bill.bill_number,
            bill_date: fmtDate(bill.bill_date),
            patient_name: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            ip_no: ipNo,
            // Clean FK-resolved names — no aliases, no fuzzy matching
            consulting_dr: item.consulting_doctor?.full_name || '',
            service_doctor: item.service_doctor?.full_name || '',
            ref_doctor: item.referring_doctor_name || '',
            sponsor,
            department: item.department?.name || '',
            service_name: item.description || '',
            // CRITICAL: net_amt is the base for MedPay calculations (not service_amt)
            service_amt: parseFloat(item.amount) || 0,
            doctor_amt: 0, // MedPay engine calculates from contracts
            net_amt: parseFloat(item.net_amount) || parseFloat(item.amount) || 0,
            hospital_amt: 0, // MedPay engine calculates
            qty: parseFloat(item.quantity) || 1,
            billing_category: item.billing_category || bill.billing_category || '',
            package_name: pkgMap[bill.admission_id] || '',
            case_type: bill.case_type || 'Hospital Case',
            _bill_id: bill.id, // internal, stripped before insert
          });
        }
      }

      if (!rows.length) continue;

      // Create upload record in MedPay
      const { data: upload, error: upErr } = await mp.from('file_uploads').insert({
        centre, month: m,
        filename: `hmis_sync_${centre}_${m}_${new Date().toISOString().slice(0, 10)}`,
        file_type: 'hmis_auto', // ← distinguishes from eCW 'dw_sw' imports
        row_count: rows.length,
        active: true,
        notes: `Auto-synced from HMIS. ${groupBills.length} bills, ${rows.length} line items.`,
      }).select('id').single();

      if (upErr) { errors.push(`${centre} ${m}: ${upErr.message}`); continue; }

      // Set upload_id and strip internal fields
      const cleanRows = rows.map(({ _bill_id, ...r }) => ({ ...r, upload_id: upload.id }));

      // Push in batches of 100
      let pushed = 0;
      for (let i = 0; i < cleanRows.length; i += 100) {
        const chunk = cleanRows.slice(i, i + 100);
        const { error: pushErr } = await mp.from('billing_rows').insert(chunk);
        if (pushErr) { errors.push(`${centre} ${m} batch ${i}: ${pushErr.message}`); break; }
        pushed += chunk.length;
      }
      totalPushed += pushed;
      totalBills += groupBills.length;

      // Mark synced in HMIS
      const syncedIds = groupBills.map(b => b.id);
      await db.from('hmis_bills').update({
        medpay_synced: true,
        medpay_synced_at: new Date().toISOString(),
        medpay_upload_id: upload.id,
      }).in('id', syncedIds);

      // Log
      await db.from('hmis_medpay_sync_log').insert({
        sync_type: 'bill_push', centre_id: centre_id || null,
        month: m, bills_synced: groupBills.length, rows_pushed: pushed,
        medpay_upload_id: upload.id, status: errors.length ? 'partial' : 'success',
        error_message: errors.length ? errors.join('; ') : null,
        synced_by: staff_id || null,
      });
    }

    return NextResponse.json({
      success: errors.length === 0,
      bills_synced: totalBills,
      rows_pushed: totalPushed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
