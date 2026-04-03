'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery } from '@/lib/hooks/use-supabase-query';
import { TableSkeleton, EmptyState, CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { ArrowLeft, Award } from 'lucide-react';
import type { QualityGrade } from '@/types/database';

const GRADE_COLORS: Record<QualityGrade, string> = {
  A: 'bg-green-100 text-green-700 border-green-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-orange-100 text-orange-700 border-orange-200',
  F: 'bg-red-100 text-red-700 border-red-200',
};

interface IndicatorDef {
  key: string;
  label: string;
  unit: string;
  direction: 'lower' | 'higher';
  good: number;
  acceptable: number;
}

const INDICATORS: IndicatorDef[] = [
  { key: 'fall_rate', label: 'Fall Rate', unit: '/1000 pt-days', direction: 'lower', good: 1.0, acceptable: 3.0 },
  { key: 'medication_error_rate', label: 'Medication Error Rate', unit: '/1000 pt-days', direction: 'lower', good: 0.5, acceptable: 2.0 },
  { key: 'wrong_site_surgery_count', label: 'Wrong-Site Surgery', unit: 'events', direction: 'lower', good: 0, acceptable: 0 },
  { key: 'pressure_ulcer_rate', label: 'Pressure Ulcer Rate', unit: '/1000 pt-days', direction: 'lower', good: 1.0, acceptable: 3.0 },
  { key: 'mortality_rate', label: 'Mortality Rate', unit: '%', direction: 'lower', good: 1.0, acceptable: 3.0 },
  { key: 'icu_mortality_rate', label: 'ICU Mortality Rate', unit: '%', direction: 'lower', good: 10.0, acceptable: 20.0 },
  { key: 'readmission_30_day_rate', label: '30-Day Readmission', unit: '%', direction: 'lower', good: 5.0, acceptable: 10.0 },
  { key: 'return_to_ot_rate', label: 'Return to OT Rate', unit: '%', direction: 'lower', good: 1.0, acceptable: 3.0 },
  { key: 'ssi_rate', label: 'SSI Rate', unit: '%', direction: 'lower', good: 2.0, acceptable: 5.0 },
  { key: 'antibiotic_prophylaxis_compliance', label: 'Antibiotic Prophylaxis', unit: '%', direction: 'higher', good: 95, acceptable: 80 },
  { key: 'surgical_safety_checklist_compliance', label: 'Surgical Safety Checklist', unit: '%', direction: 'higher', good: 95, acceptable: 85 },
  { key: 'consent_compliance', label: 'Consent Compliance', unit: '%', direction: 'higher', good: 100, acceptable: 95 },
  { key: 'ed_wait_time_avg_min', label: 'ED Wait Time', unit: 'min', direction: 'lower', good: 30, acceptable: 60 },
  { key: 'nursing_documentation_compliance', label: 'Nursing Documentation', unit: '%', direction: 'higher', good: 95, acceptable: 80 },
  { key: 'patient_satisfaction_score', label: 'Patient Satisfaction', unit: '/10', direction: 'higher', good: 8.0, acceptable: 6.0 },
  { key: 'grievance_resolution_within_48h_pct', label: 'Grievance Resolution <48h', unit: '%', direction: 'higher', good: 90, acceptable: 70 },
];

function getTrafficLight(value: number, ind: IndicatorDef): 'green' | 'yellow' | 'red' {
  if (ind.direction === 'lower') {
    if (value <= ind.good) return 'green';
    if (value <= ind.acceptable) return 'yellow';
    return 'red';
  } else {
    if (value >= ind.good) return 'green';
    if (value >= ind.acceptable) return 'yellow';
    return 'red';
  }
}

const LIGHT_CLASSES = {
  green: 'bg-green-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

function QualityScorecardInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const { data: scorecards, isLoading, error, isEmpty } = useSupabaseQuery(
    (sb) => sb.from('brain_quality_indicators')
      .select('*')
      .eq('centre_id', centreId)
      .order('month', { ascending: false })
      .limit(12),
    [centreId],
    { enabled: !!centreId }
  );

  const allCards = scorecards as Array<Record<string, unknown>> | null;
  const latest = allCards?.[0];
  const grade = (latest?.overall_grade as QualityGrade) ?? null;
  const score = (latest?.overall_quality_score as number) ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/brain" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quality Scorecard</h1>
            <p className="text-sm text-gray-500">NABH-aligned clinical quality indicators</p>
          </div>
        </div>
      </div>

      {/* Overall Grade */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : latest ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-6 flex items-center gap-6">
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold border-2 ${grade ? GRADE_COLORS[grade] : 'bg-gray-100 text-gray-400'}`}>
              {grade ?? '--'}
            </div>
            <div>
              <div className="text-sm text-gray-500">Overall Quality Score</div>
              <div className="text-3xl font-bold text-gray-900">{score.toFixed(1)}<span className="text-lg text-gray-400">/100</span></div>
              <div className="text-xs text-gray-400 mt-1">Month: {latest.month as string}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <div className="text-sm text-gray-500 mb-2">Score Trend (Last {allCards?.length ?? 0} months)</div>
            <div className="flex items-end gap-1 h-16">
              {[...(allCards ?? [])].reverse().map((card, i) => {
                const s = (card.overall_quality_score as number) || 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-sm ${s >= 75 ? 'bg-green-400' : s >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ height: `${Math.max(4, s * 0.6)}px` }}
                      title={`${card.month}: ${s.toFixed(1)}`}
                    />
                    <span className="text-[8px] text-gray-400">{(card.month as string).slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Indicator Traffic Lights */}
      {isLoading ? (
        <TableSkeleton rows={16} cols={4} />
      ) : isEmpty ? (
        <EmptyState
          title="No quality data"
          description="Generate a monthly quality scorecard to see NABH indicators here."
        />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : latest ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Monthly Report Card: {latest.month as string}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 w-8">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Indicator</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Value</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Benchmark (Good)</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Benchmark (Acceptable)</th>
                </tr>
              </thead>
              <tbody>
                {INDICATORS.map((ind) => {
                  const value = (latest[ind.key] as number) ?? 0;
                  const light = getTrafficLight(value, ind);

                  return (
                    <tr key={ind.key} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className={`w-3 h-3 rounded-full ${LIGHT_CLASSES[light]}`} title={light} />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{ind.label}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${light === 'green' ? 'text-green-700' : light === 'yellow' ? 'text-amber-700' : 'text-red-700'}`}>
                          {value}{ind.unit.startsWith('/') || ind.unit.startsWith('%') ? '' : ' '}{ind.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ind.direction === 'lower' ? `<${ind.good}` : `>${ind.good}`} {ind.unit}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ind.direction === 'lower' ? `<${ind.acceptable}` : `>${ind.acceptable}`} {ind.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function QualityScorecardDashboard() {
  return (
    <RoleGuard module="brain">
      <QualityScorecardInner />
    </RoleGuard>
  );
}
