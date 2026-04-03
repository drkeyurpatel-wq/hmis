'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery } from '@/lib/hooks/use-supabase-query';
import { TableSkeleton, EmptyState, CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

function LOSOptimizationInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [showOutliersOnly, setShowOutliersOnly] = useState(false);

  const { data: predictions, isLoading, error, isEmpty } = useSupabaseQuery(
    (sb) => {
      let q = sb.from('brain_los_predictions')
        .select('*, admission:hmis_admissions(id, ipd_number, admission_date, actual_discharge, status, patient:hmis_patients(id, uhid, first_name, last_name, age_years))')
        .eq('centre_id', centreId)
        .order('calculated_at', { ascending: false })
        .limit(200);
      if (showOutliersOnly) q = q.eq('is_outlier', true);
      return q;
    },
    [centreId, showOutliersOnly],
    { enabled: !!centreId }
  );

  const { data: benchmarks } = useSupabaseQuery(
    (sb) => sb.from('brain_los_benchmarks')
      .select('*')
      .or(`centre_id.eq.${centreId},centre_id.is.null`)
      .order('sample_size', { ascending: false })
      .limit(20),
    [centreId],
    { enabled: !!centreId }
  );

  const allPredictions = predictions as Array<Record<string, unknown>> | null;
  const allBenchmarks = benchmarks as Array<Record<string, unknown>> | null;

  // Summary stats
  const totalPredictions = allPredictions?.length ?? 0;
  const outlierCount = allPredictions?.filter((p) => p.is_outlier).length ?? 0;
  const withActual = allPredictions?.filter((p) => p.actual_los_days !== null) ?? [];
  const avgAccuracy = withActual.length > 0
    ? Math.round(withActual.reduce((sum, p) => {
        const predicted = p.predicted_los_days as number;
        const actual = p.actual_los_days as number;
        const maxVal = Math.max(predicted, actual, 1);
        return sum + (1 - Math.abs(predicted - actual) / maxVal);
      }, 0) / withActual.length * 100)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/brain" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LOS Optimization</h1>
          <p className="text-sm text-gray-500">Predicted vs actual length of stay with outlier detection</p>
        </div>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Predictions</div>
            <div className="text-2xl font-bold text-gray-900">{totalPredictions}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Outliers</div>
            <div className={`text-2xl font-bold ${outlierCount > 5 ? 'text-red-600' : 'text-gray-900'}`}>
              {outlierCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Prediction Accuracy</div>
            <div className="text-2xl font-bold text-gray-900">{avgAccuracy}%</div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOutliersOnly}
            onChange={(e) => setShowOutliersOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Show outliers only</span>
        </label>
      </div>

      {/* Predictions Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : isEmpty ? (
        <EmptyState
          title="No LOS predictions"
          description="Predictions are generated on new admissions. Data will appear as patients are admitted."
        />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-600">IPD #</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Predicted LOS</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Actual LOS</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Variance</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Confidence</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {(allPredictions ?? []).map((pred) => {
                  const admission = pred.admission as Record<string, unknown> | null;
                  const patient = admission?.patient as Record<string, unknown> | null;
                  const predicted = pred.predicted_los_days as number;
                  const actual = pred.actual_los_days as number | null;
                  const variance = actual !== null ? actual - predicted : null;
                  const isOutlier = pred.is_outlier as boolean;

                  return (
                    <tr key={pred.id as string} className={`border-b last:border-0 hover:bg-gray-50 ${isOutlier ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {patient ? `${patient.first_name} ${patient.last_name}` : '--'}
                        </div>
                        <div className="text-xs text-gray-400">{patient?.uhid as string}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{admission?.ipd_number as string || '--'}</td>
                      <td className="px-4 py-3 font-medium">{predicted.toFixed(1)}d</td>
                      <td className="px-4 py-3">
                        {actual !== null ? `${actual.toFixed(1)}d` : <span className="text-gray-400">In progress</span>}
                      </td>
                      <td className="px-4 py-3">
                        {variance !== null ? (
                          <span className={variance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {variance > 0 ? '+' : ''}{variance.toFixed(1)}d
                          </span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${((pred.prediction_confidence as number) ?? 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {(((pred.prediction_confidence as number) ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOutlier ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertTriangle className="w-3 h-3" /> Outlier
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">Normal</span>
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

      {/* Benchmarks Table */}
      {allBenchmarks && allBenchmarks.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">LOS Benchmarks by Diagnosis/Procedure</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Avg LOS</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Median</th>
                  <th className="px-4 py-3 font-medium text-gray-600">P25-P75</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Samples</th>
                </tr>
              </thead>
              <tbody>
                {allBenchmarks.map((b) => (
                  <tr key={b.id as string} className="border-b last:border-0">
                    <td className="px-4 py-3 capitalize">{b.category as string}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.code as string}</td>
                    <td className="px-4 py-3 text-gray-600">{(b.description as string) || '--'}</td>
                    <td className="px-4 py-3 font-medium">{(b.avg_los as number).toFixed(1)}d</td>
                    <td className="px-4 py-3">{b.median_los ? `${(b.median_los as number).toFixed(1)}d` : '--'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {b.p25_los && b.p75_los ? `${(b.p25_los as number).toFixed(1)}-${(b.p75_los as number).toFixed(1)}d` : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.sample_size as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LOSOptimizationDashboard() {
  return (
    <RoleGuard module="brain">
      <LOSOptimizationInner />
    </RoleGuard>
  );
}
