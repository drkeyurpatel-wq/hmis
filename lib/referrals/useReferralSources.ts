'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ReferralSource, ReferralSourceType, NewReferralSourceInput } from './types';

export function useReferralSourceTypes() {
  const [types, setTypes] = useState<ReferralSourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const { data, error } = await sb()
          .from('referral_source_types')
          .select('*')
          .eq('is_active', true)
          .order('label');
        if (mountedRef.current && !error) setTypes(data || []);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  return { types, loading };
}

export function useReferralSources(centreId: string | null) {
  const [sources, setSources] = useState<ReferralSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (opts?: { search?: string; typeId?: string }) => {
    if (!centreId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      let q = sb()
        .from('referral_sources')
        .select('*, type:referral_source_types(code, label)')
        .eq('centre_id', centreId)
        .eq('is_active', true)
        .order('name');

      if (opts?.search) {
        q = q.ilike('name', `%${opts.search}%`);
      }
      if (opts?.typeId) {
        q = q.eq('type_id', opts.typeId);
      }

      const { data, error: sbError } = await q;
      if (!mountedRef.current) return;
      if (sbError) {
        setError(sbError.message);
        return;
      }

      setSources((data || []).map((s: any) => ({
        ...s,
        type_code: s.type?.code || '',
        type_label: s.type?.label || '',
      })));
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to load referral sources');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const create = useCallback(async (input: NewReferralSourceInput) => {
    if (!centreId) return { success: false, error: 'No centre selected' };

    const { data, error: sbError } = await sb()
      .from('referral_sources')
      .insert({ centre_id: centreId, ...input })
      .select('id, name')
      .single();

    if (sbError) return { success: false, error: sbError.message };
    load();
    return { success: true, data };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: Partial<ReferralSource>) => {
    const { error: sbError } = await sb()
      .from('referral_sources')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (sbError) return { success: false, error: sbError.message };
    load();
    return { success: true };
  }, [load]);

  const deactivate = useCallback(async (id: string) => {
    return update(id, { is_active: false } as any);
  }, [update]);

  const search = useCallback(async (term: string, typeId?: string): Promise<ReferralSource[]> => {
    if (!centreId || term.length < 2) return [];

    let q = sb()
      .from('referral_sources')
      .select('*, type:referral_source_types(code, label)')
      .eq('centre_id', centreId)
      .eq('is_active', true)
      .ilike('name', `%${term}%`)
      .order('name')
      .limit(10);

    if (typeId) q = q.eq('type_id', typeId);

    const { data } = await q;
    return (data || []).map((s: any) => ({
      ...s,
      type_code: s.type?.code || '',
      type_label: s.type?.label || '',
    }));
  }, [centreId]);

  return { sources, loading, error, load, create, update, deactivate, search, refetch: load };
}
