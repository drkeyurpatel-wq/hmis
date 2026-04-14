// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const bundleId = request.nextUrl.searchParams.get('bundle_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  let q = db.from('quality_ipc_bundle_checks').select('*, bundle:quality_ipc_bundles(bundle_name, bundle_type)').eq('centre_id', centreId).order('check_date', { ascending: false }).limit(100);
  if (bundleId) q = q.eq('bundle_id', bundleId);
  const { data } = await q;
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const db = qualityDb();
  const body = await request.json();
  const items = body.checklist_responses || {};
  body.all_compliant = Object.values(items).every((v: any) => v === true || v === 'YES');
  body.non_compliant_items = Object.entries(items).filter(([,v]: any) => v === false || v === 'NO').map(([k]) => k);
  const { data, error } = await db.from('quality_ipc_bundle_checks').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
