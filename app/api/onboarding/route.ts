// POST /api/onboarding — Provision a new centre (multi-tenant setup)
// No code changes needed to add a hospital. Just call this API.
// Requires: service_role or admin staff JWT

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api/auth-guard';
import { NextResponse, type NextRequest } from 'next/server';

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface OnboardingRequest {
  hospital_name: string;
  short_code: string; // e.g. "H1-SHL" — used for UHIDs, bill prefixes
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  entity_type: 'owned' | 'leased' | 'o_and_m' | 'partnership';
  // Optional
  hfr_id?: string;
  nabh_id?: string;
  rohini_id?: string;
  gstin?: string;
  pan?: string;
  beds_licensed?: number;
  beds_operational?: number;
  // Admin user
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  // Seed data
  seed_departments?: boolean; // Create standard departments
  seed_wards?: boolean; // Create standard ward types
  seed_roles?: boolean; // Create standard RBAC roles
  seed_tariffs?: boolean; // Copy tariff master from a template centre
  template_centre_id?: string; // Centre to copy config from
}

const STANDARD_DEPARTMENTS = [
  { name: 'General Medicine', type: 'clinical', code: 'MED' },
  { name: 'General Surgery', type: 'clinical', code: 'SUR' },
  { name: 'Orthopaedics', type: 'clinical', code: 'ORT' },
  { name: 'Cardiology', type: 'clinical', code: 'CAR' },
  { name: 'Neurology', type: 'clinical', code: 'NEU' },
  { name: 'Paediatrics', type: 'clinical', code: 'PED' },
  { name: 'Obstetrics & Gynaecology', type: 'clinical', code: 'OBG' },
  { name: 'ENT', type: 'clinical', code: 'ENT' },
  { name: 'Ophthalmology', type: 'clinical', code: 'OPH' },
  { name: 'Dermatology', type: 'clinical', code: 'DER' },
  { name: 'Urology', type: 'clinical', code: 'URO' },
  { name: 'Nephrology', type: 'clinical', code: 'NEP' },
  { name: 'Gastroenterology', type: 'clinical', code: 'GAS' },
  { name: 'Pulmonology', type: 'clinical', code: 'PUL' },
  { name: 'Oncology', type: 'clinical', code: 'ONC' },
  { name: 'Psychiatry', type: 'clinical', code: 'PSY' },
  { name: 'Anaesthesiology', type: 'clinical', code: 'ANE' },
  { name: 'Emergency Medicine', type: 'clinical', code: 'ER' },
  { name: 'Critical Care (ICU)', type: 'clinical', code: 'ICU' },
  { name: 'Radiology', type: 'support', code: 'RAD' },
  { name: 'Laboratory', type: 'support', code: 'LAB' },
  { name: 'Pharmacy', type: 'support', code: 'PHR' },
  { name: 'Physiotherapy', type: 'support', code: 'PHY' },
  { name: 'Dietary', type: 'support', code: 'DIT' },
  { name: 'CSSD', type: 'support', code: 'CSD' },
  { name: 'Blood Bank', type: 'support', code: 'BBK' },
  { name: 'Administration', type: 'admin', code: 'ADM' },
  { name: 'Billing', type: 'admin', code: 'BIL' },
  { name: 'Human Resources', type: 'admin', code: 'HR' },
  { name: 'Housekeeping', type: 'admin', code: 'HSK' },
];

const STANDARD_WARD_TYPES = [
  { name: 'General Ward', type: 'general', floor: 'Ground' },
  { name: 'Semi-Private Ward', type: 'semi_private', floor: '1st' },
  { name: 'Private Ward', type: 'private', floor: '2nd' },
  { name: 'Deluxe Ward', type: 'private', floor: '2nd' },
  { name: 'ICU', type: 'icu', floor: '1st' },
  { name: 'NICU', type: 'nicu', floor: '1st' },
  { name: 'Isolation Ward', type: 'isolation', floor: 'Ground' },
  { name: 'Emergency Ward', type: 'general', floor: 'Ground' },
  { name: 'Labour Room', type: 'general', floor: '1st' },
  { name: 'OT Recovery', type: 'general', floor: '1st' },
];

