'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { FlaskConical, Check, AlertTriangle, Search, ArrowLeft, Loader2 } from 'lucide-react';

/* ---------- Types ---------- */
interface LabOrderRow {
  id: string;
  test_id: string;
  test_name: string;
  status: string;
  priority: string;
  created_at: string;
  patient: {
    first_name: string;
    last_name: string;
    uhid: string;
    age_years: number;
    gender: string;
  };
  sample: { id: string; barcode: string; collected_at: string }[];
}

interface TestParameter {
  id: string;
  parameter_name: string;
  unit: string;
  data_type: string;
  sort_order: number;
  ref_range_min: number | null;
  ref_range_max: number | null;
  critical_low: number | null;
  critical_high: number | null;
  is_reportable: boolean;
  ref_ranges: {
    gender: string;
    age_min_years: number;
    age_max_years: number;
    ref_min: number | null;
    ref_max: number | null;
  }[];
}

interface ResultEntry {
  parameterId: string;
  parameterName: string;
  value: string;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  isAbnormal: boolean;
}

/* ---------- Skeleton ---------- */
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function LabResultsPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<LabOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sample_collected' | 'processing'>('all');

  const [selectedOrder, setSelectedOrder] = useState<LabOrderRow | null>(null);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [resultEntries, setResultEntries] = useState<ResultEntry[]>([]);
  const [existingEnteredBy, setExistingEnteredBy] = useState<string | null>(null);
  const [paramsLoading, setParamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  /* ---------- Load worklist ---------- */
  const loadOrders = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data, error } = await sb()
      .from('hmis_lab_orders')
      .select(
        '*, patient:hmis_patients(first_name, last_name, uhid, age_years, gender), sample:hmis_lab_samples(id, barcode, collected_at)'
      )
      .eq('centre_id', centreId)
      .in('status', ['sample_collected', 'processing'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) {
      setOrders(data as unknown as LabOrderRow[]);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /* ---------- Filter + Search ---------- */
  useEffect(() => {
    let filtered = orders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.patient.first_name.toLowerCase().includes(term) ||
          o.patient.last_name.toLowerCase().includes(term) ||
          o.patient.uhid.toLowerCase().includes(term) ||
          (o.test_name || '').toLowerCase().includes(term) ||
          (o.sample?.[0]?.barcode || '').toLowerCase().includes(term)
      );
    }
    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchTerm]);

  /* ---------- Load parameters for selected order ---------- */
  const loadParameters = useCallback(
    async (order: LabOrderRow) => {
      setParamsLoading(true);
      setParameters([]);
      setResultEntries([]);
      setExistingEnteredBy(null);

      // Load test parameters with reference ranges
      const { data: params } = await sb()
        .from('hmis_lab_test_parameters')
        .select('*, ref_ranges:hmis_lab_ref_ranges(*)')
        .eq('test_id', order.test_id)
        .order('sort_order');

      const testParams = (params || []) as unknown as TestParameter[];
      setParameters(testParams);

      // Load any existing results for this order
      const { data: existingResults } = await sb()
        .from('hmis_lab_results')
        .select('*')
        .eq('lab_order_id', order.id);

      // Build entries from params, pre-filling existing values
      const entries: ResultEntry[] = testParams
        .filter((p) => p.is_reportable !== false)
        .map((p) => {
          const existing = (existingResults || []).find(
            (r: any) => r.parameter_id === p.id || r.parameter_name === p.parameter_name
          );

          // Resolve reference range (age/gender specific first)
          let refMin = p.ref_range_min;
          let refMax = p.ref_range_max;
          if (p.ref_ranges?.length > 0) {
            const specific = p.ref_ranges.find(
              (r) =>
                (r.gender === order.patient.gender || r.gender === 'all') &&
                order.patient.age_years >= r.age_min_years &&
                order.patient.age_years <= r.age_max_years
            );
            if (specific) {
              refMin = specific.ref_min;
              refMax = specific.ref_max;
            }
          }

          const value = existing?.result_value || '';
          const numVal = parseFloat(value);
          const isAbnormal =
            value !== '' &&
            !isNaN(numVal) &&
            ((refMin !== null && numVal < refMin) || (refMax !== null && numVal > refMax));

          return {
            parameterId: p.id,
            parameterName: p.parameter_name,
            value,
            unit: p.unit || '',
            refMin,
            refMax,
            isAbnormal,
          };
        });

      setResultEntries(entries);

      // Track who entered existing results (for verify guard)
      if (existingResults && existingResults.length > 0) {
        setExistingEnteredBy((existingResults[0] as any).entered_by || null);
      }

      setParamsLoading(false);
    },
    []
  );

  const handleSelectOrder = (order: LabOrderRow) => {
    setSelectedOrder(order);
    loadParameters(order);
  };

  /* ---------- Update a result value ---------- */
  const updateResultValue = (index: number, value: string) => {
    setResultEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index], value };
      const numVal = parseFloat(value);
      entry.isAbnormal =
        value !== '' &&
        !isNaN(numVal) &&
        ((entry.refMin !== null && numVal < entry.refMin) ||
          (entry.refMax !== null && numVal > entry.refMax));
      updated[index] = entry;
      return updated;
    });
  };

  /* ---------- Start Processing ---------- */
  const startProcessing = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    await sb()
      .from('hmis_lab_orders')
      .update({ status: 'processing' })
      .eq('id', selectedOrder.id);
    setSelectedOrder({ ...selectedOrder, status: 'processing' });
    flash('Status updated to Processing');
    loadOrders();
    setSaving(false);
  };

  /* ---------- Save + Complete ---------- */
  const saveAndComplete = async () => {
    if (!selectedOrder) return;
    const filledEntries = resultEntries.filter((e) => e.value.trim() !== '');
    if (filledEntries.length === 0) {
      flash('Enter at least one result value before completing.');
      return;
    }
    setSaving(true);

    for (const entry of filledEntries) {
      const refRange =
        entry.refMin !== null && entry.refMax !== null
          ? `${entry.refMin} - ${entry.refMax}`
          : entry.refMin !== null
            ? `>= ${entry.refMin}`
            : entry.refMax !== null
              ? `<= ${entry.refMax}`
              : '';

      // Check if result already exists for this parameter
      const { data: existing } = await sb()
        .from('hmis_lab_results')
        .select('id')
        .eq('lab_order_id', selectedOrder.id)
        .eq('parameter_name', entry.parameterName)
        .limit(1);

      if (existing && existing.length > 0) {
        await sb()
          .from('hmis_lab_results')
          .update({
            result_value: entry.value,
            unit: entry.unit,
            reference_range: refRange,
            is_abnormal: entry.isAbnormal,
            entered_by: staffId,
            entered_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
      } else {
        await sb().from('hmis_lab_results').insert({
          centre_id: centreId,
          lab_order_id: selectedOrder.id,
          test_id: selectedOrder.test_id,
          parameter_name: entry.parameterName,
          result_value: entry.value,
          unit: entry.unit,
          reference_range: refRange,
          is_abnormal: entry.isAbnormal,
          entered_by: staffId,
          entered_at: new Date().toISOString(),
        });
      }
    }

    // Update order status to completed
    await sb()
      .from('hmis_lab_orders')
      .update({ status: 'completed' })
      .eq('id', selectedOrder.id);

    flash('Results saved and order marked as Completed.');
    setSelectedOrder(null);
    loadOrders();
    setSaving(false);
  };

  /* ---------- Verify ---------- */
  const verifyResults = async () => {
    if (!selectedOrder) return;

    // Guard: verifier must differ from the person who entered results
    if (existingEnteredBy && existingEnteredBy === staffId) {
      flash('Verification requires a different user than who entered the results.');
      return;
    }

    setSaving(true);

    await sb()
      .from('hmis_lab_results')
      .update({
        validated_by: staffId,
        validated_at: new Date().toISOString(),
      })
      .eq('lab_order_id', selectedOrder.id);

    await sb()
      .from('hmis_lab_orders')
      .update({
        status: 'verified',
        verified_by: staffId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id);

    flash('Results verified successfully.');
    setSelectedOrder(null);
    loadOrders();
    setSaving(false);
  };

  /* ---------- Render: Status badge ---------- */
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sample_collected: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      verified: 'bg-teal-100 text-teal-800',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  /* ---------- Render ---------- */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical className="h-6 w-6 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Result Entry</h1>
          <p className="text-sm text-gray-500">
            Enter and verify test results for collected samples
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ===== LEFT: Worklist ===== */}
        <div className={`${selectedOrder ? 'w-1/2' : 'w-full'} transition-all`}>
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient, UHID, test, barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'sample_collected', 'processing'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 text-xs rounded-lg border cursor-pointer transition-colors duration-200 ${
                    statusFilter === s
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'sample_collected' ? 'Collected' : 'Processing'}
                </button>
              ))}
            </div>
          </div>

          {/* Orders table */}
          {loading ? (
            <TableSkeleton rows={8} />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border text-gray-400 text-sm">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No pending samples for result entry.</p>
              <p className="text-xs mt-1 text-gray-300">
                Samples with status &quot;collected&quot; or &quot;processing&quot; will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2.5 font-medium text-gray-500">Patient</th>
                    <th className="text-left p-2.5 font-medium text-gray-500">Test</th>
                    <th className="text-left p-2.5 font-medium text-gray-500">Barcode</th>
                    <th className="p-2.5 font-medium text-gray-500">Status</th>
                    <th className="p-2.5 font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      className={`border-b hover:bg-gray-50 transition-colors duration-150 ${
                        selectedOrder?.id === o.id ? 'bg-teal-50' : ''
                      } ${o.priority === 'stat' ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="p-2.5">
                        <div className="font-medium text-gray-900">
                          {o.patient.first_name} {o.patient.last_name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {o.patient.uhid} | {o.patient.age_years}/
                          {o.patient.gender?.charAt(0).toUpperCase()}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium">{o.test_name}</div>
                      </td>
                      <td className="p-2.5 font-mono text-[10px]">
                        {o.sample?.[0]?.barcode || (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">{statusBadge(o.status)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleSelectOrder(o)}
                          className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-[11px] font-medium hover:bg-teal-100 cursor-pointer transition-colors duration-200"
                        >
                          Enter Results
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Result Entry Panel ===== */}
        {selectedOrder && (
          <div className="w-1/2 bg-white rounded-xl border p-5 h-fit sticky top-4">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors duration-200"
                  aria-label="Close result entry panel"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    {selectedOrder.patient.first_name} {selectedOrder.patient.last_name}
                  </h2>
                  <p className="text-[10px] text-gray-400">
                    {selectedOrder.patient.uhid} | {selectedOrder.patient.age_years}/
                    {selectedOrder.patient.gender?.charAt(0).toUpperCase()} |{' '}
                    {selectedOrder.test_name}
                  </p>
                </div>
              </div>
              {statusBadge(selectedOrder.status)}
            </div>

            {/* Barcode info */}
            {selectedOrder.sample?.[0] && (
              <div className="text-[10px] text-gray-400 mb-4 bg-gray-50 rounded-lg px-3 py-1.5">
                Barcode: <span className="font-mono font-medium text-gray-600">{selectedOrder.sample[0].barcode}</span>
                {selectedOrder.sample[0].collected_at && (
                  <span className="ml-2">
                    Collected:{' '}
                    {new Date(selectedOrder.sample[0].collected_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Parameters form */}
            {paramsLoading ? (
              <TableSkeleton rows={4} />
            ) : parameters.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                No test parameters found for this test.
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {resultEntries.map((entry, idx) => {
                    const refText =
                      entry.refMin !== null && entry.refMax !== null
                        ? `${entry.refMin} - ${entry.refMax}`
                        : entry.refMin !== null
                          ? `>= ${entry.refMin}`
                          : entry.refMax !== null
                            ? `<= ${entry.refMax}`
                            : '';

                    const hasValue = entry.value.trim() !== '';
                    const borderColor = !hasValue
                      ? 'border-gray-200'
                      : entry.isAbnormal
                        ? 'border-red-400 ring-1 ring-red-200'
                        : 'border-green-400 ring-1 ring-green-200';
                    const bgColor = !hasValue
                      ? ''
                      : entry.isAbnormal
                        ? 'bg-red-50'
                        : 'bg-green-50';

                    return (
                      <div
                        key={entry.parameterId}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border ${borderColor} ${bgColor} transition-colors duration-200`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 flex items-center gap-1">
                            {entry.parameterName}
                            {hasValue && entry.isAbnormal && (
                              <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            )}
                            {hasValue && !entry.isAbnormal && (
                              <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          {refText && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              Ref: {refText} {entry.unit}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.value}
                            onChange={(e) => updateResultValue(idx, e.target.value)}
                            placeholder="Value"
                            className={`w-24 px-2 py-1.5 border rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                              hasValue && entry.isAbnormal
                                ? 'text-red-700 font-bold'
                                : hasValue
                                  ? 'text-green-700 font-medium'
                                  : 'text-gray-700'
                            }`}
                            aria-label={`Result value for ${entry.parameterName}`}
                          />
                          <span className="text-[10px] text-gray-400 w-12 text-left">
                            {entry.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t">
                  {selectedOrder.status === 'sample_collected' && (
                    <button
                      onClick={startProcessing}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FlaskConical className="h-3.5 w-3.5" />
                      )}
                      Start Processing
                    </button>
                  )}

                  <button
                    onClick={saveAndComplete}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Complete
                  </button>

                  {selectedOrder.status === 'processing' && (
                    <button
                      onClick={verifyResults}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                      title={
                        existingEnteredBy === staffId
                          ? 'Cannot verify own results - requires a different user'
                          : 'Verify and sign off results'
                      }
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Verify
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
