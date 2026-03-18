// components/radiology/modality-rooms.tsx
// Equipment/room management with DICOM settings
'use client';
import React, { useState } from 'react';
import { useRadiologyRooms, usePACSConfig } from '@/lib/radiology/radiology-hooks';

const MOD_COLORS: Record<string, string> = { XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700', USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700', MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700' };

interface Props { centreId: string; }

export default function ModalityRooms({ centreId }: Props) {
  const { rooms, saveRoom } = useRadiologyRooms(centreId);
  const pacs = usePACSConfig(centreId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', modality: 'XR', manufacturer: '', model: '', dicom_ae_title: '', dicom_ip: '', dicom_port: 104 });
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Room name required'); return; }
    setError('');
    const r = await saveRoom(form);
    if (!r.success) { setError(r.error || 'Failed'); return; }
    setShowForm(false);
    setForm({ name: '', modality: 'XR', manufacturer: '', model: '', dicom_ae_title: '', dicom_ip: '', dicom_port: 104 });
  };

  return (
    <div className="space-y-4">
      {/* PACS config card */}
      <div className={`rounded-xl border p-4 ${pacs.config ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">{pacs.config ? 'Stradus PACS Connected' : 'PACS Not Configured'}</h3>
            {pacs.config && <div className="text-xs text-gray-500 mt-0.5">
              <span className="font-mono">{pacs.config.pacs_url}</span> | Viewer: <span className="font-mono">{pacs.config.viewer_url || 'N/A'}</span>
              | AE: {pacs.config.dicom_ae_title || '—'} | {pacs.config.dicom_ip || '—'}:{pacs.config.dicom_port || 104}
            </div>}
          </div>
          <span className={`w-3 h-3 rounded-full ${pacs.config ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
        {pacs.config && <div className="mt-2 text-[10px] text-gray-400">
          Webhook endpoint: <span className="font-mono">POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/radiology/stradus-webhook</span>
          <br />Configure this URL in Stradus RIS settings to receive reports automatically.
        </div>}
        {!pacs.config && <div className="mt-2 text-xs text-gray-500">Insert a row in <span className="font-mono">hmis_pacs_config</span> with your Stradus PACS details to enable image viewing and report sync.</div>}
      </div>

      {/* Rooms / Equipment */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Radiology Rooms &amp; Equipment ({rooms.length})</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Add Room'}</button>
      </div>

      {showForm && <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Room Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="CT-1, MRI-A..." /></div>
          <div><label className="text-xs text-gray-500">Modality</label><select value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
            {['XR', 'CT', 'MRI', 'USG', 'ECHO', 'DEXA', 'MAMMO', 'FLUORO'].map(m => <option key={m} value={m}>{m}</option>)}
          </select></div>
          <div><label className="text-xs text-gray-500">Manufacturer</label><input type="text" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="GE, Siemens, Philips..." /></div>
          <div><label className="text-xs text-gray-500">Model</label><input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">DICOM AE Title</label><input type="text" value={form.dicom_ae_title} onChange={e => setForm(f => ({ ...f, dicom_ae_title: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
          <div><label className="text-xs text-gray-500">DICOM IP</label><input type="text" value={form.dicom_ip} onChange={e => setForm(f => ({ ...f, dicom_ip: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
          <div><label className="text-xs text-gray-500">DICOM Port</label><input type="number" value={form.dicom_port} onChange={e => setForm(f => ({ ...f, dicom_port: parseInt(e.target.value) || 104 }))} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Room</button>
      </div>}

      {rooms.length === 0 ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No rooms configured. Add your radiology equipment above.</div> :
      <div className="grid grid-cols-2 gap-3">{rooms.map(r => (
        <div key={r.id} className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${MOD_COLORS[r.modality] || 'bg-gray-100'}`}>{r.modality}</span>
              <span className="font-bold text-sm">{r.name}</span>
            </div>
            <span className={`w-2 h-2 rounded-full ${r.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <div className="text-xs text-gray-500 space-y-0.5">
            {r.manufacturer && <div>{r.manufacturer} {r.model}</div>}
            {r.dicom_ae_title && <div className="font-mono text-[10px]">AE: {r.dicom_ae_title} | {r.dicom_ip}:{r.dicom_port}</div>}
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
