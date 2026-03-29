// components/lab/microbiology-panel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useCulture, useOrganismMaster } from '@/lib/lab/micro-hooks';
import type { LabOrder } from '@/lib/lab/lims-hooks';

interface Props {
  orders: LabOrder[];
  staffId: string;
  onFlash: (m: string) => void;
}

const SIR_COLORS: Record<string, string> = {
  S: 'bg-green-100 text-green-800 border-green-300',
  I: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  R: 'bg-red-100 text-red-800 border-red-300',
  SDD: 'bg-orange-100 text-orange-800 border-orange-300',
  NS: 'bg-gray-100 text-gray-600 border-gray-300',
};

export default function MicrobiologyPanel({ orders, staffId, onFlash }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const culture = useCulture(selectedOrder?.id || null);
  const { organisms, antibiotics, getPanelForOrganism } = useOrganismMaster();

  // Form states
  const [gramResult, setGramResult] = useState('');
  const [addOrgId, setAddOrgId] = useState('');
  const [addOrgQty, setAddOrgQty] = useState('moderate');
  const [sensResults, setSensResults] = useState<Record<string, Record<string, string>>>({});
  const [finalReport, setFinalReport] = useState('');
  const [specimenType, setSpecimenType] = useState('blood');

  // Filter culture orders
  const microOrders = orders.filter(o => o.category === 'Culture' || o.testCode?.includes('CS') || o.testName?.toLowerCase().includes('culture'));

  // Load panel antibiotics when isolate selected
  const getAbxForIsolate = (isolate: any) => {
    const orgType = isolate.organism?.organism_type || 'bacteria_gn';
    const panel = getPanelForOrganism(orgType);
    const panelAbxIds = panel.map((p: any) => p.antibiotic?.id).filter(Boolean);
    if (panelAbxIds.length > 0) return antibiotics.filter(a => panelAbxIds.includes(a.id));
    return antibiotics.slice(0, 15);
  };

  const handleInitCulture = async () => {
    if (!selectedOrder) return;
    await culture.initCulture(specimenType, selectedOrder.testName);
    onFlash('Culture initiated');
  };

  const handleAddIsolate = async () => {
    if (!addOrgId) return;
    await culture.addIsolate(addOrgId, addOrgQty);
    setAddOrgId(''); setAddOrgQty('moderate');
    onFlash('Organism added');
  };

  const handleSaveSensitivity = async (isolateId: string) => {
    const results = sensResults[isolateId];
    if (!results) return;
    const entries = Object.entries(results).filter(([_, v]) => v).map(([abxId, interp]) => ({
      antibioticId: abxId, interpretation: interp,
    }));
    await culture.saveSensitivities(isolateId, entries);
    onFlash('Sensitivity saved');
  };

  const updateSens = (isolateId: string, abxId: string, value: string) => {
    setSensResults(prev => ({
      ...prev,
      [isolateId]: { ...(prev[isolateId] || {}), [abxId]: value },
    }));
  };

  // Pre-fill existing sensitivity data
  useEffect(() => {
    const map: Record<string, Record<string, string>> = {};
    culture.isolates.forEach((iso: any) => {
      map[iso.id] = {};
      (iso.sensitivities || []).forEach((s: any) => {
        map[iso.id][s.antibiotic_id] = s.interpretation;
      });
    });
    setSensResults(map);
  }, [culture.isolates]);

  return (
    <div className="flex gap-4">
      {/* Order list */}
      <div className="w-1/4 space-y-1.5">
        <h3 className="text-xs font-medium text-gray-500 mb-2">Culture Orders ({microOrders.length})</h3>
        {microOrders.length === 0 ? <div className="text-xs text-gray-400 text-center py-4">No culture orders</div> :
        microOrders.map(o => (
          <button key={o.id} onClick={() => setSelectedOrder(o)}
            className={`w-full text-left p-2 rounded-lg border text-xs ${selectedOrder?.id === o.id ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`}>
            <div className="font-medium">{o.patientName}</div>
            <div className="text-[10px] text-gray-400">{o.testName}</div>
            <span className={`text-[10px] px-1 py-0.5 rounded ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.status}</span>
          </button>
        ))}
      </div>

      {/* Culture workspace */}
      <div className="flex-1">
        {!selectedOrder ? (
          <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select a culture order from the left</div>
        ) : culture.loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : !culture.culture ? (
          /* Init culture */
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-3">Initiate Culture — {selectedOrder.testName}</h3>
            <div className="text-xs text-gray-500 mb-3">{selectedOrder.patientName} | {selectedOrder.patientUhid}</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-gray-500">Specimen type</label>
                <select value={specimenType} onChange={e => setSpecimenType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {['blood','urine','sputum','wound_swab','csf','stool','fluid','tissue','catheter_tip','tracheal_aspirate'].map(t =>
                    <option key={t}>{t.replace('_',' ')}</option>)}</select></div>
            </div>
            <button onClick={handleInitCulture} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg">Start Incubation</button>
          </div>
        ) : (
          /* Culture workspace */
          <div className="space-y-4">
            {/* Status header */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{selectedOrder.testName} — {selectedOrder.patientName}</h3>
                <span className={`px-2 py-0.5 rounded text-xs ${culture.culture.culture_status === 'no_growth' ? 'bg-green-100 text-green-700' : culture.culture.culture_status === 'growth' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {culture.culture.culture_status.replace('_',' ')}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Specimen: {culture.culture.specimen_type} | Started: {new Date(culture.culture.incubation_start || culture.culture.created_at).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Gram stain */}
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-sm font-medium mb-2">Gram Stain</h4>
              {culture.culture.gram_stain_done ? (
                <div className="text-sm"><span className="text-green-600 font-medium">Done:</span> {culture.culture.gram_stain_result}</div>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><textarea value={gramResult} onChange={e => setGramResult(e.target.value)} rows={2}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Gram positive cocci in clusters seen. Pus cells 20-25/HPF." /></div>
                  <button onClick={async () => { await culture.updateCulture({ gram_stain_done: true, gram_stain_result: gramResult }); onFlash('Gram stain saved'); }}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg whitespace-nowrap">Save Gram</button>
                </div>
              )}
            </div>

            {/* No growth / Add organism */}
            {culture.culture.culture_status !== 'no_growth' && (
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Isolates ({culture.isolates.length})</h4>
                  <button onClick={() => culture.reportNoGrowth(staffId)} className="px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg hover:bg-green-100">Report No Growth (48h)</button>
                </div>
                <div className="flex gap-2 items-end mb-3">
                  <div className="flex-1"><label className="text-[10px] text-gray-500">Organism</label>
                    <select value={addOrgId} onChange={e => setAddOrgId(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm">
                      <option value="">Select organism...</option>
                      {organisms.map(o => <option key={o.id} value={o.id}>{o.organism_name} {o.is_alert_organism ? '!' : ''}</option>)}
                    </select></div>
                  <div className="w-28"><label className="text-[10px] text-gray-500">Growth</label>
                    <select value={addOrgQty} onChange={e => setAddOrgQty(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm">
                      {['few','moderate','heavy','very_heavy'].map(q => <option key={q}>{q.replace('_',' ')}</option>)}
                    </select></div>
                  <button onClick={handleAddIsolate} disabled={!addOrgId} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg disabled:opacity-50">Add</button>
                </div>
              </div>
            )}

            {/* Sensitivity for each isolate */}
            {culture.isolates.map((iso: any) => {
              const abxList = getAbxForIsolate(iso);
              const currentSens = sensResults[iso.id] || {};
              return (
                <div key={iso.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Isolate #{iso.isolate_number}: {iso.organism?.organism_name}</span>
                      {iso.organism?.is_alert_organism && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">ALERT ORGANISM</span>}
                      <span className="text-xs text-gray-400">{iso.quantity?.replace('_',' ')} growth</span>
                    </div>
                    <button onClick={() => handleSaveSensitivity(iso.id)} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg">Save Sensitivity</button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 border-b">
                        <th className="text-left p-2 font-medium text-gray-500 w-1/3">Antibiotic</th>
                        <th className="p-2 font-medium text-gray-500">Class</th>
                        <th className="p-2 font-medium text-gray-500 w-40">S / I / R</th>
                        <th className="p-2 font-medium text-gray-500">Zone (mm)</th>
                      </tr></thead>
                      <tbody>{abxList.map((abx: any) => {
                        const val = currentSens[abx.id] || '';
                        return (
                          <tr key={abx.id} className={`border-b ${val === 'R' ? 'bg-red-50' : val === 'S' ? 'bg-green-50/50' : ''}`}>
                            <td className="p-2">
                              <span className="font-medium">{abx.antibiotic_name}</span>
                              {abx.is_restricted && <span className="ml-1 text-[10px] text-orange-600">R</span>}
                            </td>
                            <td className="p-2 text-center text-gray-400 text-[10px]">{abx.antibiotic_class}</td>
                            <td className="p-2">
                              <div className="flex gap-1 justify-center">
                                {['S','I','R'].map(v => (
                                  <button key={v} onClick={() => updateSens(iso.id, abx.id, val === v ? '' : v)}
                                    className={`w-8 h-7 rounded border text-xs font-bold ${val === v ? SIR_COLORS[v] : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}>{v}</button>
                                ))}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <input type="number" className="w-12 px-1 py-0.5 border rounded text-center text-[10px]" placeholder="—" min="0" />
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Final report */}
            {culture.isolates.length > 0 && !culture.culture.reported_at && (
              <div className="bg-white rounded-xl border p-4">
                <h4 className="text-sm font-medium mb-2">Final Report</h4>
                <textarea value={finalReport} onChange={e => setFinalReport(e.target.value)} rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm mb-2" placeholder="Culture of blood grew Staphylococcus aureus (MRSA) — heavy growth. Sensitivity pattern as above." />
                <div className="flex gap-2">
                  <button onClick={async () => { await culture.finalizeCulture(finalReport, staffId); onFlash('Culture reported'); }}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Finalize & Report</button>
                  <button onClick={async () => { await culture.verifyCulture(staffId); onFlash('Culture verified'); }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Verify</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
