'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDonors, useDonations, useInventory, useCrossmatch, useBloodRequests, useTransfusions, BLOOD_GROUPS, COMPONENT_TYPES } from '@/lib/lab/blood-bank-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type BBTab = 'inventory' | 'donors' | 'donations' | 'requests' | 'crossmatch' | 'transfusion' | 'reactions';

function BloodBankInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const donors = useDonors(centreId);
  const donations = useDonations(centreId);
  const inv = useInventory(centreId);
  const xmatch = useCrossmatch(centreId);
  const requests = useBloodRequests(centreId);
  const transfusions = useTransfusions(centreId);

  const [tab, setTab] = useState<BBTab>('inventory');
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Donor form
  const [dForm, setDF] = useState({ first_name: '', last_name: '', gender: 'male', date_of_birth: '', blood_group: 'O+', phone: '', weight_kg: '', hb_level: '', donor_type: 'voluntary' });
  // Donation form
  const [donForm, setDonF] = useState({ donorId: '', bagNumber: '', aboGroup: 'O', rhType: 'positive', volumeMl: 450 });
  // Request form
  const [reqForm, setReqF] = useState({ patientSearch: '', patientId: '', bloodGroup: 'O+', componentType: 'prbc', unitsRequested: 1, urgency: 'routine', indication: '' });
  const [patResults, setPatResults] = useState<any[]>([]);

  // Patient search for requests
  useEffect(() => {
    if (reqForm.patientSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, blood_group')
        .or(`uhid.ilike.%${reqForm.patientSearch}%,first_name.ilike.%${reqForm.patientSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [reqForm.patientSearch]);

  const groupColor = (g: string) => g.includes('+') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
  const tabs: [BBTab, string][] = [['inventory','Inventory'],['donors','Donors'],['donations','Donations'],['requests','Requests'],['crossmatch','Crossmatch'],['transfusion','Transfusions'],['reactions','Reactions']];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Blood Bank</h1><p className="text-sm text-gray-500">Blood storage, compatibility testing, transfusion management</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setShowForm(false); }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-xl ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{l}</button>)}
      </div>

      {/* ===== INVENTORY ===== */}
      {tab === 'inventory' && <div>
        <h2 className="font-semibold text-sm mb-3">Blood Inventory — Available Stock</h2>
        {/* Matrix: Groups × Components */}
        <div className="bg-white rounded-xl border overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2.5 text-left font-medium text-gray-500">Blood Group</th>
              {['whole_blood','prbc','ffp','platelet_concentrate','cryoprecipitate','sdp'].map(c =>
                <th key={c} className="p-2.5 font-medium text-gray-500 text-center">{c.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</th>
              )}
              <th className="p-2.5 font-medium text-gray-500 text-center">Total</th>
            </tr></thead>
            <tbody>{BLOOD_GROUPS.map(g => {
              const row = ['whole_blood','prbc','ffp','platelet_concentrate','cryoprecipitate','sdp'].map(c => {
                const match = inv.inventory.find(i => i.bloodGroup === g && i.componentType === c);
                return match?.units || 0;
              });
              const total = row.reduce((a, b) => a + b, 0);
              return (
                <tr key={g} className="border-b hover:bg-gray-50">
                  <td className="p-2.5"><span className={`px-2 py-0.5 rounded font-bold text-xs ${groupColor(g)}`}>{g}</span></td>
                  {row.map((v, i) => <td key={i} className={`p-2.5 text-center font-medium ${v > 0 ? '' : 'text-gray-300'}`}>{v}</td>)}
                  <td className="p-2.5 text-center font-bold">{total}</td>
                </tr>
              );
            })}</tbody>
            <tfoot><tr className="bg-gray-50 font-bold">
              <td className="p-2.5">Total</td>
              {['whole_blood','prbc','ffp','platelet_concentrate','cryoprecipitate','sdp'].map(c => {
                const total = inv.inventory.filter(i => i.componentType === c).reduce((s, i) => s + i.units, 0);
                return <td key={c} className="p-2.5 text-center">{total}</td>;
              })}
              <td className="p-2.5 text-center text-red-700">{inv.inventory.reduce((s, i) => s + i.units, 0)}</td>
            </tr></tfoot>
          </table>
        </div>

        {/* Expiring soon */}
        {(() => {
          const soon = inv.components.filter(c => {
            const days = (new Date(c.expiry_date).getTime() - Date.now()) / 86400000;
            return days <= 3 && days >= 0 && c.status === 'available';
          });
          return soon.length > 0 && <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-4">
            <h3 className="text-sm font-medium text-orange-800 mb-2">Expiring within 3 days ({soon.length})</h3>
            {soon.map(c => <div key={c.id} className="text-xs flex items-center justify-between py-1 border-b border-orange-100 last:border-0">
              <span><span className={`px-1.5 py-0.5 rounded ${groupColor(c.blood_group)}`}>{c.blood_group}</span> {c.component_type.replace(/_/g,' ')} — {c.component_number}</span>
              <span className="text-orange-600 font-medium">Exp: {c.expiry_date}</span>
            </div>)}
          </div>;
        })()}

        {/* All available */}
        <h3 className="text-xs font-medium text-gray-500 mb-2">Available Components ({inv.components.filter(c => c.status === 'available').length})</h3>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Component #</th><th className="p-2">Group</th><th className="p-2">Type</th><th className="p-2">Volume</th><th className="p-2">Expiry</th><th className="p-2">Status</th>
        </tr></thead><tbody>{inv.components.slice(0, 30).map(c => (
          <tr key={c.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px]">{c.component_number}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(c.blood_group)}`}>{c.blood_group}</span></td>
            <td className="p-2 text-center">{c.component_type.replace(/_/g,' ')}</td>
            <td className="p-2 text-center">{c.volume_ml} ml</td>
            <td className="p-2 text-center">{c.expiry_date}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${c.status === 'available' ? 'bg-green-100 text-green-700' : c.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{c.status}</span></td>
          </tr>
        ))}</tbody></table></div>
      </div>}

      {/* ===== DONORS ===== */}
      {tab === 'donors' && <div>
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
          <button onClick={async () => { const d = await donors.register(dForm); if (d) { flash('Donor registered: ' + d.donor_number); setShowForm(false); } }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Register Donor</button>
        </div>}
        {donors.donors.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No donors registered</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Donor #</th><th className="p-2 text-left">Name</th><th className="p-2">Group</th><th className="p-2">Type</th><th className="p-2">Donations</th><th className="p-2">Last</th><th className="p-2">Status</th>
        </tr></thead><tbody>{donors.donors.map((d: any) => (
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
      </div>}

      {/* ===== DONATIONS ===== */}
      {tab === 'donations' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Blood Donations / Collections</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Collect Blood'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Donor *</label>
              <select value={donForm.donorId} onChange={e => setDonF(f => ({...f, donorId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select donor...</option>
                {donors.donors.filter((d: any) => !d.is_deferred).map((d: any) => <option key={d.id} value={d.id}>{d.donor_number} — {d.first_name} {d.last_name} ({d.blood_group})</option>)}
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
          <button onClick={async () => { if (!donForm.donorId || !donForm.bagNumber) return; const d = await donations.collect(donForm.donorId, donForm.bagNumber, donForm.aboGroup, donForm.rhType, staffId, donForm.volumeMl); if (d) { flash('Collected: ' + d.donation_number); setShowForm(false); } }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Record Collection</button>
        </div>}
        {donations.donations.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No donations</div> :
        <div className="space-y-2">{donations.donations.map((d: any) => (
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
              {d.tti_status === 'pending' && <button onClick={() => { donations.updateTTI(d.id, { hbsag: 'non_reactive', hcv: 'non_reactive', hiv: 'non_reactive', vdrl: 'non_reactive', malaria: 'non_reactive' }); flash('TTI: All non-reactive'); }} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded">TTI All NR</button>}
              {d.tti_status === 'pending' && <button onClick={() => { const reactive = prompt('Which TTI reactive? (hbsag/hcv/hiv/vdrl/malaria)'); if (reactive) { const r: any = { hbsag: 'non_reactive', hcv: 'non_reactive', hiv: 'non_reactive', vdrl: 'non_reactive', malaria: 'non_reactive' }; r[reactive] = 'reactive'; donations.updateTTI(d.id, r); flash('TTI: ' + reactive + ' REACTIVE'); }}} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded">TTI Reactive</button>}
              {d.status === 'available' && <button onClick={() => { inv.separate(d.id, ['prbc','ffp','platelet_concentrate'], staffId, d.abo_group + (d.rh_type === 'positive' ? '+' : '-')); flash('Components separated'); }} className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] rounded">Separate Components</button>}
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== REQUESTS ===== */}
      {tab === 'requests' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Blood Requests</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Request'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="relative">
            <label className="text-xs text-gray-500">Patient *</label>
            {reqForm.patientId ? <div className="bg-blue-50 rounded-lg p-2 flex justify-between items-center"><span className="text-sm font-medium">{patResults.find(p => p.id === reqForm.patientId)?.first_name} — {patResults.find(p => p.id === reqForm.patientId)?.uhid}</span><button onClick={() => setReqF(f => ({...f, patientId: '', patientSearch: ''}))} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={reqForm.patientSearch} onChange={e => setReqF(f => ({...f, patientSearch: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." />
            {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">
              {patResults.map(p => <button key={p.id} onClick={() => { setReqF(f => ({...f, patientId: p.id, bloodGroup: p.blood_group || f.bloodGroup})); setPatResults([]); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">{p.first_name} {p.last_name} — {p.uhid} ({p.blood_group || '?'})</button>)}
            </div>}</>}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Blood group *</label>
              <select value={reqForm.bloodGroup} onChange={e => setReqF(f => ({...f, bloodGroup: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Component *</label>
              <select value={reqForm.componentType} onChange={e => setReqF(f => ({...f, componentType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {COMPONENT_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Units *</label>
              <input type="number" min="1" max="10" value={reqForm.unitsRequested} onChange={e => setReqF(f => ({...f, unitsRequested: parseInt(e.target.value)||1}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Urgency</label>
              <select value={reqForm.urgency} onChange={e => setReqF(f => ({...f, urgency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['routine','urgent','emergency'].map(u => <option key={u}>{u}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500">Clinical indication</label>
            <input type="text" value={reqForm.indication} onChange={e => setReqF(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Pre-operative, severe anemia, DIC, massive transfusion..." /></div>
          <button onClick={async () => { if (!reqForm.patientId) return; await requests.create(reqForm, staffId); flash('Blood request submitted'); setShowForm(false); }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Submit Request</button>
        </div>}
        {requests.requests.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No blood requests</div> :
        <div className="space-y-2">{requests.requests.map((r: any) => (
          <div key={r.id} className={`bg-white rounded-lg border p-3 ${r.urgency === 'emergency' ? 'border-red-300 bg-red-50/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{r.patient?.first_name} {r.patient?.last_name}</span>
                <span className="text-xs text-gray-400">{r.patient?.uhid}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(r.blood_group)}`}>{r.blood_group}</span>
                <span className="text-xs">{r.units_requested} unit(s) {r.component_type.replace(/_/g,' ')}</span>
                {r.urgency === 'emergency' && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">EMERGENCY</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : r.status === 'ready' ? 'bg-green-100 text-green-700' : r.status === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>{r.status}</span>
                {r.status === 'pending' && <button onClick={() => requests.updateStatus(r.id, 'crossmatching')} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded">Start XM</button>}
                {r.status === 'crossmatching' && <button onClick={() => requests.updateStatus(r.id, 'ready')} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Ready</button>}
              </div>
            </div>
            {r.clinical_indication && <div className="text-xs text-gray-500 mt-1">Indication: {r.clinical_indication}</div>}
            <div className="text-[10px] text-gray-400 mt-1">Requested by: {r.doctor?.full_name} | {new Date(r.requested_at).toLocaleString('en-IN')}</div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== CROSSMATCH ===== */}
      {tab === 'crossmatch' && <div>
        <h2 className="font-semibold text-sm mb-3">Crossmatch / Compatibility Testing</h2>
        {xmatch.matches.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No crossmatch requests. Start from Blood Requests tab.</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Patient</th><th className="p-2">Patient Grp</th><th className="p-2">Component</th><th className="p-2">IS</th><th className="p-2">37°C</th><th className="p-2">ICT/AGT</th><th className="p-2">Result</th><th className="p-2">Actions</th>
        </tr></thead><tbody>{xmatch.matches.map((m: any) => (
          <tr key={m.id} className={`border-b ${m.result === 'incompatible' ? 'bg-red-50' : ''}`}>
            <td className="p-2">{m.patient?.first_name} {m.patient?.last_name} ({m.patient?.uhid})</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded ${groupColor(m.patient_abo + (m.patient_rh === 'positive' ? '+' : '-'))}`}>{m.patient_abo}{m.patient_rh === 'positive' ? '+' : '-'}</span></td>
            <td className="p-2 text-center">{m.component?.blood_group} {m.component?.component_type?.replace(/_/g,' ')}</td>
            <td className="p-2 text-center">{m.immediate_spin === 'compatible' ? '✓' : m.immediate_spin === 'incompatible' ? '✗' : '—'}</td>
            <td className="p-2 text-center">{m.incubation_37c === 'compatible' ? '✓' : m.incubation_37c === 'incompatible' ? '✗' : '—'}</td>
            <td className="p-2 text-center">{m.ict_agt === 'compatible' ? '✓' : m.ict_agt === 'incompatible' ? '✗' : '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.result === 'compatible' ? 'bg-green-100 text-green-700' : m.result === 'incompatible' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.result}</span></td>
            <td className="p-2 text-center">{m.result === 'pending' && <button onClick={() => xmatch.complete(m.id, 'compatible', 'compatible', 'compatible', 'compatible', staffId)} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Compatible</button>}</td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== TRANSFUSIONS ===== */}
      {tab === 'transfusion' && <div>
        <h2 className="font-semibold text-sm mb-3">Transfusion Records</h2>
        {transfusions.transfusions.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No transfusion records. Issue blood from Requests or Crossmatch.</div> :
        <div className="space-y-2">{transfusions.transfusions.map((t: any) => (
          <div key={t.id} className={`bg-white rounded-lg border p-3 ${t.has_reaction ? 'border-red-300 bg-red-50/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{t.patient?.first_name} {t.patient?.last_name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(t.component?.blood_group || '')}`}>{t.component?.blood_group}</span>
                <span className="text-xs">{t.component?.component_type?.replace(/_/g,' ')}</span>
                {t.has_reaction && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">REACTION</span>}
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.status === 'completed' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' : t.status === 'stopped' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
            </div>
            <div className="flex gap-2 mt-2">
              {t.status === 'issued' && <button onClick={() => transfusions.startTransfusion(t.id, staffId, { temp: 98.6, pulse: 78, bpSys: 120, bpDia: 80 })} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded">Start Transfusion</button>}
              {t.status === 'in_progress' && <button onClick={() => transfusions.completeTransfusion(t.id, t.component_id, t.component?.volume_ml || 280, { temp: 98.8, pulse: 82, bpSys: 118, bpDia: 78 })} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded">Complete</button>}
              {t.status === 'in_progress' && <button onClick={() => { const type = prompt('Reaction type: febrile/allergic_mild/allergic_severe/anaphylaxis/hemolytic_acute/taco/trali'); const symptoms = prompt('Symptoms:'); if (type && symptoms) transfusions.reportReaction(t.id, t.patient_id, type, 'moderate', symptoms, 'Transfusion stopped', staffId); }} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded">Report Reaction</button>}
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== REACTIONS ===== */}
      {tab === 'reactions' && <div>
        <h2 className="font-semibold text-sm mb-3">Transfusion Reactions</h2>
        {(() => { const withReactions = transfusions.transfusions.filter(t => t.has_reaction); return withReactions.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No transfusion reactions reported</div> :
        <div className="space-y-2">{withReactions.map((t: any) => (
          <div key={t.id} className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-600 text-lg">⚠️</span>
              <span className="font-medium">{t.patient?.first_name} {t.patient?.last_name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(t.component?.blood_group || '')}`}>{t.component?.blood_group}</span>
              <span className="text-xs">{t.component?.component_type?.replace(/_/g,' ')}</span>
            </div>
            <div className="text-xs text-red-700">Transfusion stopped — reaction reported</div>
            <div className="text-[10px] text-gray-500 mt-1">{new Date(t.issued_at).toLocaleString('en-IN')}</div>
          </div>
        ))}</div>; })()}
      </div>}
    </div>
  );
}

export default function BloodBankPage() { return <RoleGuard module="blood_bank"><BloodBankInner /></RoleGuard>; }
