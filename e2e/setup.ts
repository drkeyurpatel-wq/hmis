// e2e/setup.ts — Shared test utilities
import { test as base, APIRequestContext } from '@playwright/test';

const SUPABASE_URL = 'https://bmuupgrzbfmddjwcqlss.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdXVwZ3J6YmZtZGRqd2NxbHNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYwMzA2NCwiZXhwIjoyMDg5MTc5MDY0fQ.AnG5g5iZsu8xn0oMWCIWQ7C1h9FXIgyv1-ApXFngt1k';
const CENTRE_ID = 'c0000001-0000-0000-0000-000000000001';
const KEYUR_STAFF_ID = 'b0000001-0000-0000-0000-000000000001';

export { SUPABASE_URL, SERVICE_KEY, CENTRE_ID, KEYUR_STAFF_ID };

export async function supabaseGet(request: APIRequestContext, table: string, select: string, filters: string = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=100${filters ? '&' + filters : ''}`;
  return request.get(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  });
}

export async function supabasePost(request: APIRequestContext, table: string, data: any) {
  return request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    data,
  });
}

export async function supabasePatch(request: APIRequestContext, table: string, data: any, filters: string) {
  return request.patch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    data,
  });
}

export async function supabaseDelete(request: APIRequestContext, table: string, filters: string) {
  return request.delete(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  });
}

export async function supabaseRpc(request: APIRequestContext, fn: string, params: any = {}) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    data: params,
  });
}
