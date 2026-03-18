// components/billing/barcode-scanner.tsx
// Scan patient wristband barcode → lookup → add charges to bill
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useBarcodeScanner, useChargeCapture } from '@/lib/billing/charge-capture-hooks';
import { useTariffs } from '@/lib/billing/billing-hooks';
import { useAuthStore } from '@/lib/store/auth';

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual Entry', consumable: 'Consumable', procedure: 'Procedure',
  barcode_scan: 'Barcode Scan', pharmacy: 'Pharmacy', lab: 'Lab', radiology: 'Radiology',
};

interface Props { centreId: string; onFlash: (msg: string) => void; }

export default function BarcodeScanner({ centreId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const scanner = useBarcodeScanner();
  const capture = useChargeCapture(centreId);
  const tariffs = useTariffs(centreId);

  const [manualCode, setManualCode] = useState('');
  const [chargeForm, setChargeForm] = useState({ description: '', category: 'consumable', quantity: 1, unitRate: 0, notes: '' });
  const [tariffSearch, setTariffSearch] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const tariffResults = tariffSearch.length >= 2 ? tariffs.search(tariffSearch).slice(0, 6) : [];

  // Auto-focus manual input when scanning starts
  useEffect(() => { if (scanner.scanning && inputRef.current) inputRef.current.focus(); }, [scanner.scanning]);

  const addCharge = async () => {
    if (!scanner.result) return;
    if (!chargeForm.description) { setError('Description required'); return; }
    if (chargeForm.unitRate <= 0) { setError('Rate must be > 0'); return; }
    setError('');

    const result = await capture.postCharge({
      patientId: scanner.result.patientId,
      admissionId: scanner.result.admissionId,
      description: chargeForm.description, category: chargeForm.category,
      quantity: chargeForm.quantity, unitRate: chargeForm.unitRate,
      source: 'barcode_scan', staffId,
      notes: chargeForm.notes || `Scanned: ${scanner.result.uhid}`,
    });

    if (!result.success) { setError(result.error || 'Failed'); return; }
    onFlash(`₹${(chargeForm.quantity * chargeForm.unitRate).toLocaleString('en-IN')} charged to ${scanner.result.name}`);
    setChargeForm({ description: '', category: 'consumable', quantity: 1, unitRate: 0, notes: '' });
    setTariffSearch('');
  };

  const applyTariff = (t: any) => {
    const rate = tariffs.getRate(t.id, 'self');
    setChargeForm(f => ({ ...f, description: t.service_name, category: t.category, unitRate: rate }));
    setTariffSearch('');
  };

  return (
    <div className="space-y-4">
      {/* Scanner controls */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-sm">Barcode / Wristband Scanner</h2>
            <p className="text-xs text-gray-500">Scan patient wristband or type UHID/IPD number</p>
          </div>
          {!scanner.scanning ? (
            <button onClick={scanner.startScanning} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">Start Scanning</button>
          ) : (
            <button onClick={scanner.stopScanning} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg">Stop Scanning</button>
          )}
        </div>

        {scanner.scanning && (
          <div className="bg-blue-50 border-2 border-blue-300 border-dashed rounded-xl p-6 text-center mb-4">
            <div className="text-3xl mb-2 animate-pulse">📡</div>
            <div className="text-sm font-medium text-blue-700">Waiting for barcode scan...</div>
            <div className="text-xs text-blue-500 mt-1">Point scanner at patient wristband or type below</div>
          </div>
        )}

        {/* Manual input (always available) */}
        <div className="flex gap-2">
          <input ref={inputRef} type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim()) { scanner.manualLookup(manualCode.trim()); setManualCode(''); } }}
            className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Type UHID or IPD number..." autoFocus={scanner.scanning} />
          <button onClick={() => { if (manualCode.trim()) { scanner.manualLookup(manualCode.trim()); setManualCode(''); } }}
            className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Lookup</button>
        </div>

        {scanner.error && <div className="mt-2 bg-red-50 rounded-lg px-4 py-2 text-sm text-red-700">{scanner.error}</div>}
      </div>

      {/* Patient found */}
      {scanner.result && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          {/* Patient header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">👤</div>
              <div>
                <div className="font-bold text-lg">{scanner.result.name}</div>
                <div className="text-sm text-gray-500">
                  UHID: <span className="font-mono font-medium">{scanner.result.uhid}</span>
                  {scanner.result.ipd && <><span className="mx-2">|</span>IPD: <span className="font-mono font-medium">{scanner.result.ipd}</span></>}
                  {scanner.result.wardType && <><span className="mx-2">|</span><span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    scanner.result.wardType === 'icu' ? 'bg-red-100 text-red-700' :
                    scanner.result.wardType === 'private' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{scanner.result.wardType.replace('_', ' ')}</span></>}
                </div>
              </div>
            </div>
            <button onClick={scanner.clear} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
          </div>

          {/* Quick charge from tariff */}
          <div className="relative">
            <label className="text-xs text-gray-500">Search tariff to add charge</label>
            <input type="text" value={tariffSearch} onChange={e => setTariffSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search: bed charge, nursing, oxygen, dressing..." />
            {tariffResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {tariffResults.map((t: any) => (
                  <button key={t.id} onClick={() => applyTariff(t)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b flex justify-between text-xs">
                    <span>{t.service_name} <span className="text-gray-400">({t.category.replace('_', ' ')})</span></span>
                    <span className="font-bold text-blue-600">₹{parseFloat(t.rate_self).toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual charge form */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label>
              <input type="text" value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Nebulization, Dressing" /></div>
            <div><label className="text-xs text-gray-500">Category</label>
              <select value={chargeForm.category} onChange={e => setChargeForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['consumable', 'procedure', 'nursing', 'room_rent', 'icu_charges', 'miscellaneous', 'professional_fee'].map(c => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select></div>
            <div><label className="text-xs text-gray-500">Qty × Rate</label>
              <div className="flex gap-1">
                <input type="number" value={chargeForm.quantity} onChange={e => setChargeForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-14 px-2 py-2 border rounded-lg text-sm text-center" min="1" />
                <input type="number" value={chargeForm.unitRate} onChange={e => setChargeForm(f => ({ ...f, unitRate: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 px-2 py-2 border rounded-lg text-sm text-right" placeholder="₹" />
              </div></div>
            <div className="flex items-end">
              <button onClick={addCharge} disabled={!chargeForm.description || chargeForm.unitRate <= 0}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-40 font-medium">
                Add ₹{(chargeForm.quantity * chargeForm.unitRate).toLocaleString('en-IN')}
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-700">{error}</div>}

          {/* Quick charge buttons (most common bedside charges) */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quick Charges</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['Nebulization', 150, 'nursing'], ['Dressing', 300, 'nursing'], ['Injection (IV)', 200, 'nursing'],
                ['Injection (IM)', 100, 'nursing'], ['Catheterization', 500, 'procedure'], ['Oxygen (1hr)', 100, 'consumable'],
                ['Blood Sugar (GRBS)', 50, 'nursing'], ['ECG', 200, 'procedure'], ['ABG', 500, 'procedure'],
                ['Suction', 100, 'nursing'], ['Tracheostomy Care', 500, 'nursing'], ['Central Line Dressing', 300, 'nursing'],
                ['Chest Physio', 300, 'nursing'], ['Sputum Suction', 150, 'nursing'], ['Wound Care', 400, 'nursing'],
              ].map(([desc, rate, cat]) => (
                <button key={desc as string} onClick={() => setChargeForm({ description: desc as string, category: cat as string, quantity: 1, unitRate: rate as number, notes: '' })}
                  className="px-2 py-1 bg-gray-50 border rounded text-[10px] hover:bg-blue-50 hover:border-blue-300">
                  {desc} <span className="font-bold text-blue-600">₹{rate}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
