import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  const view = request.nextUrl.searchParams.get('view') || 'recent';
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  if (view === 'dashboard') {
    const { data } = await db.rpc('px_nps_dashboard', { p_centre_id: centreId, p_months: 6 });
    return NextResponse.json(data || []);
  }
  if (view === 'department') {
    const { data } = await db.rpc('px_nps_by_department', { p_centre_id: centreId });
    return NextResponse.json(data || []);
  }
  const { data } = await db.from('px_nps_scores').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { data, error } = await db.from('px_nps_scores').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
