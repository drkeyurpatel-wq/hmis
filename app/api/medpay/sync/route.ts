export const dynamic = "force-dynamic";
// app/api/medpay/sync/route.ts
// POST: Push finalized HMIS bills to MedPay
// GET: Check sync status / get unsynced bills

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  transformBillToMedPayRows,
  createMedPayUpload,
  pushBillingRows,
  mapPayorToSponsor,
  type HMISBillForMedPay,
} from '@/lib/integrations/medpay-client';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function hmis() {
  return createClient(HMIS_URL, HMIS_KEY);
}

// Centre ID → Name
const CENTRES: Record<string, string> = {
  'c0000001-0000-0000-0000-000000000001': 'Shilaj',
  'c0000001-0000-0000-0000-000000000002': 'Vastral',
  'c0000001-0000-0000-0000-000000000003': 'Modasa',
  'c0000001-0000-0000-0000-000000000004': 'Gandhinagar',
  'c0000001-0000-0000-0000-000000000005': 'Udaipur',
};

// ── GET: List unsynced bills ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const centreId = searchParams.get('centre_id');
  const month = searchParams.get('month'); // '2026-03'

  const db = hmis();
  let q = db.from('hmis_bills')
    .select(`id, bill_number, bill_type, bill_date, payor_type, net_amount, status, medpay_synced,
      patient:hmis_patients(first_name, last_name),
      centre:hmis_centres(name)`)
    .in('status', ['final', 'paid', 'partially_paid'])
    .eq('medpay_synced', false)
    .order('bill_date', { ascending: false })
    .limit(200);

  if (centreId) q = q.eq('centre_id', centreId);
  if (month) {
    q = q.gte('bill_date', `${month}-01`).lte('bill_date', `${month}-31`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    unsynced_count: data?.length || 0,
    bills: (data || []).map(b => ({
      id: b.id,
      bill_number: b.bill_number,
      bill_type: b.bill_type,
      bill_date: b.bill_date,
      payor_type: b.payor_type,
      net_amount: b.net_amount,
      patient_name: `${(b as any).patient?.first_name || ''} ${(b as any).patient?.last_name || ''}`.trim(),
      centre: (b as any).centre?.name || '',
    })),
  });
}

