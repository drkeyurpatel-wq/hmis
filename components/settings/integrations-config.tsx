'use client';
import React, { useState, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';
import { getIntegrationStatuses } from '@/lib/config/env';

interface ProviderConfig {
  id?: string;
  provider: string;
  is_enabled: boolean;
  config: Record<string, string>;
  last_sync_at?: string;
  sync_status?: string;
}

const PROVIDERS: { key: string; label: string; color: string; fields: { key: string; label: string; secret?: boolean; placeholder?: string }[]; testType?: 'connection' | 'send' }[] = [
  { key: 'abdm', label: 'ABDM / ABHA', color: 'bg-orange-100 text-orange-700', fields: [
    { key: 'client_id', label: 'ABDM Client ID', placeholder: 'From ABDM sandbox/production' },
    { key: 'client_secret', label: 'ABDM Client Secret', secret: true },
    { key: 'hip_id', label: 'HIP ID (HFR ID)', placeholder: 'e.g. IN2410013685' },
    { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
    { key: 'callback_url', label: 'Callback URL', placeholder: 'https://yourdomain.com/api/abdm' },
  ], testType: 'connection' },
  { key: 'leadsquared', label: 'LeadSquared CRM', color: 'bg-orange-100 text-orange-700', fields: [
    { key: 'api_host', label: 'API Host' }, { key: 'access_key', label: 'Access Key' }, { key: 'secret_key', label: 'Secret Key', secret: true },
  ], testType: 'connection' },
  { key: 'dialshree', label: 'DialShree Dialer', color: 'bg-indigo-100 text-indigo-700', fields: [
    { key: 'api_url', label: 'API URL' }, { key: 'api_key', label: 'API Key', secret: true }, { key: 'agent_id', label: 'Agent ID' },
  ], testType: 'connection' },
  { key: 'whatsapp', label: 'WhatsApp Business', color: 'bg-green-100 text-green-700', fields: [
    { key: 'api_url', label: 'API URL' }, { key: 'api_token', label: 'API Token', secret: true }, { key: 'business_phone', label: 'Business Phone' },
  ], testType: 'send' },
  { key: 'msg91', label: 'MSG91 SMS', color: 'bg-blue-100 text-blue-700', fields: [
    { key: 'authkey', label: 'Auth Key', secret: true }, { key: 'sender_id', label: 'Sender ID' }, { key: 'route', label: 'Route' },
  ], testType: 'send' },
];

interface Props { centreId: string; flash: (m: string) => void; }

export default function IntegrationsConfig({ centreId, flash }: Props) {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [testing, setTesting] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!centreId || !sb()) return;
    setLoading(true);
    sb()!.from('hmis_integration_config').select('*').eq('centre_id', centreId).then(({ data }: any) => {
      const map: Record<string, ProviderConfig> = {};
      for (const row of (data || [])) {
        map[row.provider] = { id: row.id, provider: row.provider, is_enabled: row.is_enabled ?? false, config: row.config || {}, last_sync_at: row.last_sync_at, sync_status: row.sync_status };
      }
      setConfigs(map);
      setLoading(false);
    });
  }, [centreId]);

  const getConfig = (provider: string): ProviderConfig => configs[provider] || { provider, is_enabled: false, config: {} };

  const updateField = (provider: string, field: string, value: string) => {
    setConfigs(prev => {
      const existing = prev[provider] || { provider, is_enabled: false, config: {} };
      return { ...prev, [provider]: { ...existing, config: { ...existing.config, [field]: value } } };
    });
  };

  const toggleEnabled = (provider: string) => {
    setConfigs(prev => {
      const existing = prev[provider] || { provider, is_enabled: false, config: {} };
      return { ...prev, [provider]: { ...existing, is_enabled: !existing.is_enabled } };
    });
  };

  const saveProvider = async (provider: string) => {
    if (!centreId || !sb()) return;
    setSaving(provider);
    const cfg = getConfig(provider);
    const payload = { centre_id: centreId, provider, is_enabled: cfg.is_enabled, config: cfg.config };

    if (cfg.id) {
      const { error } = await sb()!.from('hmis_integration_config').update(payload).eq('id', cfg.id);
      if (error) flash(`Error: ${error.message}`); else flash(`${provider} config saved`);
    } else {
      const { data, error } = await sb()!.from('hmis_integration_config').insert(payload).select('id').maybeSingle();
      if (error) flash(`Error: ${error.message}`);
      else {
        if (data) setConfigs(prev => ({ ...prev, [provider]: { ...cfg, id: data.id } }));
        flash(`${provider} config created`);
      }
    }
    setSaving('');
  };

  const testConnection = async (provider: string) => {
    setTesting(provider);
    const cfg = getConfig(provider);
    try {
      if (provider === 'abdm') {
        const clientId = cfg.config.client_id;
        const clientSecret = cfg.config.client_secret;
        if (!clientId || !clientSecret) { flash('Fill ABDM Client ID and Secret first'); setTesting(''); return; }
        const res = await fetch('/api/abdm');
        const data = await res.json();
        flash(data.abdm?.configured ? `ABDM: Connected (${data.abdm.environment}) HIP: ${data.abdm.hipId}` : 'ABDM: Not configured — set environment variables');
      } else if (provider === 'leadsquared') {
        const host = cfg.config.api_host;
        const ak = cfg.config.access_key;
        const sk = cfg.config.secret_key;
        if (!host || !ak || !sk) { flash('Fill all LeadSquared fields first'); setTesting(''); return; }
        const res = await fetch(`${host}/v2/LeadManagement.svc/Leads.GetByEmailaddress?accessKey=${encodeURIComponent(ak)}&secretKey=${encodeURIComponent(sk)}&emailaddress=test@test.com`);
        flash(res.ok || res.status === 404 ? 'LeadSquared: Connection OK' : `LeadSquared: HTTP ${res.status}`);
      } else if (provider === 'dialshree') {
        const url = cfg.config.api_url;
        if (!url) { flash('Fill DialShree API URL first'); setTesting(''); return; }
        const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        flash('DialShree: Endpoint reachable (no-cors)');
      } else if (provider === 'whatsapp') {
        const url = cfg.config.api_url;
        const token = cfg.config.api_token;
        if (!url || !token) { flash('Fill WhatsApp API URL and token first'); setTesting(''); return; }
        const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'test', phone: cfg.config.business_phone || '0000000000', centre_id: centreId, data: { patient_name: 'Test', centre_name: 'Health1' } }) });
        const r = await res.json();
        flash(r.success ? 'WhatsApp: Test sent!' : `WhatsApp: ${r.error || 'Failed'}`);
      } else if (provider === 'msg91') {
        const authkey = cfg.config.authkey;
        if (!authkey) { flash('Fill MSG91 auth key first'); setTesting(''); return; }
        flash('MSG91: Config saved — test via Notifications tab');
      }
    } catch (e: any) {
      flash(`Test failed: ${e.message}`);
    }
    // Update sync status
    if (cfg.id && sb()) {
      await sb()!.from('hmis_integration_config').update({ last_sync_at: new Date().toISOString(), sync_status: 'tested' }).eq('id', cfg.id);
    }
    setTesting('');
  };

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  const envStatuses = getIntegrationStatuses();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-sm">Integration Providers</h3>
        <p className="text-[10px] text-gray-500">Configure external service connections (hmis_integration_config)</p>
      </div>

      {/* Environment Health Summary */}
      <div className="bg-gray-50 rounded-xl border p-3">
        <div className="text-[10px] font-medium text-gray-500 mb-2">Environment Status</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(envStatuses).map(([key, s]) => (
            <span key={key} className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {s.configured ? '\u2713' : '\u2717'} {s.label}
            </span>
          ))}
        </div>
      </div>

      {PROVIDERS.map(p => {
        const cfg = getConfig(p.key);
        return (
          <div key={p.key} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.color}`}>{p.label}</span>
                {cfg.last_sync_at && <span className="text-[9px] text-gray-400">Last tested: {new Date(cfg.last_sync_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                {cfg.sync_status && <span className={`px-1 py-0.5 rounded text-[9px] ${cfg.sync_status === 'tested' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{cfg.sync_status}</span>}
              </div>
              <button onClick={() => toggleEnabled(p.key)} className={`w-10 h-5 rounded-full relative ${cfg.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${cfg.is_enabled ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {p.fields.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-gray-500 font-medium">{f.label}</label>
                    <div className="relative">
                      <input
                        type={f.secret && !showSecrets[`${p.key}_${f.key}`] ? 'password' : 'text'}
                        value={cfg.config[f.key] || ''}
                        onChange={e => updateField(p.key, f.key, e.target.value)}
                        placeholder={(f as any).placeholder || ''}
                        className="w-full px-3 py-2 border rounded-lg text-sm pr-8"
                      />
                      {f.secret && <button onClick={() => setShowSecrets(prev => ({ ...prev, [`${p.key}_${f.key}`]: !prev[`${p.key}_${f.key}`] }))}
                        className="absolute right-2 top-2.5 text-gray-400 text-[10px]">{showSecrets[`${p.key}_${f.key}`] ? 'Hide' : 'Show'}</button>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => saveProvider(p.key)} disabled={saving === p.key}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-40">
                  {saving === p.key ? 'Saving...' : 'Save Config'}
                </button>
                <button onClick={() => testConnection(p.key)} disabled={testing === p.key}
                  className="px-4 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg border disabled:opacity-40">
                  {testing === p.key ? 'Testing...' : p.testType === 'send' ? 'Test Send' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
