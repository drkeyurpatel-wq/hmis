import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const admissionId = request.nextUrl.searchParams.get('admission_id');
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (admissionId) {
    const { data } = await db.from('ipd_early_warning_scores').select('*').eq('admission_id', admissionId).order('calculated_at', { ascending: false }).limit(24);
    return NextResponse.json(data || []);
  }
  if (centreId) {
    const { data } = await db.from('ipd_early_warning_scores').select('*').eq('centre_id', centreId).eq('escalation_required', true).eq('escalated', false).order('calculated_at', { ascending: false }).limit(20);
    return NextResponse.json(data || []);
  }
  return NextResponse.json({ error: 'admission_id or centre_id required' }, { status: 400 });
}
