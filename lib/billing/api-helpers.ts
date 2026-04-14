// lib/billing/api-helpers.ts
// Shared billing API helpers — service-role client + auth guard
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, requireCronSecret } from '@/lib/api/auth-guard';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _client: ReturnType<typeof createClient> | null = null;

export function billingDb() {
  if (!_client) {
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

// Auth wrapper for billing API routes
export async function billingAuth(request: NextRequest) {
  const { user, staff, error } = await requireAuth(request);
  if (error) return { user: null, staff: null, centreId: null, error };

  const { data: assignment } = await billingDb()
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

export function billingCronAuth(request: NextRequest) {
  return requireCronSecret(request);
}

export function billingError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function billingSuccess(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
