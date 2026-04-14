// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const [admissions, beds, wards, highFall, highBraden, ewsAlert, activePlans, activeRestraints, codeBluesToday, pacuPatients] = await Promise.all([
    db.from('hmis_admissions').select('id, status, department_id, bed_id, room_type', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'admitted'),
    db.from('hmis_beds').select('id, status, ward_id, type', { count: 'exact' }).eq('centre_id', centreId).eq('is_active', true),
    db.from('hmis_wards').select('id, name, type').eq('centre_id', centreId).eq('is_active', true),
    db.from('ipd_fall_risk_scores').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('risk_level', 'HIGH'),
    db.from('ipd_pressure_ulcer_risk').select('id', { count: 'exact' }).eq('centre_id', centreId).in('risk_level', ['HIGH', 'VERY_HIGH']),
    db.from('ipd_early_warning_scores').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('escalation_required', true).eq('escalated', false),
    db.from('ipd_care_plans').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'ACTIVE'),
    db.from('ipd_restraint_orders').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'ACTIVE'),
    db.from('ipd_code_blue_events').select('id', { count: 'exact' }).eq('centre_id', centreId).gte('activation_time', new Date().toISOString().split('T')[0]),
    db.from('ot_post_op_monitoring').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'IN_PACU'),
  ]);

  const bedData = beds.data || [];
  const occupied = bedData.filter(b => b.status === 'occupied').length;
  const total = bedData.length;

  return NextResponse.json({
    active_admissions: admissions.count || 0,
    total_beds: total,
    occupied_beds: occupied,
    available_beds: total - occupied,
    occupancy_pct: total > 0 ? Math.round(occupied / total * 100) : 0,
    wards: wards.data || [],
    high_fall_risk_patients: highFall.count || 0,
    high_pressure_risk_patients: highBraden.count || 0,
    ews_alerts_pending: ewsAlert.count || 0,
    active_care_plans: activePlans.count || 0,
    active_restraints: activeRestraints.count || 0,
    code_blue_today: codeBluesToday.count || 0,
    patients_in_pacu: pacuPatients.count || 0,
  });
}
