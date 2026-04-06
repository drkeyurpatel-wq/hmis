// app/api/rcm/contracts/route.ts
// GET: list contracts (optional filters: doctor_id, centre_id, active)
// POST: create new contract

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logPayoutAudit } from '@/lib/rcm/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const doctorId = url.searchParams.get('doctor_id');
    const centreId = url.searchParams.get('centre_id');
    const activeOnly = url.searchParams.get('active') !== 'false';

    let query = sb
      .from('hmis_doctor_contracts')
      .select('*, doctor:hmis_staff!hmis_doctor_contracts_doctor_id_fkey(id, full_name, specialisation, employee_code)')
      .order('created_at', { ascending: false });

    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (centreId) query = query.eq('centre_id', centreId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contracts: data || [],
      total: data?.length ?? 0,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { user_id, ...contractData } = body;

    // Validate required fields
    if (!contractData.doctor_id || !contractData.centre_id) {
      return NextResponse.json(
        { error: 'doctor_id and centre_id are required' },
        { status: 400 }
      );
    }

    // Deactivate any existing active contract for same doctor+centre
    await sb
      .from('hmis_doctor_contracts')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().substring(0, 10),
      })
      .eq('doctor_id', contractData.doctor_id)
      .eq('centre_id', contractData.centre_id)
      .eq('is_active', true);

    // Insert new contract
    const { data, error } = await sb
      .from('hmis_doctor_contracts')
      .insert({
        ...contractData,
        is_active: true,
        effective_from: contractData.effective_from || new Date().toISOString().substring(0, 10),
        created_by: user_id || null,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit
    await logPayoutAudit(sb, user_id || null, 'contract_created', 'contract', data.id, {
      doctor_id: contractData.doctor_id,
      centre_id: contractData.centre_id,
      contract_type: contractData.contract_type,
    });

    return NextResponse.json({ success: true, id: data.id });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
