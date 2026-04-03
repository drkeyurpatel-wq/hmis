export const dynamic = 'force-dynamic';
// app/api/integrations/vpms-items/route.ts
// GET: Returns the VPMS item catalog for HMIS pharmacy module.
// VPMS owns the item master; HMIS reads from it.
// Cached for 1 hour via Cache-Control headers.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';

const VPMS_URL = process.env.VPMS_SUPABASE_URL || '';
const VPMS_KEY = process.env.VPMS_SUPABASE_SERVICE_KEY || '';

function vpms() {
  if (!VPMS_URL || !VPMS_KEY) throw new Error('VPMS Supabase not configured');
  return createClient(VPMS_URL, VPMS_KEY);
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthOrApiKey(request);
  if (authError) return authError;

  if (!VPMS_URL || !VPMS_KEY) {
    return NextResponse.json(
      { configured: false, error: 'VPMS not configured. Set VPMS_SUPABASE_URL and VPMS_SUPABASE_SERVICE_KEY.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const centreCode = searchParams.get('centre') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000);

  try {
    const vpmsDb = vpms();

    let q = vpmsDb.from('item_master')
      .select('item_code, item_name, generic_name, category, unit, manufacturer, hsn_code, reorder_level, available_qty, mrp, purchase_rate')
      .eq('is_active', true)
      .order('item_name')
      .limit(limit);

    if (search) {
      q = q.or(`item_name.ilike.%${search}%,generic_name.ilike.%${search}%,item_code.ilike.%${search}%`);
    }
    if (category) {
      q = q.eq('category', category);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get categories for filter dropdown
    const { data: categories } = await vpmsDb.from('item_master')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null);

    const uniqueCategories = [...new Set((categories || []).map((c: any) => c.category).filter(Boolean))].sort();

    const response = NextResponse.json({
      items: data || [],
      count: (data || []).length,
      categories: uniqueCategories,
    });

    // Cache for 1 hour
    response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
