'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  TestTube, Search, Plus, Package, Truck, CheckCircle,
  XCircle, Clock, RefreshCw, Filter, Printer, AlertTriangle,
} from 'lucide-react';
import type { LabCollection, LabCollectionStatus } from '@/types/database';

const STATUS_CONFIG: Record<LabCollectionStatus, { label: string; color: string }> = {
  collected: { label: 'Collected', color: 'bg-blue-100 text-blue-700' },
  batched: { label: 'Batched', color: 'bg-indigo-100 text-indigo-700' },
  dispatched: { label: 'Dispatched', color: 'bg-amber-100 text-amber-700' },
  in_transit: { label: 'In Transit', color: 'bg-orange-100 text-orange-700' },
  received_at_hub: { label: 'Received at Hub', color: 'bg-teal-100 text-teal-700' },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const SAMPLE_TYPES = ['blood', 'urine', 'stool', 'swab', 'sputum'];

type Tab = 'collect' | 'batch' | 'tracking';

export default function LabCollectionPage() {
  const { staff, activeCentreId, hubCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [activeTab, setActiveTab] = useState<Tab>('collect');
  const [collections, setCollections] = useState<LabCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // --- Collection form state ---
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [sampleType, setSampleType] = useState('blood');
  const [fastingStatus, setFastingStatus] = useState('unknown');
  const [testsOrdered, setTestsOrdered] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCollections = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const client = sb();
    let query = client
      .from('hmis_lab_collections')
      .select('*, patient:hmis_patients(first_name, last_name, uhid)')
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data } = await query;
    setCollections((data as any) || []);
    setLoading(false);
  }, [centreId, statusFilter]);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const timeout = setTimeout(async () => {
      const client = sb();
      const { data } = await client
        .from('hmis_patients')
        .select('id, first_name, last_name, uhid, phone_primary')
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,uhid.ilike.%${patientSearch}%,phone_primary.ilike.%${patientSearch}%`)
        .limit(8);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  const generateCollectionNumber = () => {
    const d = new Date();
    const dateStr = d.toISOString().slice(2, 10).replace(/-/g, '');
    const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `COL-${dateStr}-${seq}`;
  };

  const handleCollect = async () => {
    if (!selectedPatient || !hubCentreId) return;
    setSaving(true);
    const client = sb();
    const collectionNumber = generateCollectionNumber();
    const tests = testsOrdered.split(',').map(t => t.trim()).filter(Boolean);

    const { error } = await client.from('hmis_lab_collections').insert({
      centre_id: centreId,
      hub_centre_id: hubCentreId,
      patient_id: selectedPatient.id,
      collection_number: collectionNumber,
      barcode: collectionNumber,
      sample_type: sampleType,
      tests_ordered: tests,
      fasting_status: fastingStatus,
      collected_by: staff?.id,
      collected_at: new Date().toISOString(),
      status: 'collected',
      notes: notes || null,
    });

    if (!error) {
      setSelectedPatient(null);
      setPatientSearch('');
      setTestsOrdered('');
      setNotes('');
      loadCollections();
    }
    setSaving(false);
  };

  const handleBatchDispatch = async () => {
    const client = sb();
    const batchId = `BATCH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
    const collectedIds = collections.filter(c => c.status === 'collected').map(c => c.id);
    if (collectedIds.length === 0) return;

    for (const id of collectedIds) {
      await client.from('hmis_lab_collections').update({
        status: 'dispatched',
        courier_batch_id: batchId,
        dispatched_at: new Date().toISOString(),
        dispatched_by: staff?.id,
      }).eq('id', id);
    }
    loadCollections();
  };

  const collectedCount = collections.filter(c => c.status === 'collected').length;

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lab Collection</h1>
          <p className="text-sm text-gray-500">Collect samples, batch, and dispatch to hub lab</p>
        </div>
        <button onClick={loadCollections} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
          <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'collect' as Tab, label: 'Collect Sample', icon: Plus },
          { key: 'batch' as Tab, label: `Batch & Dispatch (${collectedCount})`, icon: Package },
          { key: 'tracking' as Tab, label: 'Tracking', icon: Truck },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collect Tab */}
      {activeTab === 'collect' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-800">New Sample Collection</h2>

          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center gap-3 px-3 py-2 bg-teal-50 rounded-lg border border-teal-200">
                <span className="text-sm font-medium text-gray-800">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </span>
                <span className="text-xs text-gray-500 font-mono">{selectedPatient.uhid}</span>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                  className="ml-auto text-gray-400 hover:text-red-500 cursor-pointer">
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name, UHID, or phone..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {patientResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {patientResults.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0 cursor-pointer">
                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                        <span className="text-gray-400 ml-2 font-mono text-xs">{p.uhid}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Sample Type *</label>
              <select value={sampleType} onChange={(e) => setSampleType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fasting Status</label>
              <select value={fastingStatus} onChange={(e) => setFastingStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="unknown">Unknown</option>
                <option value="fasting">Fasting</option>
                <option value="non_fasting">Non-Fasting</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tests Ordered * (comma-separated)</label>
            <input
              type="text"
              value={testsOrdered}
              onChange={(e) => setTestsOrdered(e.target.value)}
              placeholder="CBC, LFT, KFT, Thyroid Profile..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <button
            onClick={handleCollect}
            disabled={!selectedPatient || !testsOrdered || saving || !hubCentreId}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
            {saving ? 'Saving...' : 'Collect Sample & Print Label'}
          </button>

          {!hubCentreId && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} />
              No hub centre configured for this clinic. Contact admin.
            </p>
          )}
        </div>
      )}

      {/* Batch & Dispatch Tab */}
      {activeTab === 'batch' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">
              Pending Samples ({collectedCount})
            </h2>
            {collectedCount > 0 && (
              <button onClick={handleBatchDispatch}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer">
                <Truck size={14} className="inline mr-1.5" />
                Close Batch & Dispatch ({collectedCount})
              </button>
            )}
          </div>

          {collections.filter(c => c.status === 'collected').length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No pending samples to batch</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {collections.filter(c => c.status === 'collected').map((col) => (
                <div key={col.id} className="py-3 flex items-center gap-3">
                  <TestTube size={16} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">
                      {(col.patient as any)?.first_name} {(col.patient as any)?.last_name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{(col.patient as any)?.uhid}</span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {col.sample_type} &middot; {(col.tests_ordered as any[])?.join(', ')}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{col.collection_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tracking Tab */}
      {activeTab === 'tracking' && (
        <div className="space-y-3">
          {/* Status filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
              }`}>All</button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === key ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
                }`}>{cfg.label}</button>
            ))}
          </div>

          {/* Collection list */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} />
            </div>
          ) : collections.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <TestTube size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No samples found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {collections.map((col) => {
                const statusCfg = STATUS_CONFIG[col.status];
                return (
                  <div key={col.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <TestTube size={16} className="text-purple-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {(col.patient as any)?.first_name} {(col.patient as any)?.last_name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">{(col.patient as any)?.uhid}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {col.sample_type} &middot; {(col.tests_ordered as any[])?.join(', ')}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {col.collection_number} {col.courier_batch_id ? `| Batch: ${col.courier_batch_id}` : ''}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
