import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest) {
  const supabase = billingDb();
  const sp = request.nextUrl.searchParams;
  const centreId = sp.get('centre_id');
  const q = sp.get('q') || '';
  const dept = sp.get('department');
  const category = sp.get('category');

  if (!centreId || q.length < 2) return NextResponse.json([]);

  let query = supabase
    .from('billing_service_masters')
    .select('*')
    .eq('centre_id', centreId)
    .eq('is_active', true)
    .or(`service_name.ilike.%${q}%,service_code.ilike.%${q}%`)
    .order('sort_order', { ascending: true })
    .order('service_name', { ascending: true })
    .limit(25);

  if (dept) query = query.eq('department', dept);
  if (category) query = query.eq('service_category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
