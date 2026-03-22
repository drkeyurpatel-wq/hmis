'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

interface BillingSettings {
  receipt_prefix: string; bill_number_format: string;
  default_discount_percent: string; max_discount_percent: string;
  gst_rate_general: string; gst_rate_pharmacy: string; gst_rate_lab: string;
  enable_gst: boolean; round_off_bills: boolean;
}

const DEFAULT_SETTINGS: BillingSettings = {
  receipt_prefix: 'RCT', bill_number_format: '{TYPE}-{YYMMDD}-{SEQ}',
  default_discount_percent: '0', max_discount_percent: '20',
  gst_rate_general: '18', gst_rate_pharmacy: '12', gst_rate_lab: '18',
  enable_gst: false, round_off_bills: true,
};

interface Props { centreId: string; flash: (m: string) => void; }

export default function BillingConfig({ centreId, flash }: Props) {
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_settings').select('key, value').eq('centre_id', centreId).in('key', [
      'receipt_prefix', 'bill_number_format', 'default_discount_percent', 'max_discount_percent',
      'gst_rate_general', 'gst_rate_pharmacy', 'gst_rate_lab', 'enable_gst', 'round_off_bills',
    ]);
    if (data) {
      const merged = { ...DEFAULT_SETTINGS };
      for (const row of data) {
        const val = row.value;
        if (row.key === 'enable_gst' || row.key === 'round_off_bills') {
          (merged as any)[row.key] = val === true || val === 'true';
        } else {
          (merged as any)[row.key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
      setSettings(merged);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof BillingSettings, v: string | boolean) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    if (!centreId || !sb()) return;
    setSaving(true);
    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await sb()!.from('hmis_settings').upsert({ centre_id: centreId, key, value }, { onConflict: 'centre_id,key' });
    }
    setSaving(false);
    flash('Billing configuration saved');
  };

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-sm">Billing Configuration</h3>
        <p className="text-[10px] text-gray-500">Discount rules, tax config, receipt prefix (hmis_settings)</p>
      </div>

      {/* Receipt & Bill Number */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h4 className="font-bold text-xs text-gray-700">Bill Numbering</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 font-medium">Receipt Prefix</label>
            <input value={settings.receipt_prefix} onChange={e => set('receipt_prefix', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="RCT" /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">Bill Number Format</label>
            <input value={settings.bill_number_format} onChange={e => set('bill_number_format', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="text-[9px] text-gray-400 mt-0.5">Variables: {'{TYPE}'}, {'{YYMMDD}'}, {'{SEQ}'}, {'{CENTRE}'}</div></div>
        </div>
      </div>

      {/* Discount Rules */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h4 className="font-bold text-xs text-gray-700">Discount Rules</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 font-medium">Default Discount (%)</label>
            <input type="number" value={settings.default_discount_percent} onChange={e => set('default_discount_percent', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" max="100" /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">Max Discount (%) — needs approval above this</label>
            <input type="number" value={settings.max_discount_percent} onChange={e => set('max_discount_percent', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" max="100" /></div>
        </div>
      </div>

      {/* GST Config */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-gray-700">GST Configuration</h4>
          <button onClick={() => set('enable_gst', !settings.enable_gst)} className={`w-10 h-5 rounded-full relative ${settings.enable_gst ? 'bg-green-500' : 'bg-gray-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${settings.enable_gst ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
        {settings.enable_gst && <div className="grid grid-cols-3 gap-3">
          <div><label className="text-[10px] text-gray-500 font-medium">General Services GST (%)</label>
            <input type="number" value={settings.gst_rate_general} onChange={e => set('gst_rate_general', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">Pharmacy GST (%)</label>
            <input type="number" value={settings.gst_rate_pharmacy} onChange={e => set('gst_rate_pharmacy', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">Lab GST (%)</label>
            <input type="number" value={settings.gst_rate_lab} onChange={e => set('gst_rate_lab', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>}
      </div>

      {/* Rounding */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-xs text-gray-700">Round Off Bills</h4>
            <p className="text-[9px] text-gray-400">Round bill totals to nearest rupee</p>
          </div>
          <button onClick={() => set('round_off_bills', !settings.round_off_bills)} className={`w-10 h-5 rounded-full relative ${settings.round_off_bills ? 'bg-green-500' : 'bg-gray-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${settings.round_off_bills ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">
        {saving ? 'Saving...' : 'Save Billing Config'}
      </button>
    </div>
  );
}
