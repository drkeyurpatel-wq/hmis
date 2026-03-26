// components/pharmacy/pharmacy-dispensing.tsx
// Rx dispensing queue + dispense form with drug search
'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Pill, Clock, CheckCircle } from 'lucide-react';

interface PharmacyDispensingProps {
  queue: any[];
  stats: { pending: number; inProgress: number; dispensed: number };
  onFilterChange: (status: string) => void;
  onDispense: (rxId: string, items: { drugId: string; drugName: string; qty: number }[], staffId: string) => Promise<{ success: boolean; error?: string }>;
  drugSearch: (q: string) => any[];
  staffId: string;
  onFlash: (msg: string) => void;
}

export default function PharmacyDispensing({ queue, stats, onFilterChange, onDispense, drugSearch, staffId, onFlash }: PharmacyDispensingProps) {
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [dispItems, setDispItems] = useState<{ drugId: string; drugName: string; qty: number }[]>([]);
  const [dispError, setDispError] = useState('');
  const [dispLoading, setDispLoading] = useState(false);

  const handleDispense = async () => {
    const validItems = dispItems.filter(i => i.drugId && i.qty > 0);
    if (validItems.length === 0) { setDispError('No valid items to dispense'); return; }
    setDispLoading(true); setDispError('');
    const result = await onDispense(selectedRx.id, validItems, staffId);
    setDispLoading(false);
    if (!result.success) { setDispError(result.error || 'Dispensing failed'); return; }
    onFlash('Dispensed successfully'); setSelectedRx(null); setDispItems([]); setDispError('');
  };

  return (
    <div className="space-y-3">
      {/* Status filters */}
      <div className="flex gap-1.5">
        {[
          { key: 'pending', label: 'Pending', count: stats.pending, color: 'bg-h1-yellow/10 text-h1-yellow' },
          { key: 'in_progress', label: 'In Progress', count: stats.inProgress, color: 'bg-h1-teal/10 text-h1-teal' },
          { key: 'dispensed', label: 'Dispensed', count: stats.dispensed, color: 'bg-h1-success/10 text-h1-success' },
        ].map(f => (
          <button key={f.key} onClick={() => onFilterChange(f.key)}
            className="px-3 py-1.5 rounded-h1-sm text-h1-small font-medium border border-h1-border
              bg-h1-card hover:bg-h1-navy/5 transition-colors cursor-pointer">
            {f.label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${f.color}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Queue */}
      {queue.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          No prescriptions in queue
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map(rx => (
            <div key={rx.id}
              className={`bg-h1-card rounded-h1 border transition-colors cursor-pointer
                ${selectedRx?.id === rx.id ? 'border-h1-teal ring-1 ring-h1-teal/20' : 'border-h1-border hover:border-h1-teal/50'}`}
              onClick={() => { setSelectedRx(rx); setDispItems([]); setDispError(''); }}>
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-h1-body text-h1-text">
                      <Link href={`/patients/${rx.patient_id || rx.patient?.id}`} className="hover:text-h1-teal hover:underline">
                        {rx.patient?.first_name} {rx.patient?.last_name}
                      </Link>
                    </span>
                    <span className="text-h1-small text-h1-text-muted ml-2">{rx.patient?.uhid}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-h1-sm text-[10px] font-medium
                      ${rx.status === 'pending' ? 'bg-h1-yellow/10 text-h1-yellow'
                        : rx.status === 'dispensed' ? 'bg-h1-success/10 text-h1-success'
                        : 'bg-h1-teal/10 text-h1-teal'}`}>
                      {rx.status}
                    </span>
                    <span className="text-[10px] text-h1-text-muted flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(rx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {rx.prescription_data && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(typeof rx.prescription_data === 'string' ? JSON.parse(rx.prescription_data) : rx.prescription_data).map((med: any, i: number) => (
                      <span key={i} className="bg-h1-navy/5 text-h1-text-secondary px-2 py-0.5 rounded-h1-sm text-[10px]">
                        {med.drug_name || med.drug || med.name || 'Drug'} {med.dose} {med.route}
                      </span>
                    ))}
                  </div>
                )}
                {rx.total_amount > 0 && (
                  <div className="mt-1 text-h1-small text-h1-success font-bold">
                    ₹{parseFloat(rx.total_amount).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispense form */}
      {selectedRx && (
        <div className="bg-h1-card rounded-h1 border border-h1-border p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-h1-card-title text-h1-navy flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-h1-teal" /> Dispense Prescription
              </h3>
              <div className="text-h1-small text-h1-text-secondary">
                {selectedRx.patient?.first_name} {selectedRx.patient?.last_name} ({selectedRx.patient?.uhid})
              </div>
            </div>
            <button onClick={() => { setSelectedRx(null); setDispItems([]); setDispError(''); }}
              className="text-h1-small text-h1-text-muted hover:text-h1-text cursor-pointer">Close</button>
          </div>

          {/* Prescribed medications */}
          <div className="bg-h1-navy/[0.03] rounded-h1-sm p-3">
            <div className="text-h1-small font-semibold text-h1-text-secondary mb-2">Prescribed Medications</div>
            {(() => {
              const rxData = typeof selectedRx.prescription_data === 'string'
                ? JSON.parse(selectedRx.prescription_data || '[]')
                : (selectedRx.prescription_data || []);
              return rxData.length === 0
                ? <div className="text-h1-small text-h1-text-muted">No prescription data — add items manually below</div>
                : <div className="space-y-1">{rxData.map((med: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-h1-small bg-h1-card rounded-h1-sm px-3 py-2">
                      <div>
                        <span className="font-medium text-h1-text">{med.drug_name || med.drug || med.name || 'Drug'}</span>
                        <span className="text-h1-text-muted ml-2">{med.dose} {med.route} {med.frequency}</span>
                      </div>
                      <div className="text-h1-text-muted">{med.duration || ''}</div>
                    </div>
                  ))}</div>;
            })()}
          </div>

          {/* Dispensing items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-h1-small font-semibold text-h1-text-secondary">Items to Dispense</span>
              <button onClick={() => setDispItems(prev => [...prev, { drugId: '', drugName: '', qty: 1 }])}
                className="text-h1-small text-h1-teal font-medium cursor-pointer hover:underline">+ Add Drug</button>
            </div>
            {dispItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 relative">
                  <input type="text" value={item.drugName} placeholder="Search drug..."
                    onChange={e => { const items = [...dispItems]; items[idx].drugName = e.target.value; items[idx].drugId = ''; setDispItems(items); }}
                    className="w-full px-3 py-1.5 border border-h1-border rounded-h1-sm text-h1-body
                      focus:outline-none focus:ring-1 focus:ring-h1-teal" />
                  {item.drugName.length >= 2 && !item.drugId && (() => {
                    const results = drugSearch(item.drugName);
                    return results.length > 0 ? (
                      <div className="absolute top-full left-0 right-0 bg-h1-card border border-h1-border rounded-h1-sm shadow-h1-dropdown z-10 mt-0.5 max-h-32 overflow-y-auto">
                        {results.slice(0, 8).map((d: any) => (
                          <button key={d.id} onClick={() => {
                            const items = [...dispItems];
                            items[idx].drugId = d.id;
                            items[idx].drugName = `${d.generic_name} ${d.strength || ''} (${d.formulation})`;
                            setDispItems(items);
                          }}
                            className="w-full text-left px-3 py-1.5 text-h1-small hover:bg-h1-teal/5 border-b border-h1-border last:border-0 cursor-pointer">
                            {d.generic_name} {d.strength} ({d.formulation}) {d.brand_name ? `— ${d.brand_name}` : ''}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <input type="number" value={item.qty} min={1}
                  onChange={e => { const items = [...dispItems]; items[idx].qty = parseInt(e.target.value) || 0; setDispItems(items); }}
                  className="w-20 px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-body text-center
                    focus:outline-none focus:ring-1 focus:ring-h1-teal" placeholder="Qty" />
                {item.drugId && <CheckCircle className="w-4 h-4 text-h1-success flex-shrink-0" />}
                <button onClick={() => setDispItems(prev => prev.filter((_, i) => i !== idx))}
                  className="text-h1-red text-h1-small cursor-pointer hover:underline">Remove</button>
              </div>
            ))}
            {dispItems.length === 0 && (
              <div className="text-h1-small text-h1-text-muted py-2">
                No items added. Click + Add Drug to start dispensing.
              </div>
            )}
          </div>

          {dispError && (
            <div className="bg-h1-red/5 border border-h1-red/20 rounded-h1-sm px-4 py-2 text-h1-small text-h1-red">
              {dispError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-h1-small text-h1-text-muted">
              {dispItems.filter(i => i.drugId && i.qty > 0).length} of {dispItems.length} items ready
            </div>
            <button onClick={handleDispense}
              disabled={dispLoading || dispItems.filter(i => i.drugId && i.qty > 0).length === 0}
              className="px-6 py-2 bg-h1-success text-white text-h1-body font-medium rounded-h1-sm
                disabled:opacity-40 disabled:cursor-not-allowed hover:bg-h1-success/90 transition-colors cursor-pointer">
              {dispLoading ? 'Processing...' : 'Dispense (FEFO Auto-Pick)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
