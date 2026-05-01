'use client';
import { useEffect, useState } from 'react';

export default function CodeBluePage() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [events, setEvents] = useState<any[]>([]);
  const [activating, setActivating] = useState(false);
  const [form, setForm] = useState({ event_type: 'CODE_BLUE', location: '', ward_id: '', bed: '', patient_id: '' });
  const [timer, setTimer] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => { fetch(`/api/ipd/code-blue?centre_id=${centreId}`).then(r => r.json()).then(setEvents); }, []);
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => setTimer(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const activate = async () => {
    if (!form.location) return;
    setActivating(true);
    setStartTime(new Date());
    const body = { centre_id: centreId, ...form, activation_time: new Date().toISOString() };
    const res = await fetch('/api/ipd/code-blue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { const data = await res.json(); setEvents(prev => [data, ...prev]); }
    setActivating(false);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-red-700">Code Blue / Rapid Response</h1>
        <p className="text-sm text-gray-500">Emergency activation with response time tracking. Auto-creates EXTREME quality incident.</p>
      </div>

      {timer !== null && (
        <div className="border-4 border-red-500 rounded-2xl p-8 text-center bg-red-50 animate-pulse">
          <div className="text-sm font-bold text-red-600 uppercase tracking-wider">🔴 Active Emergency</div>
          <div className="text-6xl font-black text-red-700 mt-2 font-mono">{formatTime(timer)}</div>
          <div className="text-sm text-red-600 mt-2">{form.event_type} — {form.location}</div>
        </div>
      )}

      <div className="border-2 border-red-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-red-700">Activate Emergency</h3>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))} className="border rounded px-3 py-2 text-sm">
            <option value="CODE_BLUE">Code Blue (Cardiac Arrest)</option>
            <option value="RAPID_RESPONSE">Rapid Response</option>
            <option value="CODE_RED">Code Red (Fire)</option>
            <option value="CODE_PINK">Code Pink (Infant Abduction)</option>
          </select>
          <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (e.g. ICU Bed 3, Ward B Room 12)" className="border rounded px-3 py-2 text-sm" />
          <input type="text" value={form.bed} onChange={e => setForm(p => ({ ...p, bed: e.target.value }))} placeholder="Bed number (optional)" className="border rounded px-3 py-2 text-sm" />
          <input type="text" value={form.patient_id} onChange={e => setForm(p => ({ ...p, patient_id: e.target.value }))} placeholder="Patient ID (optional)" className="border rounded px-3 py-2 text-sm" />
        </div>
        <button onClick={activate} disabled={!form.location || activating} className={`w-full py-4 rounded-xl font-bold text-xl text-white ${form.location ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed'}`}>
          🚨 ACTIVATE {form.event_type.replace(/_/g, ' ')}
        </button>
      </div>

      <div className="border rounded-lg">
        <div className="bg-gray-50 px-4 py-2 font-semibold text-sm">Event History ({events.length})</div>
        <div className="divide-y">{events.length === 0 && <div className="p-6 text-center text-gray-500">No events recorded</div>}
          {events.map(e => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">{e.event_type?.replace(/_/g, ' ')}</span>
                  <span className="text-sm">{e.location}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(e.activation_time).toLocaleString()}</span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                {e.response_seconds && <span>Response: <strong>{e.response_seconds}s</strong></span>}
                {e.outcome && <span className={`font-medium ${e.outcome === 'ROSC' ? 'text-green-600' : e.outcome === 'DEATH' ? 'text-red-600' : 'text-blue-600'}`}>{e.outcome}</span>}
                {e.cpr_started && <span>CPR: {e.cpr_duration_minutes}min</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
