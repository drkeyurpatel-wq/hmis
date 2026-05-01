// lib/quality/api-helpers.ts
// Quality/NABH module — untyped client (same pattern as billing)
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _client: any = null;

export function qualityDb(): any {
  if (!_client) {
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

export async function qualityAuth(request: NextRequest) {
  const { user, staff, error } = await requireAuth(request);
  if (error) return { user: null, staff: null, centreId: null, error };

  const { data: assignment } = await qualityDb()
    .from('hmis_staff')
    .select('centre_id')
    .eq('id', staff!.id)
    .single();

  return {
    user: user!,
    staff: staff!,
    centreId: assignment?.centre_id || null,
    error: null,
  };
}

export function qualityRpc(fnName: string, params: Record<string, any>) {
  return qualityDb().rpc(fnName, params);
}

export function qualityError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function qualitySuccess(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
