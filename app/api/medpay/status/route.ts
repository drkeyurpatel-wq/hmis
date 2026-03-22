export const dynamic = "force-dynamic";
// app/api/medpay/status/route.ts
// GET: MedPay integration status — connection test, sync stats

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MEDPAY_URL = process.env.MEDPAY_SUPABASE_URL || 'https://kffuqxylyhpwecojnuou.supabase.co';
const MEDPAY_KEY = process.env.MEDPAY_SERVICE_ROLE_KEY || '';

export async function GET() {
  const db = createClient(HMIS_URL, HMIS_KEY);

  // HMIS stats
  const { count: totalBills } = await db.from('hmis_bills').select('id', { count: 'exact', head: true }).in('status', ['final', 'paid', 'partially_paid']);
  const { count: syncedBills } = await db.from('hmis_bills').select('id', { count: 'exact', head: true }).eq('medpay_synced', true);
  const { count: unsyncedBills } = await db.from('hmis_bills').select('id', { count: 'exact', head: true }).eq('medpay_synced', false).in('status', ['final', 'paid', 'partially_paid']);
  const { count: mappedDoctors } = await db.from('hmis_medpay_doctor_map').select('id', { count: 'exact', head: true });
  const { count: totalDoctors } = await db.from('hmis_staff').select('id', { count: 'exact', head: true }).eq('staff_type', 'doctor').eq('is_active', true);

  // Recent syncs
  const { data: recentSyncs } = await db.from('hmis_medpay_sync_log')
    .select('id, bill_id, rows_pushed, status, created_at')
    .order('created_at', { ascending: false }).limit(10);

  // MedPay connection test
  let medpayConnected = false;
  let medpayDoctorCount = 0;
  let medpayRowCount = 0;

  if (MEDPAY_KEY) {
    try {
      const mp = createClient(MEDPAY_URL, MEDPAY_KEY);
      const { count: dc } = await mp.from('doctors').select('id', { count: 'exact', head: true }).eq('active', true);
      const { count: rc } = await mp.from('billing_rows').select('id', { count: 'exact', head: true });
      medpayConnected = true;
      medpayDoctorCount = dc || 0;
      medpayRowCount = rc || 0;
    } catch {}
  }

  return NextResponse.json({
    medpay_connected: medpayConnected,
    medpay_url: MEDPAY_URL,
    medpay_doctors: medpayDoctorCount,
    medpay_billing_rows: medpayRowCount,
    hmis_total_bills: totalBills || 0,
    hmis_synced_bills: syncedBills || 0,
    hmis_unsynced_bills: unsyncedBills || 0,
    hmis_total_doctors: totalDoctors || 0,
    hmis_mapped_doctors: mappedDoctors || 0,
    recent_syncs: recentSyncs || [],
  });
}