const STANDARD_ROLES = [
  { name: 'Super Admin', role_key: 'super_admin', description: 'Full system access', permissions: { '*': ['*'] } },
  { name: 'Doctor', role_key: 'doctor', description: 'Clinical access — EMR, OPD, IPD, orders', permissions: { emr: ['*'], opd: ['*'], ipd: ['*'], patients: ['*'], lab: ['view'], radiology: ['view'], pharmacy: ['view'] } },
  { name: 'Nurse', role_key: 'nurse', description: 'Nursing — vitals, MAR, IO, notes', permissions: { ipd: ['*'], emr: ['view', 'create'], patients: ['view'], pharmacy: ['view'], lab: ['view'] } },
  { name: 'Receptionist', role_key: 'receptionist', description: 'Front desk — registration, appointments, billing', permissions: { patients: ['*'], opd: ['*'], billing: ['*'], appointments: ['*'] } },
  { name: 'Lab Technician', role_key: 'lab_tech', description: 'Lab — orders, results, QC', permissions: { lab: ['*'], patients: ['view'] } },
  { name: 'Pharmacist', role_key: 'pharmacist', description: 'Pharmacy — dispensing, stock, returns', permissions: { pharmacy: ['*'], patients: ['view'] } },
  { name: 'Radiologist', role_key: 'radiologist', description: 'Radiology — reporting, PACS', permissions: { radiology: ['*'], patients: ['view'] } },
  { name: 'Accountant', role_key: 'accountant', description: 'Finance — billing, collections, reports', permissions: { billing: ['*'], mis: ['*'] } },
];

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body: OnboardingRequest = await request.json();

    // Validate required fields
    if (!body.hospital_name || !body.short_code || !body.admin_email) {
      return NextResponse.json({ error: 'hospital_name, short_code, and admin_email are required' }, { status: 400 });
    }

    const results: Record<string, any> = {};

    // 1. Create centre
    const { data: centre, error: centreErr } = await getSupabase().from('hmis_centres').insert({
      name: body.hospital_name, short_code: body.short_code, city: body.city,
      state: body.state, address: body.address, phone: body.phone, email: body.email,
      entity_type: body.entity_type || 'owned',
      hfr_id: body.hfr_id, nabh_id: body.nabh_id, rohini_id: body.rohini_id,
      gstin: body.gstin, pan: body.pan,
      beds_licensed: body.beds_licensed, beds_operational: body.beds_operational,
      is_active: true,
    }).select().single();

    if (centreErr) return NextResponse.json({ error: `Centre creation failed: ${centreErr.message}` }, { status: 500 });
    results.centre = { id: centre.id, name: centre.name };

    // 2. Create admin user in Supabase Auth
    const { data: authUser, error: authErr } = await getSupabase().auth.admin.createUser({
      email: body.admin_email, password: body.short_code.toLowerCase() + '@2026', // Temp password
      email_confirm: true,
      user_metadata: { full_name: body.admin_name, role: 'admin' },
    });

    if (authErr && !authErr.message.includes('already registered')) {
      results.admin_auth = { error: authErr.message };
    } else {
      const authId = authUser?.user?.id || null;

      // 3. Create staff record
      const { data: staffRec } = await getSupabase().from('hmis_staff').insert({
        auth_user_id: authId, full_name: body.admin_name, staff_type: 'admin',
        designation: 'Administrator', email: body.admin_email, phone: body.admin_phone,
        is_active: true,
      }).select().single();

      if (staffRec) {
        // Link staff to centre
        await getSupabase().from('hmis_staff_centres').insert({
          staff_id: staffRec.id, centre_id: centre.id, is_primary: true,
        });
        results.admin = { id: staffRec.id, name: body.admin_name, temp_password: body.short_code.toLowerCase() + '@2026' };
      }
    }

    // 4. Seed departments
    if (body.seed_departments !== false) {
      const depts = STANDARD_DEPARTMENTS.map(d => ({ ...d, centre_id: centre.id, is_active: true }));
      const { data } = await getSupabase().from('hmis_departments').insert(depts).select('id');
      results.departments = { count: data?.length || 0 };
    }

    // 5. Seed wards
    if (body.seed_wards !== false) {
      const wards = STANDARD_WARD_TYPES.map(w => ({ ...w, centre_id: centre.id, is_active: true }));
      const { data } = await getSupabase().from('hmis_wards').insert(wards).select('id');
      results.wards = { count: data?.length || 0 };
    }

    // 6. Seed roles
    if (body.seed_roles !== false) {
      const roles = STANDARD_ROLES.map(r => ({ ...r, centre_id: centre.id }));
      const { data } = await getSupabase().from('hmis_roles').insert(roles).select('id');
      results.roles = { count: data?.length || 0 };
    }

    // 7. Copy tariffs from template centre
    if (body.seed_tariffs && body.template_centre_id) {
      const { data: srcTariffs } = await getSupabase().from('hmis_tariff_master').select('*')
        .eq('centre_id', body.template_centre_id).eq('is_active', true);
      if (srcTariffs && srcTariffs.length > 0) {
        const newTariffs = srcTariffs.map(t => {
          const { id, centre_id, created_at, ...rest } = t;
          return { ...rest, centre_id: centre.id };
        });
        const { data } = await getSupabase().from('hmis_tariff_master').insert(newTariffs).select('id');
        results.tariffs = { count: data?.length || 0, copied_from: body.template_centre_id };
      }
    }

    // 8. Create UHID sequence for new centre
    await getSupabase().from('hmis_sequences').upsert({
      centre_id: centre.id, sequence_type: 'uhid',
      prefix: body.short_code, current_value: 0, padding: 6,
    }, { onConflict: 'centre_id,sequence_type' });

    // Bill number sequence
    await getSupabase().from('hmis_sequences').upsert({
      centre_id: centre.id, sequence_type: 'bill',
      prefix: body.short_code + '-B', current_value: 0, padding: 6,
    }, { onConflict: 'centre_id,sequence_type' });

    // IPD number sequence
    await getSupabase().from('hmis_sequences').upsert({
      centre_id: centre.id, sequence_type: 'ipd',
      prefix: body.short_code + '-IP', current_value: 0, padding: 5,
    }, { onConflict: 'centre_id,sequence_type' });

    results.sequences = { uhid: body.short_code, bill: body.short_code + '-B', ipd: body.short_code + '-IP' };

    return NextResponse.json({
      success: true,
      message: `Centre "${body.hospital_name}" provisioned successfully`,
      ...results,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/onboarding — list all centres with provisioning status
export async function GET(req: NextRequest) {
  const { data: centres } = await getSupabase().from('hmis_centres')
    .select('id, name, short_code, city, state, entity_type, is_active, beds_licensed, beds_operational, created_at')
    .order('name');

  const enriched = await Promise.all((centres || []).map(async c => {
    const [depts, wards, staff, tariffs] = await Promise.all([
      getSupabase().from('hmis_departments').select('id', { count: 'exact', head: true }).eq('centre_id', c.id),
      getSupabase().from('hmis_wards').select('id', { count: 'exact', head: true }).eq('centre_id', c.id),
      getSupabase().from('hmis_staff_centres').select('id', { count: 'exact', head: true }).eq('centre_id', c.id),
      getSupabase().from('hmis_tariff_master').select('id', { count: 'exact', head: true }).eq('centre_id', c.id).eq('is_active', true),
    ]);
    return {
      ...c,
      departments: depts.count || 0, wards: wards.count || 0,
      staff: staff.count || 0, tariffs: tariffs.count || 0,
    };
  }));

  return NextResponse.json({ centres: enriched });
}
