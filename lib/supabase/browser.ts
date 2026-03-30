// lib/supabase/browser.ts
// Shared browser-side Supabase singleton.
//
// Usage:
//   import { sb } from '@/lib/supabase/browser';
//   const { data } = await sb().from('table').select('*');
//
// Never returns null — throws if client can't be created (caught by error boundary).

import { createClient } from '@/lib/supabase/client';

type BrowserClient = ReturnType<typeof createClient>;

let _instance: BrowserClient | null = null;

/**
 * Returns a lazily-initialized browser Supabase client.
 * Throws if called server-side or if env vars are missing.
 */
export function sb(): BrowserClient {
  if (typeof window === 'undefined') {
    throw new Error('sb() called server-side — use createServerClient instead');
  }
  if (!_instance) {
    _instance = createClient();
  }
  return _instance;
}
