import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const pending = request.nextUrl.searchParams.get('pending');
  let q = db.from('px_escalation_log').select('*, complaint:hmis_px_complaints(category, description, status)')
    .eq('centre_id', centreId).order('escalated_at', { ascending: false }).limit(100);
  if (pending === 'true') q = q.eq('resolved', false);
  const { data } = await q;
  return NextResponse.json(data || []);
}
