import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const today = new Date().toISOString().split('T')[0];

  const [rooms, todayBookings, allBookings, implants, checklists, postOp, turnaround, equipment] = await Promise.all([
    db.from('hmis_ot_rooms').select('*').eq('centre_id', centreId).eq('is_active', true).order('name'),
    db.from('hmis_ot_bookings').select('*').eq('centre_id', centreId).gte('scheduled_date', today).lte('scheduled_date', today),
    db.from('hmis_ot_bookings').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('hmis_ot_implants').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('hmis_ot_safety_checklist').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('ot_post_op_monitoring').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'IN_PACU'),
    db.from('ot_turnaround_log').select('total_turnaround_minutes, met_target').eq('centre_id', centreId),
    db.from('ot_equipment_usage').select('id', { count: 'exact' }).eq('centre_id', centreId),
  ]);

  const turnaroundData = turnaround.data || [];
  const avgTurnaround = turnaroundData.length > 0 
    ? Math.round(turnaroundData.reduce((s: number, t: any) => s + (t.total_turnaround_minutes || 0), 0) / turnaroundData.length) 
    : 0;
  const targetMet = turnaroundData.filter((t: any) => t.met_target).length;

  return NextResponse.json({
    ot_rooms: rooms.data || [],
    today_cases: (todayBookings.data || []).length,
    today_schedule: todayBookings.data || [],
    total_bookings: allBookings.count || 0,
    total_implants: implants.count || 0,
    safety_checklists: checklists.count || 0,
    patients_in_pacu: postOp.count || 0,
    avg_turnaround_min: avgTurnaround,
    turnaround_target_met_pct: turnaroundData.length > 0 ? Math.round(targetMet / turnaroundData.length * 100) : 0,
    equipment_uses: equipment.count || 0,
  });
}
