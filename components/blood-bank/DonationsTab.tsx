'use client';
import React, { useState } from 'react';

interface DonationsTabProps {
  donations: any[];
  donors: any[];
  collect: (donorId: string, bagNumber: string, aboGroup: string, rhType: string, staffId: string, volumeMl?: number) => Promise<any>;
  updateTTI: (donationId: string, results: { hbsag: string; hcv: string; hiv: string; vdrl: string; malaria: string }) => Promise<void>;
  separate: (donationId: string, componentTypes: string[], staffId: string, bloodGroup: string) => Promise<void>;
  staffId: string;
  groupColor: (g: string) => string;
  flash: (m: string) => void;
}

export default function DonationsTab({ donations, donors, collect, updateTTI, separate, staffId, groupColor, flash }: DonationsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [donForm, setDonF] = useState({ donorId: '', bagNumber: '', aboGroup: 'O', rhType: 'positive', volumeMl: 450 });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Blood Donations / Collections</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Collect Blood'}</button>
      </div>
      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Donor *</label>
            <select value={donForm.donorId} onChange={e => setDonF(f => ({...f, donorId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select donor...</option>
              {donors.filter((d: any) => !d.is_deferred).map((d: any) => <option key={d.id} value={d.id}>{d.donor_number} — {d.first_name} {d.last_name} ({d.blood_group})</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500">Bag number *</label>
            <input type="text" value={donForm.bagNumber} onChange={e => setDonF(f => ({...f, bagNumber: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">ABO Group *</label>
            <select value={donForm.aboGroup} onChange={e => setDonF(f => ({...f, aboGroup: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['A','B','AB','O'].map(g => <option key={g}>{g}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Rh Type *</label>
            <select value={donForm.rhType} onChange={e => setDonF(f => ({...f, rhType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['positive','negative'].map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Volume (ml)</label>
            <input type="number" value={donForm.volumeMl} onChange={e => setDonF(f => ({...f, volumeMl: parseInt(e.target.value)||450}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <button onClick={async () => { if (!donForm.donorId || !donForm.bagNumber) return; const d = await collect(donForm.donorId, donForm.bagNumber, donForm.aboGroup, donForm.rhType, staffId, donForm.volumeMl); if (d) { flash('Collected: ' + d.donation_number); setShowForm(false); } }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Record Collection</button>
      </div>}
      {donations.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No donations</div> :
      <div className="space-y-2">{donations.map((d: any) => (
        <div key={d.id} className="bg-white rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{d.donation_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(d.abo_group + (d.rh_type === 'positive' ? '+' : '-'))}`}>{d.abo_group}{d.rh_type === 'positive' ? '+' : '-'}</span>
              <span className="text-xs text-gray-500">{d.donor?.first_name} {d.donor?.last_name}</span>
              <span className="text-xs text-gray-400">Bag: {d.bag_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${d.tti_status === 'non_reactive' ? 'bg-green-100 text-green-700' : d.tti_status === 'reactive' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.tti_status}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${d.status === 'available' ? 'bg-green-100 text-green-700' : d.status === 'separated' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {d.tti_status === 'pending' && <button onClick={() => { updateTTI(d.id, { hbsag: 'non_reactive', hcv: 'non_reactive', hiv: 'non_reactive', vdrl: 'non_reactive', malaria: 'non_reactive' }); flash('TTI: All non-reactive'); }} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded">TTI All NR</button>}
            {d.tti_status === 'pending' && <button onClick={() => { const reactive = prompt('Which TTI reactive? (hbsag/hcv/hiv/vdrl/malaria)'); if (reactive) { const r: any = { hbsag: 'non_reactive', hcv: 'non_reactive', hiv: 'non_reactive', vdrl: 'non_reactive', malaria: 'non_reactive' }; r[reactive] = 'reactive'; updateTTI(d.id, r); flash('TTI: ' + reactive + ' REACTIVE'); }}} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded">TTI Reactive</button>}
            {d.status === 'available' && <button onClick={() => { separate(d.id, ['prbc','ffp','platelet_concentrate'], staffId, d.abo_group + (d.rh_type === 'positive' ? '+' : '-')); flash('Components separated'); }} className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] rounded">Separate Components</button>}
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
