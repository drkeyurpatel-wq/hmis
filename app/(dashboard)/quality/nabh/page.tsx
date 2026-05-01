'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NABHTracker() {
  const [chapters, setChapters] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/quality/nabh/chapters?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/quality/nabh/scorecard?centre_id=${centreId}&view=overall`).then(r => r.json()),
    ]).then(([ch, sc]) => { setChapters(ch); setScorecard(sc); });
  }, []);

  const levelColors: Record<string, string> = {
    CORE: 'bg-red-100 text-red-800', COMMITMENT: 'bg-blue-100 text-blue-800',
    ACHIEVEMENT: 'bg-green-100 text-green-800', EXCELLENCE: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">NABH 6th Edition Tracker</h1>
          <p className="text-sm text-gray-500">10 Chapters • 100 Standards • 639 Objective Elements</p>
        </div>
      </div>

      {scorecard.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {scorecard.map((s: any) => (
            <div key={s.level} className={`rounded-lg p-3 ${levelColors[s.level] || 'bg-gray-100'}`}>
              <div className="text-xs font-semibold uppercase">{s.level}</div>
              <div className="text-xl font-bold mt-1">{s.compliance_pct || 0}%</div>
              <div className="text-xs">{s.assessed}/{s.total_elements} assessed</div>
              <div className="text-xs mt-0.5">{s.meets_target ? '✅ Meets 80%' : '❌ Below 80%'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chapters.map((ch: any) => (
          <Link key={ch.id} href={`/quality/nabh/${ch.id}`}
            className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ch.category === 'PATIENT_CENTRIC' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {ch.code}
                </span>
                <h3 className="font-medium mt-1">{ch.name}</h3>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{ch.assessed_count || 0}/{ch.total_elements}</div>
                <div className="text-xs text-gray-500">{ch.total_standards} standards</div>
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-red-600">C:{ch.core_count}</span>
              <span className="text-blue-600">Cm:{ch.commitment_count}</span>
              <span className="text-green-600">A:{ch.achievement_count}</span>
              <span className="text-purple-600">E:{ch.excellence_count}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
