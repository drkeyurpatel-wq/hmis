'use client';
import React, { useState, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';

interface CentreForm {
  name: string; address_line1: string; address_line2: string; city: string; state: string;
  pincode: string; phone: string; email: string; website: string; gstin: string;
  registration_number: string; logo_url: string; hfr_id: string;
}

const EMPTY: CentreForm = { name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', phone: '', email: '', website: '', gstin: '', registration_number: '', logo_url: '', hfr_id: '' };

interface Props { centreId: string; flash: (m: string) => void; }

export default function HospitalSetup({ centreId, flash }: Props) {
  const [form, setForm] = useState<CentreForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!centreId || !sb()) return;
    setLoading(true);
    sb().from('hmis_centres').select('name, address_line1, address_line2, city, state, pincode, phone, email, website, gstin, registration_number, logo_url, hfr_id')
      .eq('id', centreId).single().then(({ data }: any) => {
        if (data) setForm({ name: data.name || '', address_line1: data.address_line1 || '', address_line2: data.address_line2 || '', city: data.city || '', state: data.state || '', pincode: data.pincode || '', phone: data.phone || '', email: data.email || '', website: data.website || '', gstin: data.gstin || '', registration_number: data.registration_number || '', logo_url: data.logo_url || '', hfr_id: data.hfr_id || '' });
        setLoading(false);
      });
  }, [centreId]);

  const save = async () => {
    if (!centreId || !sb()) return;
    setSaving(true);
    const { error } = await sb().from('hmis_centres').update(form).eq('id', centreId);
    setSaving(false);
    flash(error ? `Error: ${error.message}` : 'Hospital details saved');
  };

  const set = (k: keyof CentreForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div>
        <h3 className="font-bold text-sm mb-1">Hospital / Centre Details</h3>
        <p className="text-[10px] text-gray-500">Edit centre information stored in hmis_centres</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-[10px] text-gray-500 font-medium">Centre Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">Address Line 1</label>
          <input value={form.address_line1} onChange={e => set('address_line1', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">Address Line 2</label>
          <input value={form.address_line2} onChange={e => set('address_line2', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">City</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">State</label>
          <input value={form.state} onChange={e => set('state', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">Pincode</label>
          <input value={form.pincode} onChange={e => set('pincode', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={6} /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">Website</label>
          <input value={form.website} onChange={e => set('website', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">GSTIN</label>
          <input value={form.gstin} onChange={e => set('gstin', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={15} placeholder="22AAAAA0000A1Z5" /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">Registration Number</label>
          <input value={form.registration_number} onChange={e => set('registration_number', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        <div><label className="text-[10px] text-gray-500 font-medium">Logo URL</label>
          <input value={form.logo_url} onChange={e => set('logo_url', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." /></div>
        <div><label className="text-[10px] text-gray-500 font-medium">HFR ID (ABDM)</label>
          <input value={form.hfr_id} onChange={e => set('hfr_id', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="IN2410013685" /></div>
      </div>

      {form.logo_url && <div className="flex items-center gap-3">
        <img src={form.logo_url} alt="Logo" className="h-12 w-12 object-contain border rounded" onError={(e: any) => { e.target.style.display = 'none'; }} />
        <span className="text-[10px] text-gray-400">Logo preview</span>
      </div>}

      <button onClick={save} disabled={saving || !form.name} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">
        {saving ? 'Saving...' : 'Save Hospital Details'}
      </button>
    </div>
  );
}
