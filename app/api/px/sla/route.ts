// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const status = request.nextUrl.searchParams.get('status') || 'OPEN';
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('px_sla_breaches').select('*, sla:px_sla_config(category, priority, target_minutes)')
    .eq('centre_id', centreId).eq('status', status).order('requested_at', { ascending: false }).limit(100);
  return NextResponse.json(data || []);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, actual_minutes, notes } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const update: any = { status };
  if (actual_minutes) update.actual_minutes = actual_minutes;
  if (notes) update.notes = notes;
  if (status === 'RESOLVED') update.resolved_at = new Date().toISOString();
  const { data, error } = await db.from('px_sla_breaches').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
