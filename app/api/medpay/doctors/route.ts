export const dynamic = "force-dynamic";
// app/api/medpay/doctors/route.ts
// GET: List HMIS doctors with MedPay mapping status
// POST: Create/update mapping

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { getMedPayDoctors, lookupMedPayDoctor } from '@/lib/integrations/medpay-client';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
function hmis() { return createClient(HMIS_URL, HMIS_KEY); }

// GET: list HMIS doctors + their MedPay mapping
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;

  const db = hmis();

  const { data: hmisStaff } = await db.from('hmis_staff')
    .select('id, full_name, specialisation, primary_centre_id')
    .eq('staff_type', 'doctor').eq('is_active', true).order('full_name');

  const { data: mappings } = await db.from('hmis_medpay_doctor_map')
    .select('hmis_staff_id, medpay_doctor_id, medpay_doctor_name, verified');

  const mapByStaff: Record<string, any> = {};
  (mappings || []).forEach(m => { mapByStaff[m.hmis_staff_id] = m; });

  let medpayDoctors: any[] = [];
  try {
    medpayDoctors = await getMedPayDoctors();
  } catch {}

  const result = (hmisStaff || []).map(s => ({
    hmis_id: s.id,
    name: s.full_name,
    specialisation: s.specialisation,
    centre_id: s.primary_centre_id,
    medpay_mapped: !!mapByStaff[s.id],
    medpay_doctor_id: mapByStaff[s.id]?.medpay_doctor_id || null,
    medpay_doctor_name: mapByStaff[s.id]?.medpay_doctor_name || null,
    verified: mapByStaff[s.id]?.verified || false,
  }));

  return NextResponse.json({
    hmis_doctors: result,
    medpay_doctors: medpayDoctors,
    mapped: result.filter(r => r.medpay_mapped).length,
    unmapped: result.filter(r => !r.medpay_mapped).length,
  });
}

// POST: create/update mapping
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;

  const { hmis_staff_id, medpay_doctor_id, auto_map } = await req.json();
  const db = hmis();

  // Auto-map: try to match all unmapped HMIS doctors to MedPay by name
  if (auto_map) {
    const { data: unmapped } = await db.from('hmis_staff')
      .select('id, full_name')
      .eq('staff_type', 'doctor').eq('is_active', true);

    const { data: existing } = await db.from('hmis_medpay_doctor_map').select('hmis_staff_id');
    const mappedIds = new Set((existing || []).map(m => m.hmis_staff_id));

    let matched = 0;
    for (const doc of (unmapped || [])) {
      if (mappedIds.has(doc.id)) continue;

      const mpDoc = await lookupMedPayDoctor(doc.full_name);
      if (mpDoc) {
        await db.from('hmis_medpay_doctor_map').upsert({
          hmis_staff_id: doc.id,
          medpay_doctor_id: mpDoc.id,
          medpay_doctor_name: mpDoc.name,
          verified: false, // auto-matched, needs human verification
        }, { onConflict: 'hmis_staff_id' });
        matched++;
      }
    }

    return NextResponse.json({ matched, total: (unmapped || []).length - mappedIds.size });
  }

  // Manual mapping
  if (!hmis_staff_id || !medpay_doctor_id) {
    return NextResponse.json({ error: 'hmis_staff_id and medpay_doctor_id required' }, { status: 400 });
  }

  // Get MedPay doctor name
  let mpName = '';
  try {
    const mpDocs = await getMedPayDoctors();
    const found = mpDocs.find(d => d.id === medpay_doctor_id);
    mpName = found?.name || '';
  } catch {}

  const { error } = await db.from('hmis_medpay_doctor_map').upsert({
    hmis_staff_id, medpay_doctor_id, medpay_doctor_name: mpName, verified: true,
  }, { onConflict: 'hmis_staff_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
