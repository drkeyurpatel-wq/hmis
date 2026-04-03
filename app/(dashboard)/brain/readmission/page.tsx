'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery } from '@/lib/hooks/use-supabase-query';
import { TableSkeleton, EmptyState, CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { ArrowLeft, Phone, Home, Calendar, AlertTriangle } from 'lucide-react';
import type { RiskCategory } from '@/types/database';

const RISK_COLORS: Record<RiskCategory, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  very_high: 'bg-red-100 text-red-700',
};

const RISK_LABELS: Record<RiskCategory, string> = {
  low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very High',
};

function ReadmissionInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Separate unfiltered query for distribution cards
  const { data: allRisks, isLoading: loadingAll } = useSupabaseQuery(
    (sb) => sb.from('brain_readmission_risk')
      .select('id, risk_category, was_readmitted')
      .eq('centre_id', centreId),
    [centreId],
    { enabled: !!centreId }
  );

  // Filtered query for table display
  const { data: risks, isLoading, error, isEmpty } = useSupabaseQuery(
    (sb) => {
      let q = sb.from('brain_readmission_risk')
        .select('*, patient:hmis_patients(id, uhid, first_name, last_name, age_years, gender)')
        .eq('centre_id', centreId)
        .order('total_risk_score', { ascending: false })
        .limit(200);
      if (filterCategory !== 'all') q = q.eq('risk_category', filterCategory);
      return q;
    },
    [centreId, filterCategory],
    { enabled: !!centreId }
  );

  // Distribution from unfiltered data
  const distribution = { low: 0, moderate: 0, high: 0, very_high: 0 };
  const allDistData = allRisks as Array<Record<string, unknown>> | null;
  allDistData?.forEach((r) => {
    const cat = r.risk_category as RiskCategory;
    if (cat in distribution) distribution[cat]++;
  });

  const total = allDistData?.length ?? 0;
  const readmittedCount = allDistData?.filter((r) => r.was_readmitted === true).length ?? 0;

  const allData = risks as Array<Record<string, unknown>> | null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/brain" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Readmission Risk</h1>
          <p className="text-sm text-gray-500">30-day readmission prediction and outcome tracking</p>
        </div>
      </div>

      {/* Distribution Cards (always unfiltered) */}
      {loadingAll ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {(Object.entries(distribution) as [RiskCategory, number][]).map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
              className={`bg-white rounded-xl border p-4 text-left cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${filterCategory === cat ? 'ring-2 ring-blue-500' : 'hover:shadow-sm'}`}
            >
              <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-2 ${RISK_COLORS[cat]}`}>
                {RISK_LABELS[cat]}
              </div>
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-400">patients</div>
            </button>
          ))}
        </div>
      )}

      {/* Outcome Tracking */}
      {!loadingAll && total > 0 && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total Scored:</span>{' '}
              <span className="font-semibold">{total}</span>
            </div>
            <div>
              <span className="text-gray-500">Actually Readmitted:</span>{' '}
              <span className="font-semibold text-red-600">{readmittedCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Readmission Rate:</span>{' '}
              <span className="font-semibold">{total > 0 ? ((readmittedCount / total) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Filter:</span>
        {['all', 'high', 'very_high'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 ${filterCategory === cat ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            {cat === 'all' ? 'All' : RISK_LABELS[cat as RiskCategory]}
          </button>
        ))}
      </div>

      {/* Patient Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isEmpty ? (
        <EmptyState
          title="No readmission risk data"
          description="Risk scores are calculated on patient discharge. Data will appear as patients are discharged."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Top Factors</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Readmitted</th>
                </tr>
              </thead>
              <tbody>
                {(allData ?? []).map((risk) => {
                  const patient = risk.patient as Record<string, unknown> | null;
                  const cat = risk.risk_category as RiskCategory;
                  const factors: string[] = [];
                  if ((risk.comorbidity_score as number) >= 0.6) factors.push('Comorbidities');
                  if ((risk.prior_admission_score as number) >= 0.5) factors.push('Prior admissions');
                  if ((risk.age_score as number) >= 0.5) factors.push('Age >65');
                  if ((risk.polypharmacy_score as number) >= 0.5) factors.push('Polypharmacy');
                  if ((risk.emergency_admission_score as number) > 0) factors.push('Emergency');

                  return (
                    <tr key={risk.id as string} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {patient ? `${patient.first_name} ${patient.last_name}` : '--'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {(patient?.uhid as string) ?? ''} | {String(patient?.age_years ?? '')}y {(patient?.gender as string) ?? ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{(risk.total_risk_score as number).toFixed(1)}/10</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${RISK_COLORS[cat]}`}>
                          {RISK_LABELS[cat]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {factors.slice(0, 3).map((f) => (
                            <span key={f} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">{f}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {Boolean(risk.post_discharge_call) && <span title="Call made"><Phone className="w-4 h-4 text-green-500" /></span>}
                          {Boolean(risk.home_care_arranged) && <span title="Home care"><Home className="w-4 h-4 text-green-500" /></span>}
                          {Boolean(risk.followup_appointment_set) && <span title="Follow-up set"><Calendar className="w-4 h-4 text-green-500" /></span>}
                          {!risk.post_discharge_call && !risk.home_care_arranged && !risk.followup_appointment_set && (
                            <span className="text-xs text-gray-400">No actions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {risk.was_readmitted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Day {String(risk.readmission_days ?? '')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReadmissionRiskDashboard() {
  return (
    <RoleGuard module="brain">
      <ReadmissionInner />
    </RoleGuard>
  );
}
