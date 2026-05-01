'use client';
import { useEffect, useState } from 'react';

export default function QualityCommandCentre() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    fetch(`/api/quality/dashboard-stats?centre_id=${centreId}`)
      .then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading quality dashboard...</div>;

  const cards = [
    { label: 'NABH Compliance', value: `${stats?.nabh_compliance_pct || 0}%`, sub: `${stats?.assessed_count || 0}/639 assessed`, color: 'blue' },
    { label: 'Open Incidents', value: stats?.open_incidents || 0, sub: `${stats?.overdue_capa || 0} overdue CAPA`, color: stats?.open_incidents > 0 ? 'red' : 'green' },
    { label: 'Sentinel Events', value: stats?.sentinel_events || 0, sub: 'Never events', color: stats?.sentinel_events > 0 ? 'red' : 'green' },
    { label: 'Near Misses', value: stats?.near_misses || 0, sub: 'Non-punitive reports', color: 'amber' },
    { label: 'Completed Audits', value: stats?.completed_audits || 0, sub: 'Clinical audits', color: 'green' },
    { label: 'IPC Checks', value: stats?.ipc_checks_total || 0, sub: 'Bundle compliance', color: 'teal' },
    { label: 'Mortality Reviews', value: stats?.mortality_reviews || 0, sub: 'Structured reviews', color: 'purple' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
    amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
    teal: 'bg-teal-50 border-teal-200 dark:bg-teal-950 dark:border-teal-800',
    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quality Command Centre</h1>
        <p className="text-sm text-gray-500 mt-1">NABH 6th Edition Excellence — Target: 80% of 639 OEs ≥ 2556/3195 points</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-lg border p-4 ${colorMap[c.color] || colorMap.blue}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm font-medium mt-1">{c.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Excellence Scorecard Target</h3>
          <div className="space-y-2 text-sm">
            {['CORE (105)', 'COMMITMENT (457)', 'ACHIEVEMENT (60)', 'EXCELLENCE (17)'].map(level => (
              <div key={level} className="flex items-center justify-between">
                <span>{level}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats?.nabh_compliance_pct || 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">≥ 80%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Report Incident', href: '/quality/incidents' },
              { label: 'Log Near Miss', href: '/quality/incidents' },
              { label: 'Run Audit', href: '/quality/audits' },
              { label: 'IPC Bundle Check', href: '/quality/ipc' },
              { label: 'NABH Self-Assessment', href: '/quality/nabh' },
              { label: 'Log Safety Drill', href: '/quality/drills' },
            ].map(a => (
              <a key={a.label} href={a.href} className="text-sm px-3 py-2 bg-white dark:bg-gray-800 border rounded-md hover:bg-gray-50 text-center">{a.label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
