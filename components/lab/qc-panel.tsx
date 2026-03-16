// components/lab/qc-panel.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQCLots, useQCResults, type WestgardResult } from '@/lib/lab/qc-hooks';

declare global { interface Window { Chart: any; } }

interface Props { centreId: string; staffId: string; onFlash: (m: string) => void; }

export default function QCPanel({ centreId, staffId, onFlash }: Props) {
  const lots = useQCLots(centreId);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const qcResults = useQCResults(selectedLotId);
  const [qcValue, setQcValue] = useState('');
  const [lastWestgard, setLastWestgard] = useState<WestgardResult | null>(null);
  const [showAddLot, setShowAddLot] = useState(false);
  const [lotForm, setLotForm] = useState({ lotNumber: '', materialName: '', manufacturer: '', testId: '', parameterId: '', level: 'L1', targetMean: '', targetSd: '', unit: '', expiryDate: '' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  // Levey-Jennings chart
  useEffect(() => {
    if (!canvasRef.current || !qcResults.lot) return;
    const lj = qcResults.getLJData();
    if (!lj || lj.points.length === 0) return;

    const loadChart = () => {
      if (typeof window !== 'undefined' && window.Chart) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    };

    loadChart().then(() => {
      if (chartRef.current) chartRef.current.destroy();
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;

      const labels = lj.points.map(p => `${p.date} R${p.run}`);
      chartRef.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'QC Value', data: lj.points.map(p => p.value), borderColor: lj.points.map(p => !p.accepted ? '#dc2626' : p.violation ? '#f59e0b' : '#3b82f6'), backgroundColor: lj.points.map(p => !p.accepted ? '#dc2626' : p.violation ? '#f59e0b' : '#3b82f6'), pointRadius: 5, pointStyle: lj.points.map(p => !p.accepted ? 'crossRot' : 'circle'), borderWidth: 2, tension: 0, segment: { borderColor: '#3b82f6' } },
            { label: '+3SD', data: labels.map(() => lj.plus3), borderColor: '#dc262680', borderDash: [5,5], borderWidth: 1, pointRadius: 0 },
            { label: '+2SD', data: labels.map(() => lj.plus2), borderColor: '#f59e0b80', borderDash: [3,3], borderWidth: 1, pointRadius: 0 },
            { label: '+1SD', data: labels.map(() => lj.plus1), borderColor: '#10b98180', borderDash: [2,2], borderWidth: 1, pointRadius: 0 },
            { label: 'Mean', data: labels.map(() => lj.mean), borderColor: '#10b981', borderWidth: 2, pointRadius: 0 },
            { label: '-1SD', data: labels.map(() => lj.minus1), borderColor: '#10b98180', borderDash: [2,2], borderWidth: 1, pointRadius: 0 },
            { label: '-2SD', data: labels.map(() => lj.minus2), borderColor: '#f59e0b80', borderDash: [3,3], borderWidth: 1, pointRadius: 0 },
            { label: '-3SD', data: labels.map(() => lj.minus3), borderColor: '#dc262680', borderDash: [5,5], borderWidth: 1, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: lj.minus3 - lj.sd, max: lj.plus3 + lj.sd, title: { display: true, text: qcResults.lot?.unit || '' } }, x: { title: { display: true, text: 'Run Date' } } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => { const p = lj.points[ctx.dataIndex]; return p ? `${p.value} (${p.sd?.toFixed(1)}SD) ${p.violation || ''}` : ctx.formattedValue; } } } },
        },
      });
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [qcResults.results, qcResults.lot]);

  const handleRunQC = async () => {
    if (!qcValue || !selectedLotId) return;
    const result = await qcResults.addResult(parseFloat(qcValue), staffId);
    if (result?.westgard) {
      setLastWestgard(result.westgard);
      if (result.westgard.isRejection) onFlash(`WESTGARD VIOLATION: ${result.westgard.violation} — QC REJECTED`);
      else if (result.westgard.isWarning) onFlash(`Westgard warning: ${result.westgard.violation}`);
      else onFlash('QC accepted');
    }
    setQcValue('');
  };

  const handleAddLot = async () => {
    if (!lotForm.lotNumber || !lotForm.testId || !lotForm.targetMean || !lotForm.targetSd || !lotForm.expiryDate) return;
    await lots.addLot({ ...lotForm, targetMean: parseFloat(lotForm.targetMean), targetSd: parseFloat(lotForm.targetSd) });
    setShowAddLot(false);
    setLotForm({ lotNumber: '', materialName: '', manufacturer: '', testId: '', parameterId: '', level: 'L1', targetMean: '', targetSd: '', unit: '', expiryDate: '' });
    onFlash('QC lot added');
  };

  const violationColor = (v: string | null) => !v ? '' : v === '1_2s' || v === '7T' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="space-y-4">
      {/* Lot selector + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={selectedLotId || ''} onChange={e => setSelectedLotId(e.target.value || null)} className="px-3 py-2 border rounded-lg text-sm min-w-[300px]">
            <option value="">Select QC lot...</option>
            {lots.lots.map(l => (
              <option key={l.id} value={l.id}>
                {l.test?.test_name} — {l.level} — Lot# {l.lot_number} ({l.material_name})
              </option>
            ))}
          </select>
          {selectedLotId && qcResults.lot && (
            <div className="text-xs text-gray-500">
              Mean: {qcResults.lot.target_mean} | SD: {qcResults.lot.target_sd} | Unit: {qcResults.lot.unit || '—'} | Exp: {qcResults.lot.expiry_date}
              {new Date(qcResults.lot.expiry_date) < new Date() && <span className="text-red-600 font-bold ml-1">EXPIRED</span>}
            </div>
          )}
        </div>
        <button onClick={() => setShowAddLot(!showAddLot)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showAddLot ? 'Cancel' : '+ New Lot'}</button>
      </div>

      {/* Add lot form */}
      {showAddLot && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-sm">Add QC Control Lot</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Lot number *</label>
              <input type="text" value={lotForm.lotNumber} onChange={e => setLotForm(f => ({...f, lotNumber: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Material name *</label>
              <input type="text" value={lotForm.materialName} onChange={e => setLotForm(f => ({...f, materialName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Bio-Rad Liquichek" /></div>
            <div><label className="text-xs text-gray-500">Manufacturer</label>
              <input type="text" value={lotForm.manufacturer} onChange={e => setLotForm(f => ({...f, manufacturer: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Test *</label>
              <select value={lotForm.testId} onChange={e => setLotForm(f => ({...f, testId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>
                {[...new Map(lots.lots.map(l => [l.test?.test_code, l.test])).values()].filter(Boolean).map(t =>
                  <option key={t.test_code} value={t.id}>{t.test_name}</option>
                )}
              </select></div>
            <div><label className="text-xs text-gray-500">Level *</label>
              <select value={lotForm.level} onChange={e => setLotForm(f => ({...f, level: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['L1','L2','L3','normal','abnormal'].map(l => <option key={l}>{l}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-500">Target Mean *</label>
              <input type="number" step="any" value={lotForm.targetMean} onChange={e => setLotForm(f => ({...f, targetMean: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Target SD *</label>
              <input type="number" step="any" value={lotForm.targetSd} onChange={e => setLotForm(f => ({...f, targetSd: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Unit</label>
              <input type="text" value={lotForm.unit} onChange={e => setLotForm(f => ({...f, unit: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Expiry date *</label>
              <input type="date" value={lotForm.expiryDate} onChange={e => setLotForm(f => ({...f, expiryDate: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <button onClick={handleAddLot} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Lot</button>
        </div>
      )}

      {selectedLotId && (
        <>
          {/* QC value entry */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-medium whitespace-nowrap">Run QC</h4>
              <input type="number" step="any" value={qcValue} onChange={e => setQcValue(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm w-40" placeholder="Measured value" />
              <button onClick={handleRunQC} disabled={!qcValue} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-50">Record</button>
              {lastWestgard && (
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${lastWestgard.isRejection ? 'bg-red-100 text-red-700' : lastWestgard.isWarning ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  {lastWestgard.isRejection ? `REJECTED: ${lastWestgard.violation}` : lastWestgard.isWarning ? `WARNING: ${lastWestgard.violation}` : 'ACCEPTED'}
                  {' '}({lastWestgard.sdFromMean >= 0 ? '+' : ''}{lastWestgard.sdFromMean.toFixed(1)} SD)
                </div>
              )}
            </div>
          </div>

          {/* Levey-Jennings Chart */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Levey-Jennings Chart</h4>
              <div className="flex gap-1 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block"></span> Mean</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block border-dashed"></span> ±2SD</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block border-dashed"></span> ±3SD</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span> Rejected</span>
              </div>
            </div>
            <div className="h-64">
              {qcResults.results.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No QC data yet. Record a value above.</div>
              ) : (
                <canvas ref={canvasRef} />
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Date</th><th className="p-2">Run</th><th className="p-2">Value</th>
                <th className="p-2">SD from Mean</th><th className="p-2">Westgard</th><th className="p-2">Status</th>
                <th className="p-2 text-left">By</th>
              </tr></thead>
              <tbody>{[...qcResults.results].reverse().map((r: any) => (
                <tr key={r.id} className={`border-b ${violationColor(r.westgard_violation)}`}>
                  <td className="p-2">{r.run_date}</td>
                  <td className="p-2 text-center">R{r.run_number}</td>
                  <td className="p-2 text-center font-medium">{parseFloat(r.measured_value).toFixed(1)}</td>
                  <td className="p-2 text-center">{parseFloat(r.sd_from_mean).toFixed(2)} SD</td>
                  <td className="p-2 text-center">{r.westgard_violation ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.is_accepted ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.westgard_violation}</span> : '—'}</td>
                  <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${r.is_accepted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.is_accepted ? 'Accepted' : 'Rejected'}</span></td>
                  <td className="p-2">{r.performer?.full_name || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {/* Westgard Rules Reference */}
          <div className="bg-gray-50 rounded-xl border p-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Westgard Rules Reference</h4>
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="bg-yellow-50 p-2 rounded"><span className="font-bold">1-2s</span> Warning: 1 point beyond ±2SD</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">1-3s</span> Reject: 1 point beyond ±3SD</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">2-2s</span> Reject: 2 consecutive beyond same ±2SD</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">R-4s</span> Reject: 1 at +2SD, 1 at -2SD</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">4-1s</span> Reject: 4 consecutive beyond same ±1SD</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">10x</span> Reject: 10 consecutive same side of mean</div>
              <div className="bg-yellow-50 p-2 rounded"><span className="font-bold">7T</span> Warning: 7 consecutive trending same direction</div>
              <div className="bg-red-50 p-2 rounded"><span className="font-bold">2of3-2s</span> Reject: 2 of 3 consecutive beyond ±2SD</div>
            </div>
          </div>
        </>
      )}

      {!selectedLotId && !showAddLot && (
        <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select a QC lot above or add a new one to start quality control monitoring.</div>
      )}
    </div>
  );
}
