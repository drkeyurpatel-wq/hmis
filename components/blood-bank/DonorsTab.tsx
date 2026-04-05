'use client';
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { BLOOD_GROUPS } from '@/lib/lab/blood-bank-hooks';

interface DonorsTabProps {
  donors: any[];
  register: (donor: any) => Promise<any>;
  groupColor: (g: string) => string;
  flash: (m: string) => void;
}

export default function DonorsTab({ donors, register, groupColor, flash }: DonorsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [dForm, setDF] = useState({ first_name: '', last_name: '', gender: 'male', date_of_birth: '', blood_group: 'O+', phone: '', weight_kg: '', hb_level: '', donor_type: 'voluntary' });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Donor Registry</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Register Donor'}</button>
      </div>
      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">First name *</label>
            <input type="text" value={dForm.first_name} onChange={e => setDF(f => ({...f, first_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Last name</label>
            <input type="text" value={dForm.last_name} onChange={e => setDF(f => ({...f, last_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Blood group *</label>
            <select value={dForm.blood_group} onChange={e => setDF(f => ({...f, blood_group: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Gender *</label>
            <select value={dForm.gender} onChange={e => setDF(f => ({...f, gender: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['male','female','other'].map(g => <option key={g}>{g}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">DOB *</label>
            <input type="date" value={dForm.date_of_birth} onChange={e => setDF(f => ({...f, date_of_birth: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Phone</label>
            <input type="text" value={dForm.phone} onChange={e => setDF(f => ({...f, phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Donor type</label>
            <select value={dForm.donor_type} onChange={e => setDF(f => ({...f, donor_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['voluntary','replacement','autologous','directed'].map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Weight (kg)</label>
            <input type="number" value={dForm.weight_kg} onChange={e => setDF(f => ({...f, weight_kg: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" min="45" /></div>
          <div><label className="text-xs text-gray-500">Hb (g/dL)</label>
            <input type="number" step="0.1" value={dForm.hb_level} onChange={e => setDF(f => ({...f, hb_level: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <button onClick={async () => { const d = await register(dForm); if (d) { flash('Donor registered: ' + d.donor_number); setShowForm(false); } }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Register Donor</button>
      </div>}
      {donors.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border"><Users className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm font-medium text-gray-500">No donors registered yet</p><p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Register your first donor to begin the blood bank workflow.</p></div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Donor #</th><th className="p-2 text-left">Name</th><th className="p-2">Group</th><th className="p-2">Type</th><th className="p-2">Donations</th><th className="p-2">Last</th><th className="p-2">Status</th>
      </tr></thead><tbody>{donors.map((d: any) => (
        <tr key={d.id} className="border-b hover:bg-gray-50">
          <td className="p-2 font-mono">{d.donor_number}</td>
          <td className="p-2 font-medium">{d.first_name} {d.last_name}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded ${groupColor(d.blood_group)}`}>{d.blood_group}</span></td>
          <td className="p-2 text-center">{d.donor_type}</td>
          <td className="p-2 text-center font-medium">{d.total_donations}</td>
          <td className="p-2 text-center">{d.last_donation_date || '—'}</td>
          <td className="p-2 text-center">{d.is_deferred ? <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px]">Deferred</span> : <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">Eligible</span>}</td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}
