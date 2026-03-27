'use client';
import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const STEPS = ['Hospital info', 'Departments', 'Wards & beds', 'Staff', 'Billing', 'Go live'];

interface CentreForm {
  name: string; short_name: string; code: string; entity_type: string;
  address: string; city: string; state: string; pincode: string;
  phone: string; email: string; gstin: string; hfr_id: string;
  bed_count: number; icu_beds: number; ot_count: number;
}

interface DeptEntry { name: string; type: string; head_name: string; }
interface WardEntry { name: string; type: string; rooms: number; beds_per_room: number; rate_per_day: number; }
interface StaffEntry { full_name: string; staff_type: string; designation: string; phone: string; email: string; }

export default function CentreOnboarding({ onComplete }: { onComplete?: (centreId: string) => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [centreId, setCentreId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Step 1: Hospital info
  const [cf, setCf] = useState<CentreForm>({
    name: '', short_name: '', code: '', entity_type: 'owned',
    address: '', city: '', state: 'Gujarat', pincode: '',
    phone: '', email: '', gstin: '', hfr_id: '',
    bed_count: 50, icu_beds: 10, ot_count: 2,
  });

  // Step 2: Departments
  const [depts, setDepts] = useState<DeptEntry[]>([
    { name: 'General Medicine', type: 'clinical', head_name: '' },
    { name: 'General Surgery', type: 'clinical', head_name: '' },
    { name: 'Orthopaedics', type: 'clinical', head_name: '' },
    { name: 'Cardiology', type: 'clinical', head_name: '' },
    { name: 'Emergency', type: 'clinical', head_name: '' },
    { name: 'Radiology', type: 'support', head_name: '' },
    { name: 'Pathology', type: 'support', head_name: '' },
    { name: 'Pharmacy', type: 'support', head_name: '' },
    { name: 'Accounts', type: 'admin', head_name: '' },
    { name: 'Administration', type: 'admin', head_name: '' },
  ]);

  // Step 3: Wards
  const [wards, setWards] = useState<WardEntry[]>([
    { name: 'General Ward', type: 'general', rooms: 5, beds_per_room: 6, rate_per_day: 800 },
    { name: 'Semi Private', type: 'semi_private', rooms: 5, beds_per_room: 2, rate_per_day: 2000 },
    { name: 'Private', type: 'private', rooms: 10, beds_per_room: 1, rate_per_day: 4000 },
    { name: 'ICU', type: 'icu', rooms: 1, beds_per_room: 10, rate_per_day: 8000 },
  ]);

  // Step 4: Initial staff
  const [staffList, setStaffList] = useState<StaffEntry[]>([
    { full_name: '', staff_type: 'admin', designation: 'Hospital Administrator', phone: '', email: '' },
  ]);

  // Step 5: Billing config
  const [billing, setBilling] = useState({
    currency: 'INR', tax_type: 'GST', tax_rate: '18', bill_prefix: 'H1',
    payment_modes: ['cash', 'card', 'upi', 'neft', 'cheque', 'insurance'],
    receipt_footer: 'Thank you for choosing our hospital.',
  });

  const saveCentre = async () => {
    if (!cf.name || !sb()) return;
    setSaving(true);
    setError('');

    try {
      // 1. Create centre
      const { data: centre, error: cErr } = await sb()!.from('hmis_centres').insert({
        name: cf.name, short_name: cf.short_name || cf.name.substring(0, 10),
        code: cf.code || cf.name.substring(0, 3).toUpperCase(),
        entity_type: cf.entity_type,
        address_line1: cf.address, city: cf.city, state: cf.state, pincode: cf.pincode,
        phone: cf.phone, email: cf.email, gstin: cf.gstin, hfr_id: cf.hfr_id,
        is_active: true,
      }).select('id').single();

      if (cErr) throw new Error(`Centre: ${cErr.message}`);
      const cid = centre.id;
      setCentreId(cid);

      // 2. Create departments
      if (depts.length > 0) {
        await sb()!.from('hmis_departments').insert(
          depts.map(d => ({ centre_id: cid, name: d.name, type: d.type, is_active: true }))
        );
      }

      // 3. Create wards, rooms, beds
      for (const w of wards) {
        const { data: ward } = await sb()!.from('hmis_wards').insert({
          centre_id: cid, name: w.name, ward_type: w.type, is_active: true,
        }).select('id').single();
        if (!ward) continue;

        for (let r = 1; r <= w.rooms; r++) {
          const { data: room } = await sb()!.from('hmis_rooms').insert({
            ward_id: ward.id, room_number: `${w.name.substring(0, 2).toUpperCase()}-${String(r).padStart(2, '0')}`,
            room_type: w.type, is_active: true,
          }).select('id').single();
          if (!room) continue;

          const beds = Array.from({ length: w.beds_per_room }, (_, i) => ({
            room_id: room.id, bed_number: `${w.name.substring(0, 2).toUpperCase()}-${String(r).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
            bed_type: w.type, status: 'available', is_active: true,
            rate_per_day: w.rate_per_day,
          }));
          await sb()!.from('hmis_beds').insert(beds);
        }
      }

      // 4. Create initial staff (admin user)
      for (const s of staffList) {
        if (!s.full_name || !s.email) continue;
        // Create auth user
        const { data: authUser } = await sb()!.auth.admin.createUser({
          email: s.email, password: crypto.randomUUID().slice(0, 12) + 'A1!', email_confirm: true,
          user_metadata: { full_name: s.full_name },
        });

        await sb()!.from('hmis_staff').insert({
          auth_user_id: authUser?.user?.id || null,
          full_name: s.full_name, staff_type: s.staff_type, designation: s.designation,
          phone: s.phone, email: s.email, is_active: true,
        });
      }

      // 5. Create default billing sequences
      await sb()!.from('hmis_sequences').insert([
        { centre_id: cid, sequence_type: 'bill', prefix: billing.bill_prefix, current_value: 0 },
        { centre_id: cid, sequence_type: 'receipt', prefix: 'RCP', current_value: 0 },
        { centre_id: cid, sequence_type: 'uhid', prefix: 'UH', current_value: 0 },
        { centre_id: cid, sequence_type: 'ipd', prefix: 'IPD', current_value: 0 },
      ]);

      // 6. Create default tariff entries
      await sb()!.from('hmis_settings').insert([
        { centre_id: cid, key: 'billing_currency', value: billing.currency },
        { centre_id: cid, key: 'billing_tax_type', value: billing.tax_type },
        { centre_id: cid, key: 'billing_tax_rate', value: billing.tax_rate },
        { centre_id: cid, key: 'receipt_footer', value: billing.receipt_footer },
      ]);

      setStep(5); // Go live
      if (onComplete) onComplete(cid);
    } catch (e: any) {
      setError(e.message || 'Setup failed');
    }
    setSaving(false);
  };

  const addDept = () => setDepts(d => [...d, { name: '', type: 'clinical', head_name: '' }]);
  const addWard = () => setWards(w => [...w, { name: '', type: 'general', rooms: 1, beds_per_room: 4, rate_per_day: 1000 }]);
  const addStaff = () => setStaffList(s => [...s, { full_name: '', staff_type: 'doctor', designation: '', phone: '', email: '' }]);

  const totalBeds = wards.reduce((s, w) => s + w.rooms * w.beds_per_room, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i < step ? '✓' : i + 1}</div>
            <span className={`text-[10px] ${i === step ? 'text-teal-700 font-bold' : 'text-gray-400'} hidden sm:block`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{error}</div>}

      {/* Step 1: Hospital info */}
      {step === 0 && <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-bold">Hospital information</h2>
        <p className="text-xs text-gray-500">Basic details about the new centre. This creates the foundation for all modules.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-[10px] text-gray-500">Hospital name *</label><input value={cf.name} onChange={e => setCf(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. City Super Speciality Hospital" /></div>
          <div><label className="text-[10px] text-gray-500">Short name</label><input value={cf.short_name} onChange={e => setCf(f => ({...f, short_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. City SS" /></div>
          <div><label className="text-[10px] text-gray-500">Entity type</label><select value={cf.entity_type} onChange={e => setCf(f => ({...f, entity_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="owned">Owned</option><option value="leased">Leased</option><option value="o_and_m">O&M contract</option><option value="partnership">Partnership / JV</option></select></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500">Address</label><input value={cf.address} onChange={e => setCf(f => ({...f, address: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">City</label><input value={cf.city} onChange={e => setCf(f => ({...f, city: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">State</label><input value={cf.state} onChange={e => setCf(f => ({...f, state: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">Phone</label><input value={cf.phone} onChange={e => setCf(f => ({...f, phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">Email</label><input value={cf.email} onChange={e => setCf(f => ({...f, email: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">GSTIN</label><input value={cf.gstin} onChange={e => setCf(f => ({...f, gstin: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="22AAAAA0000A1Z5" /></div>
          <div><label className="text-[10px] text-gray-500">HFR ID (ABDM)</label><input value={cf.hfr_id} onChange={e => setCf(f => ({...f, hfr_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <button onClick={() => setStep(1)} disabled={!cf.name} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Next: Departments →</button>
      </div>}

      {/* Step 2: Departments */}
      {step === 1 && <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex justify-between"><h2 className="text-lg font-bold">Departments</h2><button onClick={addDept} className="text-xs text-teal-600 font-medium">+ Add</button></div>
        <div className="space-y-2">{depts.map((d, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={d.name} onChange={e => { const n = [...depts]; n[i].name = e.target.value; setDepts(n); }} className="flex-1 px-3 py-1.5 border rounded-lg text-xs" placeholder="Department name" />
            <select value={d.type} onChange={e => { const n = [...depts]; n[i].type = e.target.value; setDepts(n); }} className="px-2 py-1.5 border rounded-lg text-xs w-24">
              <option value="clinical">Clinical</option><option value="support">Support</option><option value="admin">Admin</option></select>
            <button onClick={() => setDepts(d => d.filter((_, j) => j !== i))} className="text-red-400 text-xs">×</button>
          </div>
        ))}</div>
        <div className="flex gap-2"><button onClick={() => setStep(0)} className="px-4 py-2 border rounded-lg text-xs">← Back</button><button onClick={() => setStep(2)} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Next: Wards →</button></div>
      </div>}

      {/* Step 3: Wards & Beds */}
      {step === 2 && <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex justify-between"><h2 className="text-lg font-bold">Wards & beds</h2><button onClick={addWard} className="text-xs text-teal-600 font-medium">+ Add ward</button></div>
        <div className="space-y-2">{wards.map((w, i) => (
          <div key={i} className="grid grid-cols-6 gap-2 items-center bg-gray-50 rounded-lg p-2">
            <input value={w.name} onChange={e => { const n = [...wards]; n[i].name = e.target.value; setWards(n); }} className="px-2 py-1.5 border rounded text-xs col-span-2" placeholder="Ward name" />
            <select value={w.type} onChange={e => { const n = [...wards]; n[i].type = e.target.value; setWards(n); }} className="px-2 py-1.5 border rounded text-xs">
              {['general','semi_private','private','icu','nicu','isolation','transplant_icu'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
            <div className="text-center"><div className="text-[9px] text-gray-400">Rooms</div><input type="number" min="1" value={w.rooms} onChange={e => { const n = [...wards]; n[i].rooms = parseInt(e.target.value) || 1; setWards(n); }} className="w-full px-2 py-1 border rounded text-xs text-center" /></div>
            <div className="text-center"><div className="text-[9px] text-gray-400">Beds/room</div><input type="number" min="1" value={w.beds_per_room} onChange={e => { const n = [...wards]; n[i].beds_per_room = parseInt(e.target.value) || 1; setWards(n); }} className="w-full px-2 py-1 border rounded text-xs text-center" /></div>
            <div className="text-center"><div className="text-[9px] text-gray-400">₹/day</div><input type="number" value={w.rate_per_day} onChange={e => { const n = [...wards]; n[i].rate_per_day = parseInt(e.target.value) || 0; setWards(n); }} className="w-full px-2 py-1 border rounded text-xs text-center" /></div>
          </div>
        ))}</div>
        <div className="bg-teal-50 rounded-lg p-3 text-xs text-teal-800">Total beds to be created: <b>{totalBeds}</b> across {wards.reduce((s, w) => s + w.rooms, 0)} rooms in {wards.length} wards</div>
        <div className="flex gap-2"><button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-xs">← Back</button><button onClick={() => setStep(3)} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Next: Staff →</button></div>
      </div>}

      {/* Step 4: Staff */}
      {step === 3 && <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex justify-between"><h2 className="text-lg font-bold">Initial staff</h2><button onClick={addStaff} className="text-xs text-teal-600 font-medium">+ Add</button></div>
        <p className="text-xs text-gray-500">At minimum, add one admin user who can log in and complete setup. Other staff can be added later.</p>
        <div className="space-y-2">{staffList.map((s, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 bg-gray-50 rounded-lg p-2">
            <input value={s.full_name} onChange={e => { const n = [...staffList]; n[i].full_name = e.target.value; setStaffList(n); }} className="px-2 py-1.5 border rounded text-xs" placeholder="Full name *" />
            <select value={s.staff_type} onChange={e => { const n = [...staffList]; n[i].staff_type = e.target.value; setStaffList(n); }} className="px-2 py-1.5 border rounded text-xs">
              {['admin','doctor','nurse','receptionist','pharmacist','lab_tech','technician','accountant'].map(t => <option key={t} value={t}>{t}</option>)}</select>
            <input value={s.designation} onChange={e => { const n = [...staffList]; n[i].designation = e.target.value; setStaffList(n); }} className="px-2 py-1.5 border rounded text-xs" placeholder="Designation" />
            <input value={s.phone} onChange={e => { const n = [...staffList]; n[i].phone = e.target.value; setStaffList(n); }} className="px-2 py-1.5 border rounded text-xs" placeholder="Phone" />
            <input value={s.email} onChange={e => { const n = [...staffList]; n[i].email = e.target.value; setStaffList(n); }} className="px-2 py-1.5 border rounded text-xs" placeholder="Email *" />
          </div>
        ))}</div>
        <div className="flex gap-2"><button onClick={() => setStep(2)} className="px-4 py-2 border rounded-lg text-xs">← Back</button><button onClick={() => setStep(4)} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Next: Billing →</button></div>
      </div>}

      {/* Step 5: Billing */}
      {step === 4 && <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-bold">Billing configuration</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500">Bill number prefix</label><input value={billing.bill_prefix} onChange={e => setBilling(b => ({...b, bill_prefix: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-[10px] text-gray-500">Tax rate (%)</label><input type="number" value={billing.tax_rate} onChange={e => setBilling(b => ({...b, tax_rate: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500">Receipt footer</label><input value={billing.receipt_footer} onChange={e => setBilling(b => ({...b, receipt_footer: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep(3)} className="px-4 py-2 border rounded-lg text-xs">← Back</button>
          <button onClick={saveCentre} disabled={saving || !cf.name} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">
            {saving ? 'Setting up...' : `Create centre with ${totalBeds} beds →`}
          </button>
        </div>
      </div>}

      {/* Step 6: Go live */}
      {step === 5 && <div className="bg-white rounded-xl border p-6 text-center space-y-4">
        <div className="text-4xl">🏥</div>
        <h2 className="text-xl font-bold text-green-700">Centre created successfully</h2>
        <div className="text-sm text-gray-600">{cf.name} is ready with {totalBeds} beds, {depts.length} departments, and {staffList.filter(s => s.email).length} staff user(s).</div>
        <div className="bg-green-50 rounded-lg p-4 text-xs text-left space-y-1">
          <div>✅ {wards.length} wards, {wards.reduce((s, w) => s + w.rooms, 0)} rooms, {totalBeds} beds created</div>
          <div>✅ {depts.length} departments configured</div>
          <div>✅ Billing sequences initialized (prefix: {billing.bill_prefix})</div>
          <div>✅ Admin user created — password reset email will be sent</div>
        </div>
        <p className="text-xs text-gray-500">Next: configure tariffs in Settings → Billing, add remaining staff, and import patient data if migrating from another system.</p>
      </div>}
    </div>
  );
}
