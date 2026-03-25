// app/api/staff/create/route.ts
// Creates a staff account: auth user (username@hmis.h1) + staff record + centre mapping
// Must be called by an authenticated admin

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Verify caller is authenticated admin
  const cookieStore = await cookies();
  const callerSb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await callerSb.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  // Check caller is admin
  const sb = adminSb();
  const { data: callerStaff } = await sb.from('hmis_staff')
    .select('staff_type').eq('auth_user_id', user.id).single();
  if (!callerStaff || callerStaff.staff_type !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const {
    username, password, fullName, employeeCode, phone,
    staffType, designation, centreId, roleName,
    departmentId, specialisation, medicalRegNo, email,
  } = body;

  if (!username || !password || !fullName || !centreId) {
    return NextResponse.json({ success: false, error: 'username, password, fullName, centreId required' }, { status: 400 });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (cleanUsername.length < 3) {
    return NextResponse.json({ success: false, error: 'Username must be at least 3 characters (letters, numbers, dots, dashes)' }, { status: 400 });
  }

  // Check username not taken
  const { data: existing } = await sb.from('hmis_staff')
    .select('id').eq('username', cleanUsername).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ success: false, error: `Username "${cleanUsername}" already taken` }, { status: 409 });
  }

  try {
    // 1. Create auth user with internal email
    const authEmail = `${cleanUsername}@hmis.h1`;
    const { data: authUser, error: authError } = await sb.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (authError || !authUser?.user) {
      return NextResponse.json({ success: false, error: authError?.message || 'Auth user creation failed' }, { status: 500 });
    }

    // 2. Get role ID
    const { data: role } = await sb.from('hmis_roles')
      .select('id').eq('name', roleName || 'staff').limit(1).single();

    // 3. Create staff record
    const { data: staff, error: staffError } = await sb.from('hmis_staff').insert({
      auth_user_id: authUser.user.id,
      username: cleanUsername,
      employee_code: employeeCode || cleanUsername.toUpperCase(),
      full_name: fullName,
      email: email || null, // Real email — for notifications, not login
      phone: phone || null,
      staff_type: staffType || 'staff',
      designation: designation || null,
      department_id: departmentId || null,
      specialisation: specialisation || null,
      medical_reg_no: medicalRegNo || null,
      primary_centre_id: centreId,
      is_active: true,
    }).select('id').single();

    if (staffError || !staff) {
      // Rollback: delete auth user
      await sb.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ success: false, error: staffError?.message || 'Staff record creation failed' }, { status: 500 });
    }

    // 4. Map to centre with role
    await sb.from('hmis_staff_centres').insert({
      staff_id: staff.id,
      centre_id: centreId,
      role_id: role?.id || null,
    });

    return NextResponse.json({
      success: true,
      staffId: staff.id,
      username: cleanUsername,
      authUserId: authUser.user.id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
