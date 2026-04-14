// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OTCommandCentre() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    fetch(`/api/ot/dashboard?centre_id=${centreId}`).then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading OT Command Centre...</div>;

  const rooms = stats?.ot_rooms || [];
  const roomTypeColors: Record<string, string> = {
    MAJOR: 'bg-blue-100 border-blue-300', MINOR: 'bg-green-100 border-green-300',
    ROBOTIC: 'bg-purple-100 border-purple-300', EMERGENCY: 'bg-red-100 border-red-300',
    CATHLAB: 'bg-amber-100 border-amber-300', SPECIALTY: 'bg-teal-100 border-teal-300',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OT Command Centre</h1>
          <p className="text-sm text-gray-500">6 OTs + Cathlab • Cuvis Robot (OT-3) • SSI Mantra 3.0</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Today Cases', value: stats?.today_cases || 0, color: 'blue' },
          { label: 'PACU Patients', value: stats?.patients_in_pacu || 0, color: stats?.patients_in_pacu > 0 ? 'red' : 'green' },
          { label: 'Safety Checklists', value: stats?.safety_checklists || 0, color: 'green' },
          { label: 'Avg Turnaround', value: `${stats?.avg_turnaround_min || 0}m`, color: (stats?.avg_turnaround_min || 0) <= 30 ? 'green' : 'amber' },
          { label: 'Implants Logged', value: stats?.total_implants || 0, color: 'purple' },
        ].map(c => (
          <div key={c.label} className="border rounded-lg p-4">
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-semibold mb-3">OT Rooms — Live Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rooms.map((room: any) => {
            const todayCase = (stats?.today_schedule || []).find((b: any) => b.ot_room_id === room.id);
            return (
              <div key={room.id} className={`rounded-lg border-2 p-4 ${roomTypeColors[room.type] || 'bg-gray-100 border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{room.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/50">{room.type}</span>
                </div>
                {room.has_robotic && <div className="text-xs mt-1 text-purple-600 font-medium">🤖 Cuvis Robot</div>}
                {room.has_laminar_flow && <div className="text-xs text-blue-600">Laminar Flow</div>}
                <div className="text-xs text-gray-500 mt-1">{room.max_daily_slots} slots/day</div>
                {todayCase ? (
                  <div className="mt-2 text-xs bg-white/70 rounded p-1.5">
                    <div className="font-medium">{todayCase.procedure_name?.slice(0, 30)}</div>
                    <div className="text-gray-500">{todayCase.surgeon_name} • {todayCase.scheduled_time}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-green-700 font-medium">Available</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/ot-command/surgeons', label: 'Surgeon Dashboard', icon: '👨‍⚕️' },
          { href: '/ot-command/tomorrow', label: 'Tomorrow Schedule', icon: '📅' },
          { href: '/ot-command/turnaround', label: 'Turnaround Analytics', icon: '⏱️' },
          { href: '/ot-command/implants', label: 'Implant Registry', icon: '🔩' },
          { href: '/ot-command/post-op', label: 'Post-Op Monitor', icon: '🏥' },
          { href: '/ot-command/equipment', label: 'Equipment Log', icon: '🤖' },
          { href: '/ot-command/preferences', label: 'Preference Cards', icon: '📋' },
          { href: '/surgical-planning', label: 'Surgical Planning', icon: '✂️' },
        ].map(a => (
          <Link key={a.href} href={a.href} className="border rounded-lg p-3 hover:border-blue-400 transition-colors text-center">
            <span className="text-xl">{a.icon}</span>
            <div className="text-sm font-medium mt-1">{a.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
