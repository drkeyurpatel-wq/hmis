import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  const wardId = request.nextUrl.searchParams.get('ward_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  let q = db.from('hmis_beds').select('*, ward:hmis_wards(name, type)').eq('centre_id', centreId).eq('is_active', true).order('ward_id').order('bed_number');
  if (wardId) q = q.eq('ward_id', wardId);
  const { data: beds } = await q;

  // Group by ward
  const wardMap: Record<string, any> = {};
  for (const bed of (beds || [])) {
    const wn = bed.ward?.name || 'Unassigned';
    if (!wardMap[wn]) wardMap[wn] = { ward_name: wn, ward_type: bed.ward?.type, total: 0, occupied: 0, available: 0, beds: [] };
    wardMap[wn].total++;
    if (bed.status === 'occupied') wardMap[wn].occupied++;
    else wardMap[wn].available++;
    wardMap[wn].beds.push(bed);
  }

  return NextResponse.json({
    total_beds: (beds || []).length,
    occupied: (beds || []).filter(b => b.status === 'occupied').length,
    available: (beds || []).filter(b => b.status !== 'occupied').length,
    wards: Object.values(wardMap),
  });
}
