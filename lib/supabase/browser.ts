// lib/supabase/browser.ts
// Shared browser-side Supabase singleton — replaces the per-module _sb / sb() pattern.
//
// Usage:
//   import { sb } from '@/lib/supabase/browser';
//   const { data } = await sb().from('table').select('*');
//
// Safe during SSR/build: returns null when running server-side or if env vars are missing.

import { createClient } from '@/lib/supabase/client';

type BrowserClient = ReturnType<typeof createClient>;

let _instance: BrowserClient | null = null;

/**
 * Returns a lazily-initialized browser Supabase client.
 * Returns null during SSR or when env vars are missing.
 */
export function sb(): BrowserClient | null {
  if (typeof window === 'undefined') return null;
  if (!_instance) {
    try {
      _instance = createClient();
    } catch {
      return null;
    }
  }
  return _instance;
}
