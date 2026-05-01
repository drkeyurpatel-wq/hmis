'use client';
import { useEffect, useState } from 'react';

const severityColors: Record<string, string> = { EXTREME: 'bg-red-600 text-white', HIGH: 'bg-orange-500 text-white', MEDIUM: 'bg-yellow-400', LOW: 'bg-green-200' };

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/quality/incidents?centre_id=${centreId}`).then(r => r.json()).then(setIncidents); }, []);

  const [form, setForm] = useState({ centre_id: centreId, incident_date: new Date().toISOString().slice(0,16), location: '', category: '', description: '', sac_likelihood: 3, sac_consequence: 3 });
  const submit = async () => {
    const res = await fetch('/api/quality/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (res.ok) { setIncidents(prev => [data, ...prev]); setShowForm(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Incident Management</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Report Incident</button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="datetime-local" value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} className="border rounded px-3 py-2 text-sm" />
            <input placeholder="Location (e.g. ICU Bed 3)" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="border rounded px-3 py-2 text-sm" />
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="border rounded px-3 py-2 text-sm">
              <option value="">Select Category</option>
              {['Medication Error','Fall','Needle Stick','Equipment Failure','Surgical','Transfusion','Diagnostic','Communication','Other'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={form.sac_likelihood} onChange={e => setForm({...form, sac_likelihood: +e.target.value})} className="border rounded px-2 py-2 text-sm flex-1">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>L:{n}</option>)}
              </select>
              <select value={form.sac_consequence} onChange={e => setForm({...form, sac_consequence: +e.target.value})} className="border rounded px-2 py-2 text-sm flex-1">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>C:{n}</option>)}
              </select>
            </div>
          </div>
          <textarea placeholder="Describe the incident..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border rounded px-3 py-2 text-sm w-full" rows={3} />
          <button onClick={submit} className="px-4 py-2 bg-red-600 text-white rounded text-sm">Submit Report</button>
        </div>
      )}
      <div className="border rounded-lg divide-y">
        {incidents.length === 0 && <div className="p-8 text-center text-gray-500">No incidents reported</div>}
        {incidents.map((inc: any) => (
          <div key={inc.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono">{inc.incident_number}</code>
                {inc.severity && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[inc.severity]}`}>{inc.severity}</span>}
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{inc.status}</span>
              </div>
              <p className="text-sm mt-1">{inc.description?.slice(0, 120)}</p>
              <div className="text-xs text-gray-500 mt-1">{inc.category} • {inc.location} • {new Date(inc.incident_date).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
