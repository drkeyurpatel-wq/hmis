'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { printBarcodeLabel } from '@/components/lab/barcode-label';
import { HOSPITAL } from '@/lib/config/hospital';
import { TestTube, Printer, Search, RefreshCw, Clock } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LabOrderRow {
  id: string;
  test_name: string;
  test_code: string | null;
  priority: string;
  status: string;
  created_at: string;
  sample_type: string | null;
  patient_id: string;
  patient: {
    first_name: string;
    last_name: string;
    uhid: string;
    age_years: number | null;
    gender: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PRIORITY_ORDER: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };

function priorityBadge(p: string) {
  const cls =
    p === 'stat'
      ? 'bg-red-100 text-red-700 font-bold animate-pulse'
      : p === 'urgent'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${cls}`}>
      {p}
    </span>
  );
}

function generateBarcode(centreCode: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
  return `LAB-${centreCode || 'H1'}-${yy}${mm}${dd}-${seq}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="animate-pulse">
        <div className="h-10 bg-gray-50 border-b" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 border-b last:border-0">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/5" />
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LabCollectPage() {
  const { staff, activeCentreId, centres } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  // Derive centre_code for barcode
  const centreCode = 'H1';

  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  /* ---------- Fetch pending orders ---------- */

  const fetchOrders = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data, error } = await sb()
      .from('hmis_lab_orders')
      .select(
        '*, patient:hmis_patients(first_name, last_name, uhid, age_years, gender)'
      )
      .eq('centre_id', centreId)
      .eq('status', 'ordered')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setOrders(data as unknown as LabOrderRow[]);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ---------- Filter + sort ---------- */

  const filtered = orders
    .filter((o) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = `${o.patient?.first_name || ''} ${o.patient?.last_name || ''}`.toLowerCase();
      const uhid = (o.patient?.uhid || '').toLowerCase();
      return name.includes(q) || uhid.includes(q);
    })
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    );

  /* ---------- Collect sample ---------- */

  const collectSample = async (order: LabOrderRow) => {
    setCollectingId(order.id);
    try {
      const barcode = generateBarcode(centreCode);

      // 1. Insert sample record
      const { error: insertErr } = await sb()
        .from('hmis_lab_samples')
        .insert({
          centre_id: centreId,
          lab_order_id: order.id,
          barcode,
          sample_type: order.sample_type || 'blood',
          collected_by: staffId,
          collected_at: new Date().toISOString(),
          status: 'collected',
        });

      if (insertErr) {
        flash(`Failed to create sample: ${insertErr.code}`);
        setCollectingId(null);
        return;
      }

      // 2. Update order status
      const { error: updateErr } = await sb()
        .from('hmis_lab_orders')
        .update({ status: 'sample_collected' })
        .eq('id', order.id);

      if (updateErr) {
        flash(`Sample created but order update failed: ${updateErr.code}`);
      } else {
        flash(`Sample collected: ${barcode}`);
      }

      // Remove from local list
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch {
      flash('Unexpected error during sample collection');
    }
    setCollectingId(null);
  };

  /* ---------- Print label ---------- */

  const handlePrint = (order: LabOrderRow, barcode?: string) => {
    printBarcodeLabel({
      barcode: barcode || generateBarcode(centreCode),
      patientName: `${order.patient?.first_name || ''} ${order.patient?.last_name || ''}`.trim(),
      uhid: order.patient?.uhid || '',
      age: order.patient?.age_years ?? '',
      gender: order.patient?.gender || '',
      testName: order.test_name,
      testCode: order.test_code || '',
      sampleType: order.sample_type || 'blood',
      collectedAt: new Date().toISOString(),
      priority: order.priority,
    });
  };

  /* ---------- Collect + Print ---------- */

  const collectAndPrint = async (order: LabOrderRow) => {
    setCollectingId(order.id);
    try {
      const barcode = generateBarcode(centreCode);

      const { error: insertErr } = await sb()
        .from('hmis_lab_samples')
        .insert({
          centre_id: centreId,
          lab_order_id: order.id,
          barcode,
          sample_type: order.sample_type || 'blood',
          collected_by: staffId,
          collected_at: new Date().toISOString(),
          status: 'collected',
        });

      if (insertErr) {
        flash(`Failed to create sample: ${insertErr.code}`);
        setCollectingId(null);
        return;
      }

      const { error: updateErr } = await sb()
        .from('hmis_lab_orders')
        .update({ status: 'sample_collected' })
        .eq('id', order.id);

      if (updateErr) {
        flash(`Sample created but order update failed: ${updateErr.code}`);
      } else {
        flash(`Collected and printing: ${barcode}`);
        handlePrint(order, barcode);
      }

      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch {
      flash('Unexpected error during sample collection');
    }
    setCollectingId(null);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <TestTube className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Sample Collection
            </h1>
            <p className="text-sm text-gray-500">
              Collect and label pending lab samples
            </p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 transition-colors duration-200 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient name or UHID..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
        />
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-4">
        <div className="bg-yellow-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            {filtered.length} pending
          </span>
        </div>
        {filtered.filter((o) => o.priority === 'stat').length > 0 && (
          <div className="bg-red-50 rounded-xl px-4 py-2.5">
            <span className="text-sm font-bold text-red-700">
              {filtered.filter((o) => o.priority === 'stat').length} STAT
            </span>
          </div>
        )}
        {filtered.filter((o) => o.priority === 'urgent').length > 0 && (
          <div className="bg-orange-50 rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium text-orange-700">
              {filtered.filter((o) => o.priority === 'urgent').length} Urgent
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <TestTube className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium mb-1">
            {search
              ? 'No matching orders found'
              : 'No pending samples to collect'}
          </p>
          <p className="text-gray-400 text-xs">
            {search
              ? 'Try a different search term or clear the filter'
              : 'New lab orders will appear here when clinicians place them'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-500 text-xs">
                  Patient
                </th>
                <th className="text-left p-3 font-medium text-gray-500 text-xs">
                  Test
                </th>
                <th className="p-3 font-medium text-gray-500 text-xs text-center">
                  Priority
                </th>
                <th className="text-left p-3 font-medium text-gray-500 text-xs">
                  Ordered
                </th>
                <th className="p-3 font-medium text-gray-500 text-xs text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const isCollecting = collectingId === order.id;
                const patientName =
                  `${order.patient?.first_name || ''} ${order.patient?.last_name || ''}`.trim() ||
                  'Unknown';
                const demo = [
                  order.patient?.age_years != null
                    ? `${order.patient.age_years}y`
                    : null,
                  order.patient?.gender
                    ? order.patient.gender.charAt(0).toUpperCase()
                    : null,
                ]
                  .filter(Boolean)
                  .join('/');

                return (
                  <tr
                    key={order.id}
                    className={`border-b last:border-0 hover:bg-gray-50 transition-colors duration-150 ${
                      order.priority === 'stat' ? 'bg-red-50/30' : ''
                    }`}
                  >
                    {/* Patient */}
                    <td className="p-3">
                      <div className="font-medium text-gray-900">
                        {patientName}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {order.patient?.uhid || 'No UHID'}
                        {demo ? ` | ${demo}` : ''}
                      </div>
                    </td>

                    {/* Test */}
                    <td className="p-3">
                      <div className="font-medium text-gray-900">
                        {order.test_name}
                      </div>
                      {order.test_code && (
                        <div className="text-[11px] text-gray-400">
                          {order.test_code}
                        </div>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="p-3 text-center">
                      {priorityBadge(order.priority)}
                    </td>

                    {/* Ordered time */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs">
                          {timeAgo(order.created_at)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => collectSample(order)}
                          disabled={isCollecting}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCollecting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <TestTube className="h-3.5 w-3.5" />
                          )}
                          Collect
                        </button>
                        <button
                          onClick={() => collectAndPrint(order)}
                          disabled={isCollecting}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Collect sample and print barcode label"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Collect + Print
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Barcode format: LAB-{centreCode}-YYMMDD-NNNN | Label size: 50 x 25 mm
      </div>
    </div>
  );
}
