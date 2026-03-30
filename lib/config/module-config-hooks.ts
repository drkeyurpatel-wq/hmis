// lib/config/module-config-hooks.ts
import { useState, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface ModuleConfig {
  id: string; centre_id: string; module_key: string;
  module_name: string; module_group: string;
  is_enabled: boolean; sort_order: number;
}

export function useModuleConfig(centreId: string | null) {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_module_config')
      .select('*').eq('centre_id', centreId).order('sort_order');
    setModules((data || []) as ModuleConfig[]);
    setLoading(false);
  }, [centreId]);

  const toggle = useCallback(async (moduleKey: string, enabled: boolean, staffId: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_module_config').update({
      is_enabled: enabled, updated_by: staffId, updated_at: new Date().toISOString(),
    }).eq('centre_id', centreId).eq('module_key', moduleKey);
    // Update local state immediately
    setModules(prev => prev.map(m => m.module_key === moduleKey ? { ...m, is_enabled: enabled } : m));
  }, [centreId]);

  const isEnabled = useCallback((moduleKey: string): boolean => {
    const m = modules.find(mod => mod.module_key === moduleKey);
    return m ? m.is_enabled : true; // Default to enabled if not found
  }, [modules]);

  return { modules, loading, load, toggle, isEnabled };
}

// Lightweight loader for sidebar — fetches only enabled module keys
export async function loadEnabledModules(centreId: string): Promise<Set<string>> {
  if (!sb()) return new Set();
  const { data } = await sb().from('hmis_module_config')
    .select('module_key').eq('centre_id', centreId).eq('is_enabled', true);
  return new Set((data || []).map((d: any) => d.module_key));
}
