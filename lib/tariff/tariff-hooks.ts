// lib/tariff/tariff-hooks.ts
// Tariff master CRUD using standard hook pattern.
// Table: hmis_tariff_master

'use client';

import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/use-supabase-query';

export interface TariffItem {
  id: string;
  service_code: string;
  service_name: string;
  category: string;
  rate_self: number;
  rate_insurance: number | null;
  rate_pmjay: number | null;
  rate_cghs: number | null;
  cost_price: number | null;
  centre_id: string;
  is_active: boolean;
  created_at?: string;
}

export interface TariffInput {
  service_code: string;
  service_name: string;
  category: string;
  rate_self: number;
  rate_insurance?: number;
  rate_pmjay?: number;
  rate_cghs?: number;
  cost_price?: number;
}

export function useTariffList(centreId: string | null) {
  return useSupabaseQuery<TariffItem>(
    (client) =>
      client
        .from('hmis_tariff_master')
        .select('*')
        .eq('centre_id', centreId!)
        .eq('is_active', true)
        .order('category')
        .order('service_name')
        .limit(2000),
    [centreId],
    { enabled: !!centreId }
  );
}

export function useTariffCategories(centreId: string | null) {
  return useSupabaseQuery<{ category: string }>(
    (client) =>
      client
        .from('hmis_tariff_master')
        .select('category')
        .eq('centre_id', centreId!)
        .eq('is_active', true),
    [centreId],
    { enabled: !!centreId }
  );
}

export function useCreateTariff(options?: { onSuccess?: () => void }) {
  return useSupabaseMutation<TariffInput & { centre_id: string }, TariffItem>(
    (client, input) =>
      client.from('hmis_tariff_master').insert({ ...input, is_active: true }).select().single(),
    options
  );
}

export function useUpdateTariff(options?: { onSuccess?: () => void }) {
  return useSupabaseMutation<{ id: string } & Partial<TariffInput>, TariffItem>(
    (client, { id, ...updates }) =>
      client.from('hmis_tariff_master').update(updates).eq('id', id).select().single(),
    options
  );
}

export function useBulkImportTariffs(options?: { onSuccess?: (data: any) => void; onError?: (msg: string) => void }) {
  return useSupabaseMutation<(TariffInput & { centre_id: string })[], TariffItem[]>(
    (client, items) =>
      client
        .from('hmis_tariff_master')
        .upsert(items.map((i) => ({ ...i, is_active: true })), { onConflict: 'service_code,centre_id' })
        .select(),
    options
  );
}
