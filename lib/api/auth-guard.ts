// lib/api/auth-guard.ts
// Reusable auth guards for all API routes.
// Usage:
//   const { user, staff, error } = await requireAuth(request);
//   if (error) return error;

import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_SECRET = process.env.HMIS_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

function adminSb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ============================================================
// 1. requireAuth — verifies Supabase JWT from cookie or Bearer header
// For routes called from the frontend (authenticated user sessions)
// ============================================================
export async function requireAuth(request: NextRequest): Promise<{
  user: { id: string; email?: string } | null;
  staff: { id: string; staff_type: string; full_name: string } | null;
  error: NextResponse | null;
}> {
  const sb = adminSb();
  if (!sb) return { user: null, staff: null, error: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }) };

  // Try Bearer token first
  const authHeader = request.headers.get('authorization') || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  // Try cookie if no Bearer
  if (!token) {
    // Supabase stores JWT in cookie named sb-{project-ref}-auth-token
    const cookies = request.cookies.getAll();
    const sbCookie = cookies.find(c => c.name.includes('auth-token'));
    if (sbCookie) {
      try {
        const parsed = JSON.parse(sbCookie.value);
        token = parsed?.access_token || parsed?.[0]?.access_token || '';
      } catch {
        token = sbCookie.value;
      }
    }
  }

  if (!token) {
    return { user: null, staff: null, error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  // Verify JWT
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) {
    return { user: null, staff: null, error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  // Look up staff record
  const { data: staff } = await sb.from('hmis_staff')
    .select('id, staff_type, full_name')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!staff) {
    return { user, staff: null, error: NextResponse.json({ error: 'Staff record not found or inactive' }, { status: 403 }) };
  }

  return { user, staff, error: null };
}

// ============================================================
// 2. requireAdmin — requireAuth + must be admin staff_type
// ============================================================
export async function requireAdmin(request: NextRequest): Promise<{
  user: { id: string; email?: string } | null;
  staff: { id: string; staff_type: string; full_name: string } | null;
  error: NextResponse | null;
}> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (result.staff?.staff_type !== 'admin') {
    return { ...result, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return result;
}

// ============================================================
// 3. requireApiKey — for external integrations/webhooks
// Checks X-API-Key header or ?api_key query param
// ============================================================
export function requireApiKey(request: NextRequest): { valid: boolean; error: NextResponse | null } {
  const headerKey = request.headers.get('x-api-key') || '';
  const queryKey = request.nextUrl.searchParams.get('api_key') || '';
  const key = headerKey || queryKey;

  if (!key || !API_SECRET) {
    return { valid: false, error: NextResponse.json({ error: 'API key required' }, { status: 401 }) };
  }

  if (key !== API_SECRET) {
    return { valid: false, error: NextResponse.json({ error: 'Invalid API key' }, { status: 403 }) };
  }

  return { valid: true, error: null };
}

// ============================================================
// 4. requireCronSecret — for scheduled jobs
// Checks Authorization: Bearer <CRON_SECRET>
// ============================================================
export function requireCronSecret(request: NextRequest): { valid: boolean; error: NextResponse | null } {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !CRON_SECRET) {
    return { valid: false, error: NextResponse.json({ error: 'Cron secret required' }, { status: 401 }) };
  }

  if (token !== CRON_SECRET) {
    return { valid: false, error: NextResponse.json({ error: 'Invalid cron secret' }, { status: 403 }) };
  }

  return { valid: true, error: null };
}

// ============================================================
// 5. requireAuthOrApiKey — dual mode: frontend user OR external system
// ============================================================
export async function requireAuthOrApiKey(request: NextRequest): Promise<{
  mode: 'user' | 'api_key' | null;
  user: { id: string; email?: string } | null;
  staff: { id: string; staff_type: string; full_name: string } | null;
  error: NextResponse | null;
}> {
  // Try API key first (cheaper check)
  const apiKeyResult = requireApiKey(request);
  if (apiKeyResult.valid) return { mode: 'api_key', user: null, staff: null, error: null };

  // Try JWT auth
  const authResult = await requireAuth(request);
  if (!authResult.error) return { mode: 'user', ...authResult, error: null };

  return { mode: null, user: null, staff: null, error: NextResponse.json({ error: 'Authentication required (JWT or API key)' }, { status: 401 }) };
}