// ── POST: Sync bills to MedPay ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bill_ids, centre_id, month, staff_id, sync_all } = body;

    if (!process.env.MEDPAY_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'MEDPAY_SERVICE_ROLE_KEY not configured' }, { status: 500 });
    }

    const db = hmis();

    // Build query for bills to sync
    let billQuery = db.from('hmis_bills')
      .select(`id, bill_number, bill_type, bill_date, centre_id, payor_type, insurer_name,
        net_amount, status, billing_category,
        patient:hmis_patients!inner(first_name, last_name, uhid),
        items:hmis_bill_items(
          id, description, quantity, unit_rate, amount, net_amount, category,
          department:hmis_departments(name),
          doctor:hmis_staff!hmis_bill_items_doctor_id_fkey(full_name),
          service_doctor:hmis_staff!hmis_bill_items_service_doctor_id_fkey(full_name),
          consulting_doctor:hmis_staff!hmis_bill_items_consulting_doctor_id_fkey(full_name)
        )`)
      .in('status', ['final', 'paid', 'partially_paid'])
      .eq('medpay_synced', false);

    if (bill_ids?.length) {
      billQuery = billQuery.in('id', bill_ids);
    } else if (centre_id && month) {
      billQuery = billQuery.eq('centre_id', centre_id)
        .gte('bill_date', `${month}-01`).lte('bill_date', `${month}-31`);
    } else if (sync_all) {
      billQuery = billQuery.limit(500);
    } else {
      return NextResponse.json({ error: 'Provide bill_ids, centre_id+month, or sync_all' }, { status: 400 });
    }

    const { data: bills, error: billErr } = await billQuery;
    if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });
    if (!bills?.length) return NextResponse.json({ message: 'No unsynced bills found', synced: 0 });

    // Get admission data for IPD bills (consulting doctor, referring doctor, room category)
    const ipdBillIds = bills.filter(b => b.bill_type === 'ipd').map(b => b.id);
    let admissionMap: Record<string, any> = {};

    if (ipdBillIds.length > 0) {
      // encounter_id stores admission_id for IPD bills
      const { data: admissions } = await db.from('hmis_admissions')
        .select(`id, ipd_number, payor_type, provisional_diagnosis,
          primary_doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
          bed:hmis_beds!hmis_beds_current_admission_id_fkey(
            room:hmis_rooms(room_type, ward:hmis_wards(type))
          )`)
        .in('id', bills.filter(b => b.bill_type === 'ipd').map(b => (b as any).encounter_id || b.id));

      (admissions || []).forEach((a: any) => {
        const bedArr = Array.isArray(a.bed) ? a.bed : a.bed ? [a.bed] : [];
        const bed = bedArr[0];
        admissionMap[a.id] = {
          ipd_number: a.ipd_number,
          consulting_doctor: a.primary_doctor?.full_name || '',
          room_type: bed?.room?.ward?.type || bed?.room?.room_type || '',
        };
      });
    }

    // Group bills by centre + month for MedPay upload records
    const groups: Record<string, typeof bills> = {};
    for (const bill of bills) {
      const centre = CENTRES[bill.centre_id] || 'Unknown';
      const month = bill.bill_date?.slice(0, 7) || 'unknown';
      const key = `${centre}|${month}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(bill);
    }

    let totalPushed = 0;
    const errors: string[] = [];

    for (const [key, groupBills] of Object.entries(groups)) {
      const [centre, month] = key.split('|');

      // Create upload record in MedPay
      const allRows: any[] = [];

      for (const bill of groupBills) {
        const patient = (bill as any).patient;
        const items = (bill as any).items || [];
        const admission = admissionMap[(bill as any).encounter_id] || {};

        const medpayBill: HMISBillForMedPay = {
          bill_id: bill.id,
          bill_number: bill.bill_number,
          bill_date: bill.bill_date,
          bill_type: bill.bill_type,
          centre_id: bill.centre_id,
          payor_type: bill.payor_type,
          insurer_name: bill.insurer_name || undefined,
          patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
          ipd_number: admission.ipd_number || '',
          consulting_doctor_name: admission.consulting_doctor || '',
          referring_doctor_name: '', // TODO: from referral data
          billing_category: admission.room_type || bill.billing_category || '',
          items: items.map((item: any) => ({
            description: item.description,
            department: item.department?.name || '',
            quantity: item.quantity || 1,
            unit_rate: item.unit_rate || 0,
            amount: item.amount || 0,
            net_amount: item.net_amount || item.amount || 0,
            // Service doctor: use dedicated field, or fall back to item doctor
            service_doctor_name: item.service_doctor?.full_name || item.doctor?.full_name || '',
            // Consulting doctor: use dedicated field, or fall back to admission doctor
            consulting_doctor_name: item.consulting_doctor?.full_name || admission.consulting_doctor || '',
            category: item.category || '',
          })),
        };

        const rows = transformBillToMedPayRows(medpayBill, 0); // upload_id set below
        allRows.push(...rows.map(r => ({ ...r, _bill_id: bill.id })));
      }

      if (allRows.length === 0) continue;

      // Create MedPay upload
      const upload = await createMedPayUpload(centre, month, allRows.length, 'hmis_auto');
      if (!upload.id) {
        errors.push(`Upload creation failed for ${centre} ${month}: ${upload.error}`);
        continue;
      }

      // Set upload_id on all rows
      const rowsWithUpload = allRows.map(({ _bill_id, ...r }) => ({ ...r, upload_id: upload.id! }));

      // Push to MedPay
      const pushResult = await pushBillingRows(rowsWithUpload);
      if (!pushResult.success) {
        errors.push(`Push failed for ${centre} ${month}: ${pushResult.error}`);
        continue;
      }

      totalPushed += pushResult.count;

      // Mark bills as synced in HMIS
      const syncedBillIds = groupBills.map(b => b.id);
      await db.from('hmis_bills').update({
        medpay_synced: true,
        medpay_synced_at: new Date().toISOString(),
        medpay_upload_id: upload.id,
      }).in('id', syncedBillIds);

      // Log sync
      for (const billId of syncedBillIds) {
        await db.from('hmis_medpay_sync_log').insert({
          bill_id: billId,
          direction: 'push',
          rows_pushed: allRows.filter(r => r._bill_id === billId).length || 1,
          medpay_upload_id: upload.id,
          status: 'success',
          synced_by: staff_id || null,
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      synced_bills: bills.length,
      rows_pushed: totalPushed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
