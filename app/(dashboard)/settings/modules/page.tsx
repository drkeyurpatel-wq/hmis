'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useModuleConfig, type ModuleConfig } from '@/lib/config/module-config-hooks';
import { sb } from '@/lib/supabase/browser';

const GROUP_LABELS: Record<string, string> = {
  clinical: 'Clinical', diagnostics: 'Diagnostics', revenue: 'Revenue',
  operations: 'Operations', admin: 'Admin',
};
const GROUP_COLORS: Record<string, string> = {
  clinical: 'border-blue-200 bg-blue-50', diagnostics: 'border-purple-200 bg-purple-50',
  revenue: 'border-green-200 bg-green-50', operations: 'border-amber-200 bg-amber-50',
  admin: 'border-gray-200 bg-gray-50',
};

function Inner() {
  const { staff, activeCentreId, setEnabledModules } = useAuthStore();
  const staffId = staff?.id || '';
  const mc = useModuleConfig(activeCentreId);

  const [centres, setCentres] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedCentre, setSelectedCentre] = useState(activeCentreId || '');
  const mcSelected = useModuleConfig(selectedCentre);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (!sb()) return;
    sb()!.from('hmis_centres').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }) => setCentres(data || []));
  }, []);

  useEffect(() => { mcSelected.load(); }, [selectedCentre, mcSelected.load]);

  // Group modules
  const grouped = React.useMemo(() => {
    const groups: Record<string, ModuleConfig[]> = {};
    mcSelected.modules.forEach(m => {
      if (!groups[m.module_group]) groups[m.module_group] = [];
      groups[m.module_group].push(m);
    });
    return groups;
  }, [mcSelected.modules]);

  const handleToggle = async (moduleKey: string, enabled: boolean) => {
    await mcSelected.toggle(moduleKey, enabled, staffId);
    // If toggling active centre, also update global store
    if (selectedCentre === activeCentreId) {
      const updated = new Set<string>();
      mcSelected.modules.forEach(m => {
        if (m.module_key === moduleKey ? enabled : m.is_enabled) updated.add(m.module_key);
      });
      setEnabledModules(updated);
    }
    flash(`${moduleKey} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const enabledCount = mcSelected.modules.filter(m => m.is_enabled).length;
  const totalCount = mcSelected.modules.length;

  const bulkToggle = async (group: string, enabled: boolean) => {
    const mods = grouped[group] || [];
    for (const m of mods) {
      await mcSelected.toggle(m.module_key, enabled, staffId);
    }
    if (selectedCentre === activeCentreId) {
      await mcSelected.load();
      const updated = new Set<string>();
      mcSelected.modules.forEach(m => updated.add(m.module_key));
      setEnabledModules(updated);
    }
    flash(`All ${group} modules ${enabled ? 'enabled' : 'disabled'}`);
  };

  // Copy config from one centre to another
  const [copyTarget, setCopyTarget] = useState('');
  const handleCopy = async () => {
    if (!copyTarget || copyTarget === selectedCentre || !sb()) return;
    const configs = mcSelected.modules.map(m => ({
      centre_id: copyTarget,
      module_key: m.module_key,
      module_name: m.module_name,
      module_group: m.module_group,
      is_enabled: m.is_enabled,
      sort_order: m.sort_order,
      updated_by: staffId,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < configs.length; i += 20) {
      await sb()!.from('hmis_module_config').upsert(configs.slice(i, i + 20), { onConflict: 'centre_id,module_key' });
    }
    flash(`Config copied to ${centres.find(c => c.id === copyTarget)?.name}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <h1 className="text-2xl font-bold mb-2">Module Configuration</h1>
      <p className="text-sm text-gray-500 mb-6">Enable or disable modules per centre. Disabled modules are hidden from the sidebar for all staff at that centre.</p>

      <div className="flex gap-3 mb-6 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Centre</label>
          <select className="border rounded px-3 py-2 text-sm font-medium" value={selectedCentre} onChange={e => setSelectedCentre(e.target.value)}>
            {centres.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>
        <div className="bg-white border rounded px-4 py-2">
          <span className="text-2xl font-bold text-blue-700">{enabledCount}</span>
          <span className="text-sm text-gray-400">/{totalCount} enabled</span>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Copy config to</label>
            <select className="border rounded px-2 py-2 text-sm" value={copyTarget} onChange={e => setCopyTarget(e.target.value)}>
              <option value="">Select centre...</option>
              {centres.filter(c => c.id !== selectedCentre).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={handleCopy} disabled={!copyTarget} className="bg-gray-700 text-white px-3 py-2 rounded text-sm disabled:opacity-50">Copy</button>
        </div>
      </div>

      {mcSelected.loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, mods]) => (
            <div key={group} className={`border rounded-lg p-4 ${GROUP_COLORS[group] || ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">{GROUP_LABELS[group] || group}</h2>
                <div className="flex gap-2">
                  <button onClick={() => bulkToggle(group, true)} className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">All On</button>
                  <button onClick={() => bulkToggle(group, false)} className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded">All Off</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mods.map(m => (
                  <div key={m.module_key} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border">
                    <div>
                      <div className="text-sm font-medium">{m.module_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{m.module_key}</div>
                    </div>
                    <button onClick={() => handleToggle(m.module_key, !m.is_enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${m.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${m.is_enabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModuleConfigPage() {
  return <RoleGuard module="settings"><Inner /></RoleGuard>;
}
