// lib/hooks/use-supabase-query.ts
// Standard data-fetching hooks for ALL HMIS modules.
// Errors SURFACE TO UI (via error state) — never swallowed silently.
//
// Usage:
//   const { data, isLoading, error, refetch } = useSupabaseQuery(
//     (sb) => sb.from('hmis_patients').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }),
//     [centreId]
//   );
//
//   const { mutate, isMutating, error: mutError } = useSupabaseMutation(
//     (sb, values) => sb.from('hmis_patients').insert(values),
//     { onSuccess: () => refetchPatients() }
//   );

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';

type SupabaseClient = NonNullable<ReturnType<typeof sb>>;

// ============================================================
// useSupabaseQuery — SELECT operations
// ============================================================

interface QueryResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isEmpty: boolean;
}

interface SingleQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches data from Supabase with loading/error state management.
 * Errors are captured as human-readable strings — NEVER silently swallowed.
 * 
 * @param queryFn - Function that receives Supabase client and returns a query builder
 * @param deps - Dependency array (refetches when these change)
 * @param options.enabled - Skip query when false (e.g., waiting for a required param)
 */
export function useSupabaseQuery<T>(
  queryFn: (client: SupabaseClient) => PromiseLike<{ data: T[] | null; error: any }>,
  deps: any[] = [],
  options?: { enabled?: boolean }
): QueryResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const enabled = options?.enabled !== false;

  const fetch = useCallback(async () => {
    const client = sb();
    if (!client || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: sbError } = await queryFn(client);

      if (!mountedRef.current) return;

      if (sbError) {
        setError(extractErrorMessage(sbError));
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(extractErrorMessage(err));
      setData(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
    isEmpty: !isLoading && !error && (data === null || data.length === 0),
  };
}

/**
 * Same as useSupabaseQuery but for .single() queries that return one row.
 */
export function useSupabaseSingle<T>(
  queryFn: (client: SupabaseClient) => PromiseLike<{ data: T | null; error: any }>,
  deps: any[] = [],
  options?: { enabled?: boolean }
): SingleQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const enabled = options?.enabled !== false;

  const fetch = useCallback(async () => {
    const client = sb();
    if (!client || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: sbError } = await queryFn(client);

      if (!mountedRef.current) return;

      if (sbError) {
        setError(extractErrorMessage(sbError));
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(extractErrorMessage(err));
      setData(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}


// ============================================================
// useSupabaseMutation — INSERT / UPDATE / DELETE operations
// ============================================================

interface MutationOptions<TInput, TResult> {
  onSuccess?: (data: TResult) => void;
  onError?: (error: string) => void;
  successMessage?: string;
}

interface MutationResult<TInput> {
  mutate: (input: TInput) => Promise<boolean>;
  isMutating: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Handles mutations (INSERT/UPDATE/DELETE) with loading and error state.
 * Returns success boolean so callers can chain actions (close modal, navigate, etc.)
 * 
 * Usage:
 *   const { mutate, isMutating, error } = useSupabaseMutation(
 *     (sb, values) => sb.from('hmis_patients').insert(values).select().single(),
 *     { onSuccess: (patient) => router.push(`/patients/${patient.id}`) }
 *   );
 *   
 *   // In form submit handler:
 *   const ok = await mutate(formValues);
 *   if (ok) closeModal();
 */
export function useSupabaseMutation<TInput = any, TResult = any>(
  mutationFn: (client: SupabaseClient, input: TInput) => PromiseLike<{ data: TResult | null; error: any }>,
  options?: MutationOptions<TInput, TResult>
): MutationResult<TInput> {
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (input: TInput): Promise<boolean> => {
    const client = sb();
    if (!client) {
      setError('Not connected to database');
      return false;
    }

    setIsMutating(true);
    setError(null);

    try {
      const { data, error: sbError } = await mutationFn(client, input);

      if (sbError) {
        const msg = extractErrorMessage(sbError);
        setError(msg);
        options?.onError?.(msg);
        return false;
      }

      options?.onSuccess?.(data as TResult);
      return true;
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      options?.onError?.(msg);
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [mutationFn, options]);

  const reset = useCallback(() => {
    setError(null);
    setIsMutating(false);
  }, []);

  return { mutate, isMutating, error, reset };
}


// ============================================================
// Error extraction helper
// ============================================================

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';

  // Supabase PostgrestError
  if (typeof err === 'object' && err !== null) {
    const e = err as any;
    if (e.message) {
      // Strip internal Postgres details, keep human-readable part
      const msg = e.message as string;
      if (msg.includes('duplicate key')) return 'This record already exists.';
      if (msg.includes('violates foreign key')) return 'Referenced record does not exist.';
      if (msg.includes('violates not-null')) return 'A required field is missing.';
      if (msg.includes('permission denied') || msg.includes('RLS')) return 'You do not have permission for this action.';
      if (msg.includes('JWT expired')) return 'Your session has expired. Please log in again.';
      return msg;
    }
    if (e.details) return e.details;
    if (e.hint) return e.hint;
  }

  if (typeof err === 'string') return err;

  return 'An unexpected error occurred. Please try again.';
}
