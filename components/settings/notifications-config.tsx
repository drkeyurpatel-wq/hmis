'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

const EVENT_TYPES = [
  { key: 'appointment_reminder', label: 'Appointment Reminder' },
  { key: 'lab_ready', label: 'Lab Results Ready' },
  { key: 'pharmacy_ready', label: 'Pharmacy Ready' },
  { key: 'discharge_summary', label: 'Discharge Summary' },
  { key: 'payment_receipt', label: 'Payment Receipt' },
  { key: 'bill_generated', label: 'Bill Generated' },
];

const CHANNELS = ['whatsapp', 'sms', 'email'] as const;

interface Pref { id?: string; event_type: string; channel: string; is_enabled: boolean; template_text?: string; }

interface Props { centreId: string; flash: (m: string) => void; }

export default function NotificationsConfig({ centreId, flash }: Props) {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState('');

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_notification_preferences').select('*').eq('centre_id', centreId).order('event_type');
    setPrefs(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const getPref = (eventType: string, channel: string): Pref | undefined =>
    prefs.find(p => p.event_type === eventType && p.channel === channel);

  const togglePref = async (eventType: string, channel: string) => {
    if (!centreId || !sb()) return;
    const existing = getPref(eventType, channel);
    if (existing?.id) {
      const newVal = !existing.is_enabled;
      await sb().from('hmis_notification_preferences').update({ is_enabled: newVal }).eq('id', existing.id);
      setPrefs(prev => prev.map(p => p.id === existing.id ? { ...p, is_enabled: newVal } : p));
      flash(`${channel} for ${eventType} ${newVal ? 'enabled' : 'disabled'}`);
    } else {
      const { data } = await sb().from('hmis_notification_preferences').insert({ centre_id: centreId, event_type: eventType, channel, is_enabled: true }).select('*').maybeSingle();
      if (data) setPrefs(prev => [...prev, data]);
      flash(`${channel} for ${eventType} enabled`);
    }
  };

  const sendTest = async (eventType: string) => {
    if (!testPhone || testPhone.replace(/[\s\-]/g, '').length < 10) { flash('Enter a valid phone number'); return; }
    setTestSending(eventType);
    try {
      const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: eventType, phone: testPhone, centre_id: centreId,
        data: { patient_name: 'Test Patient', doctor_name: 'Dr. Test', date: new Date().toLocaleDateString('en-IN'), time: '10:00 AM', centre_name: 'Hospital', test_names: 'CBC, LFT', collection_point: 'Lab Reception', medicine_count: '3', pharmacy_counter: 'Counter 1', ipd_number: 'IPD-TEST-001', discharge_date: new Date().toLocaleDateString('en-IN'), follow_up_date: 'In 7 days' },
      }) });
      const r = await res.json();
      flash(r.success ? 'Test sent!' : (r.skipped ? 'Skipped (disabled)' : `Failed: ${r.error}`));
    } catch (e: any) { flash(`Error: ${e.message}`); }
    setTestSending('');
  };

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Notification Preferences</h3>
          <p className="text-[10px] text-gray-500">Toggle WhatsApp / SMS / Email per event type</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Test phone (e.g. 9876543210)" className="px-2 py-1 border rounded text-xs w-48" />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="p-3 text-left font-medium">Event</th>
            {CHANNELS.map(ch => <th key={ch} className="p-3 text-center font-medium capitalize">{ch}</th>)}
            <th className="p-3 text-center font-medium">Test</th>
          </tr></thead>
          <tbody>{EVENT_TYPES.map(ev => (
            <tr key={ev.key} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{ev.label}</td>
              {CHANNELS.map(ch => {
                const pref = getPref(ev.key, ch);
                const enabled = pref?.is_enabled ?? false;
                return (
                  <td key={ch} className="p-3 text-center">
                    <button onClick={() => togglePref(ev.key, ch)} className={`w-9 h-5 rounded-full relative ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </td>
                );
              })}
              <td className="p-3 text-center">
                <button onClick={() => sendTest(ev.key)} disabled={testSending === ev.key}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700 disabled:opacity-50">
                  {testSending === ev.key ? '...' : 'Test'}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
