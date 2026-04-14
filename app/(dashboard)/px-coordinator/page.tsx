// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PXCommandCentre() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    fetch(`/api/px/dashboard?centre_id=${centreId}`).then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading PX dashboard...</div>;

  const npsColor = (stats?.nps_score || 0) >= 50 ? 'text-green-600' : (stats?.nps_score || 0) >= 0 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Experience Command Centre</h1>
        <p className="text-sm text-gray-500">Real-time PX metrics — Health1 Shilaj</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-950 p-4">
          <div className={`text-4xl font-black ${npsColor}`}>{stats?.nps_score || 0}</div>
          <div className="text-sm font-semibold mt-1">NPS Score</div>
          <div className="text-xs text-gray-500">{stats?.nps_responses || 0} responses</div>
          <div className="text-xs mt-1">Promoters: {stats?.promoter_pct || 0}% | Detractors: {stats?.detractor_pct || 0}%</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-3xl font-bold text-red-600">{stats?.open_complaints || 0}</div>
          <div className="text-sm font-semibold mt-1">Open Complaints</div>
          <div className="text-xs text-gray-500">{stats?.pending_escalations || 0} pending escalations</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-3xl font-bold text-orange-600">{stats?.open_sla_breaches || 0}</div>
          <div className="text-sm font-semibold mt-1">SLA Breaches</div>
          <div className="text-xs text-gray-500">Active breaches</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-3xl font-bold">{stats?.total_nurse_calls || 0}</div>
          <div className="text-sm font-semibold mt-1">Nurse Calls</div>
          <div className="text-xs text-gray-500">{stats?.total_food_orders || 0} food orders</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/px-coordinator/nps', label: 'NPS Dashboard', icon: '📊', desc: 'Scores, trends, departments' },
          { href: '/px-coordinator/sla', label: 'SLA Monitor', icon: '⏱️', desc: 'Breach tracking & alerts' },
          { href: '/px-coordinator/discharge', label: 'Discharge Surveys', icon: '📝', desc: 'Structured exit feedback' },
          { href: '/px-feedback', label: 'Feedback', icon: '💬', desc: 'Patient feedback inbox' },
          { href: '/px-kitchen', label: 'Kitchen', icon: '🍽️', desc: 'Food orders & menu' },
          { href: '/px-nursing', label: 'Nursing PX', icon: '👩‍⚕️', desc: 'Nurse call management' },
          { href: '/grievances', label: 'Grievances', icon: '📣', desc: 'Grievance resolution' },
          { href: '/visitors', label: 'Visitors', icon: '🚪', desc: 'Visitor pass management' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="border rounded-lg p-3 hover:border-blue-400 transition-colors">
            <span className="text-xl">{item.icon}</span>
            <div className="text-sm font-semibold mt-1">{item.label}</div>
            <div className="text-xs text-gray-500">{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
