'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NursingStation() {
  const [stats, setStats] = useState<any>(null);
  const [census, setCensus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/ipd/dashboard?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/ipd/bed-census?centre_id=${centreId}`).then(r => r.json()),
    ]).then(([s, c]) => { setStats(s); setCensus(c); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading Nursing Station...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nursing Station — IPD Command Centre</h1>
        <p className="text-sm text-gray-500">330 beds • 8 wards • Real-time clinical monitoring</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active Patients', value: stats?.active_admissions || 0, color: 'blue' },
          { label: 'Occupancy', value: `${stats?.occupancy_pct || 0}%`, sub: `${stats?.occupied_beds}/${stats?.total_beds} beds`, color: (stats?.occupancy_pct || 0) >= 85 ? 'red' : 'green' },
          { label: 'Fall Risk (HIGH)', value: stats?.high_fall_risk_patients || 0, color: stats?.high_fall_risk_patients > 0 ? 'red' : 'green' },
          { label: 'Pressure Risk', value: stats?.high_pressure_risk_patients || 0, color: stats?.high_pressure_risk_patients > 0 ? 'amber' : 'green' },
          { label: 'NEWS2 Alerts', value: stats?.ews_alerts_pending || 0, color: stats?.ews_alerts_pending > 0 ? 'red' : 'green' },
          { label: 'Active Care Plans', value: stats?.active_care_plans || 0, color: 'blue' },
          { label: 'Active Restraints', value: stats?.active_restraints || 0, color: stats?.active_restraints > 0 ? 'amber' : 'green' },
          { label: 'Code Blue Today', value: stats?.code_blue_today || 0, color: stats?.code_blue_today > 0 ? 'red' : 'green' },
          { label: 'PACU Patients', value: stats?.patients_in_pacu || 0, color: 'purple' },
          { label: 'Available Beds', value: stats?.available_beds || 0, color: 'teal' },
        ].map(c => {
          const colors: Record<string, string> = {
            blue: 'bg-blue-50 border-blue-200', red: 'bg-red-50 border-red-200', green: 'bg-green-50 border-green-200',
            amber: 'bg-amber-50 border-amber-200', purple: 'bg-purple-50 border-purple-200', teal: 'bg-teal-50 border-teal-200',
          };
          return (
            <div key={c.label} className={`rounded-lg border p-3 ${colors[c.color]}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs font-medium">{c.label}</div>
              {c.sub && <div className="text-xs text-gray-500">{c.sub}</div>}
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Ward Census</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(census?.wards || []).map((w: any) => {
            const pct = w.total > 0 ? Math.round(w.occupied / w.total * 100) : 0;
            return (
              <div key={w.ward_name} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{w.ward_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${pct >= 85 ? 'bg-red-100 text-red-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{pct}%</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{w.occupied}/{w.total} occupied • {w.available} free</div>
                <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/ipd', label: 'Patient List', icon: '👥' },
          { href: '/bed-management', label: 'Bed Management', icon: '🛏️' },
          { href: '/ward-board', label: 'Ward Board', icon: '📋' },
          { href: '/handover', label: 'Shift Handover', icon: '🔄' },
          { href: '/bed-turnover', label: 'Bed Turnover', icon: '📊' },
          { href: '/ot-command/post-op', label: 'Post-Op Monitor', icon: '🏥' },
          { href: '/px-nursing', label: 'Nurse Calls', icon: '🔔' },
          { href: '/quality/incidents', label: 'Incidents', icon: '⚠️' },
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
