'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  TestTube, Search, CheckCircle, XCircle, RefreshCw,
  Package, AlertTriangle, ScanLine,
} from 'lucide-react';
import type { LabCollection } from '@/types/database';

export default function SampleReceivingPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [batchSearch, setBatchSearch] = useState('');
  const [samples, setSamples] = useState<LabCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingSamples, setPendingSamples] = useState<LabCollection[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Load pending samples (dispatched to this hub)
  const loadPending = useCallback(async () => {
    if (!centreId) return;
    setLoadingPending(true);
    const client = sb();
    const { data } = await client
      .from('hmis_lab_collections')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), centre:hmis_centres!centre_id(name, code)')
      .eq('hub_centre_id', centreId)
      .in('status', ['dispatched', 'in_transit'])
      .order('dispatched_at', { ascending: true })
      .limit(100);
    setPendingSamples((data as any) || []);
    setLoadingPending(false);
  }, [centreId]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // Search by batch
  const searchBatch = async () => {
    if (!batchSearch) return;
    setLoading(true);
    const client = sb();
    const { data } = await client
      .from('hmis_lab_collections')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), centre:hmis_centres!centre_id(name, code)')
      .eq('hub_centre_id', centreId)
      .eq('courier_batch_id', batchSearch)
      .order('created_at', { ascending: true });
    setSamples((data as any) || []);
    setLoading(false);
  };

  const handleAccept = async (sampleId: string) => {
    setProcessing(sampleId);
    const client = sb();
    await client.from('hmis_lab_collections').update({
      status: 'received_at_hub',
      received_at_hub: new Date().toISOString(),
      received_by: staff?.id,
    }).eq('id', sampleId);

    setSamples(samples.map(s => s.id === sampleId ? { ...s, status: 'received_at_hub' as const } : s));
    setPendingSamples(pendingSamples.filter(s => s.id !== sampleId));
    setProcessing(null);
  };

  const handleReject = async (sampleId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    setProcessing(sampleId);
    const client = sb();
    await client.from('hmis_lab_collections').update({
      status: 'rejected',
      rejection_reason: reason,
      received_at_hub: new Date().toISOString(),
      received_by: staff?.id,
    }).eq('id', sampleId);

    setSamples(samples.map(s => s.id === sampleId ? { ...s, status: 'rejected' as const } : s));
    setPendingSamples(pendingSamples.filter(s => s.id !== sampleId));
    setProcessing(null);
  };

  const handleAcceptAll = async () => {
    const toAccept = samples.filter(s => s.status === 'dispatched' || s.status === 'in_transit');
    for (const sample of toAccept) {
      await handleAccept(sample.id);
    }
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lab Sample Receiving</h1>
          <p className="text-sm text-gray-500">Receive and verify samples from spoke clinics</p>
        </div>
        <button onClick={loadPending} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
          <RefreshCw size={16} className={loadingPending ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* Batch scan */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-3">Scan Batch</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchBatch()}
              placeholder="Scan or enter batch ID (e.g., BATCH-260403-001)..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button onClick={searchBatch}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors cursor-pointer">
            Load Batch
          </button>
        </div>

        {/* Batch results */}
        {samples.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                Batch: {batchSearch} — {samples.length} samples
              </span>
              <button onClick={handleAcceptAll}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer">
                <CheckCircle size={12} className="inline mr-1" />
                Accept All & Create Lab Orders
              </button>
            </div>
            <div className="divide-y divide-gray-100 border rounded-lg">
              {samples.map((sample) => (
                <SampleRow
                  key={sample.id}
                  sample={sample}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  processing={processing === sample.id}
                />
              ))}
            </div>
          </div>
        )}
        {loading && (
          <div className="mt-4 text-center py-4">
            <RefreshCw className="animate-spin text-gray-300 mx-auto" size={20} />
          </div>
        )}
      </div>

      {/* Pending samples (not batch-scanned) */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">
            Incoming Samples ({pendingSamples.length})
          </h2>
        </div>

        {loadingPending ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin text-gray-300 mx-auto" size={20} />
          </div>
        ) : pendingSamples.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No pending samples to receive</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingSamples.map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                onAccept={handleAccept}
                onReject={handleReject}
                processing={processing === sample.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SampleRow({ sample, onAccept, onReject, processing }: {
  sample: LabCollection;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  processing: boolean;
}) {
  const isReceived = sample.status === 'received_at_hub';
  const isRejected = sample.status === 'rejected';
  const isActionable = !isReceived && !isRejected;

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${isReceived || isRejected ? 'opacity-60' : ''}`}>
      <TestTube size={16} className={isRejected ? 'text-red-500' : isReceived ? 'text-green-500' : 'text-blue-500'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            {(sample.patient as any)?.first_name} {(sample.patient as any)?.last_name}
          </span>
          <span className="text-xs text-gray-400 font-mono">{(sample.patient as any)?.uhid}</span>
          <span className="text-[10px] text-gray-400">from {(sample.centre as any)?.name || 'Clinic'}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {sample.sample_type} &middot; {(sample.tests_ordered as any[])?.join(', ')}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {sample.collection_number} {sample.courier_batch_id ? `| ${sample.courier_batch_id}` : ''}
        </div>
      </div>

      {isReceived && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Received</span>
      )}
      {isRejected && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>
      )}

      {isActionable && (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => onAccept(sample.id)} disabled={processing}
            className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer">
            {processing ? '...' : 'Accept'}
          </button>
          <button onClick={() => onReject(sample.id)} disabled={processing}
            className="px-2.5 py-1.5 bg-white text-red-500 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
