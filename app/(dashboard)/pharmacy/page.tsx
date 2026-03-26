'use client';
import Link from 'next/link';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDrugMaster, usePharmacyStock, useDispensingQueue, usePharmacyDashboard } from '@/lib/pharmacy/pharmacy-hooks';
import { usePharmacyReturns, useStockTransfers, useControlledSubstances } from '@/lib/pharmacy/pharmacy-v2-hooks';
import { sb } from '@/lib/supabase/browser';

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtL = (n: number) => n >= 100000 ? `${(n/100000).toFixed(2)}L` : `${fmt(n)}`;

type Tab = 'dispensing'|'inventory'|'drug_master'|'controlled'|'more';

function PharmacyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const drugMaster = useDrugMaster();
  const stock = usePharmacyStock(centreId);
  const dispensing = useDispensingQueue(centreId);
  const dashboard = usePharmacyDashboard(centreId);
  const returns = usePharmacyReturns(centreId);
  const transfers = useStockTransfers(centreId);
  const controlled = useControlledSubstances(centreId);

  const [tab, setTab] = useState<Tab>('dispensing');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const [centres, setCentres] = useState<any[]>([]);

  // Load centres for transfers
  React.useEffect(() => { if (!sb()) return; sb()!.from('hmis_centres').select('id, name, code').eq('is_active', true).order('name').then(({ data }: any) => setCentres(data || [])); }, []);

  // Return form
  const [retForm, setRetForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', returnType: 'patient_return' as string, reason: '', amount: '' });
  const [retDrugResults, setRetDrugResults] = useState<any[]>([]);
  // Transfer form
  const [xferForm, setXferForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', toCentreId: '', reason: '' });
  // Controlled form
  const [ctrlForm, setCtrlForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', transactionType: 'dispensed' as string, witnessId: '', notes: '' });

  // Drug master form
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [drugForm, setDrugForm] = useState({ generic_name:'', brand_name:'', manufacturer:'', formulation:'tablet', strength:'', unit:'strip', schedule:'', is_narcotic:false, is_antibiotic:false, hsn_code:'', gst_rate:12, reorder_level:20, rack_location:'', bin_number:'' });
  const [drugSearch, setDrugSearch] = useState('');
  const drugResults = useMemo(() => drugMaster.search(drugSearch), [drugSearch, drugMaster]);

  // Stock add form
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockDrugQ, setStockDrugQ] = useState('');
  const stockDrugResults = useMemo(() => drugMaster.search(stockDrugQ), [stockDrugQ, drugMaster]);
  const [stockForm, setStockForm] = useState({ drug_id:'', drug_name:'', batch_number:'', expiry_date:'', purchase_rate:'', mrp:'', quantity_received:'', supplier:'' });
  const [stockError, setStockError] = useState('');

  // Dispensing
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [dispItems, setDispItems] = useState<{drugId: string; drugName: string; qty: number; prescribed: string}[]>([]);
  const [dispError, setDispError] = useState('');
  const [dispLoading, setDispLoading] = useState(false);

  const tabs: [Tab,string,string][] = [
    ['dispensing','Dispensing','💊'],['inventory','Inventory','📦'],['drug_master','Drug Master','📋'],
    ['controlled','Controlled','🔒'],['more','Transfers & Returns','🔄'],
  ];

  const daysToExpiry = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  const expiryColor = (d: string) => { const days = daysToExpiry(d); return days <= 0 ? 'text-red-700 bg-red-50' : days <= 30 ? 'text-red-600 bg-red-50' : days <= 90 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600'; };

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-success text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-3">
        <div><h1 className="text-xl font-bold text-gray-900">Pharmacy</h1><p className="text-xs text-gray-500">Drug dispensing, stock management, procurement</p></div>
      </div>

      <div className="flex gap-1 mb-4 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k,l,icon]) => <button key={k} onClick={() => setTab(k)}
          className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap rounded-xl ${tab===k?'bg-h1-navy text-white shadow-sm':'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{icon} {l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dispensing' && /* stats */ <div className="space-y-4">
        <div className="grid grid-cols-6 gap-3">
          {[['Dispensed Today',dashboard.todayDispensed,'text-h1-teal','bg-h1-teal-light'],
            ['Revenue Today',`₹${fmtL(dashboard.todayRevenue)}`,'text-green-700','bg-green-50'],
            ['Month Revenue',`₹${fmtL(dashboard.monthRevenue)}`,'text-green-700','bg-green-50'],
            ['Pending Rx',dispensing.stats.pending,'text-yellow-700','bg-yellow-50'],
            ['Low Stock',stock.lowStock.length,'text-red-700','bg-red-50'],
            ['Expiring (90d)',stock.expiringSoon.length,'text-orange-700','bg-orange-50'],
          ].map(([l,v,tc,bg],i) => (
            <div key={i} className={`rounded-xl border p-3 text-center ${bg}`}><div className="text-[10px] text-gray-500">{l as string}</div><div className={`text-xl font-bold ${tc}`}>{v}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-xs font-bold mb-2">Stock Value</h3>
            <div className="flex justify-between text-sm"><span className="text-gray-500">At cost:</span><span className="font-bold">₹{fmtL(stock.totalValue)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">At MRP:</span><span className="font-bold text-green-700">₹{fmtL(stock.totalMRPValue)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Margin:</span><span className="font-bold text-h1-teal">₹{fmtL(stock.totalMRPValue - stock.totalValue)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Items:</span><span className="font-bold">{stock.aggregated.length} drugs / {stock.stock.length} batches</span></div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-xs font-bold mb-2">Expired Stock</h3>
            {stock.expired.length === 0 ? <div className="text-center py-4 text-green-600 text-sm">No expired stock</div> :
            <div className="space-y-1">{stock.expired.slice(0,5).map((s,i) => (
              <div key={i} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1"><span className="text-red-700 font-medium">{s.drug?.generic_name} ({s.batch_number})</span><span className="text-red-600">{s.quantity_available} units</span></div>
            ))}</div>}
          </div>
        </div>
      </div>}

      {/* ===== DISPENSING QUEUE ===== */}
      {tab === 'dispensing' && <div className="space-y-3">
        <div className="flex gap-2">{['pending','in_progress','dispensed'].map(s => (
          <button key={s} onClick={() => dispensing.load(s)} className="px-3 py-1.5 rounded-lg text-xs border bg-white">{s.replace('_',' ')} ({s==='pending'?dispensing.stats.pending:s==='in_progress'?dispensing.stats.inProgress:dispensing.stats.dispensed})</button>
        ))}</div>
        {dispensing.queue.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No prescriptions in queue</div> :
        <div className="space-y-2">{dispensing.queue.map(rx => (
          <div key={rx.id} className="bg-white rounded-xl border p-4 hover:border-h1-teal cursor-pointer" onClick={() => setSelectedRx(rx)}>
            <div className="flex justify-between">
              <div><span className="font-semibold text-sm"><Link href={`/patients/${rx.patient_id || rx.patient?.id}`} className='hover:text-h1-teal hover:underline'>{rx.patient?.first_name} {rx.patient?.last_name}</Link></span><span className="text-xs text-gray-400 ml-2">{rx.patient?.uhid}</span></div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] ${rx.status==='pending'?'bg-yellow-100 text-yellow-700':rx.status==='dispensed'?'bg-green-100 text-green-700':'bg-h1-teal-light text-h1-teal'}`}>{rx.status}</span>
                <span className="text-xs text-gray-400">{new Date(rx.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            </div>
            {rx.prescription_data && <div className="mt-2 flex flex-wrap gap-1">{(typeof rx.prescription_data === 'string' ? JSON.parse(rx.prescription_data) : rx.prescription_data).map((med: any, i: number) => (
              <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px]">{med.drug_name || med.name || 'Drug'} {med.dose} {med.route}</span>
            ))}</div>}
            {rx.total_amount > 0 && <div className="mt-1 text-xs text-green-700 font-bold">₹{fmt(parseFloat(rx.total_amount))}</div>}
          </div>
        ))}</div>}

        {selectedRx && <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div><h3 className="font-bold">Dispense Prescription</h3>
              <div className="text-xs text-gray-500">{selectedRx.patient?.first_name} {selectedRx.patient?.last_name} ({selectedRx.patient?.uhid})</div></div>
            <button onClick={() => { setSelectedRx(null); setDispItems([]); setDispError(''); }} className="text-xs text-gray-500">Close</button>
          </div>

          {/* Prescribed medications */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Prescribed Medications</div>
            {(() => {
              const rxData = typeof selectedRx.prescription_data === 'string' ? JSON.parse(selectedRx.prescription_data || '[]') : (selectedRx.prescription_data || []);
              return rxData.length === 0
                ? <div className="text-xs text-gray-400">No prescription data — add items manually below</div>
                : <div className="space-y-1">{rxData.map((med: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-white rounded px-3 py-2">
                      <div><span className="font-medium">{med.drug_name || med.name || 'Drug'}</span> <span className="text-gray-400">{med.dose} {med.route} {med.frequency}</span></div>
                      <div className="text-gray-500">{med.duration || ''}</div>
                    </div>
                  ))}</div>;
            })()}
          </div>

          {/* Dispensing items — drug search + qty entry */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-500">Items to Dispense</span>
              <button onClick={() => setDispItems(prev => [...prev, { drugId: '', drugName: '', qty: 1, prescribed: '' }])}
                className="text-xs text-h1-teal">+ Add Drug</button>
            </div>
            {dispItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 relative">
                  <input type="text" value={item.drugName} placeholder="Search drug..."
                    onChange={e => { const items = [...dispItems]; items[idx].drugName = e.target.value; items[idx].drugId = ''; setDispItems(items); }}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                  {item.drugName.length >= 2 && !item.drugId && (() => {
                    const results = drugMaster.search(item.drugName);
                    return results.length > 0 ? (
                      <div className="absolute top-full left-0 right-0 bg-white border rounded shadow z-10 mt-0.5 max-h-32 overflow-y-auto">
                        {results.map(d => (
                          <button key={d.id} onClick={() => { const items = [...dispItems]; items[idx].drugId = d.id; items[idx].drugName = `${d.generic_name} ${d.strength || ''} (${d.formulation})`; setDispItems(items); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-h1-teal-light border-b">{d.generic_name} {d.strength} ({d.formulation}) {d.brand_name ? `— ${d.brand_name}` : ''}</button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <input type="number" value={item.qty} min={1} onChange={e => { const items = [...dispItems]; items[idx].qty = parseInt(e.target.value) || 0; setDispItems(items); }}
                  className="w-20 px-2 py-1.5 border rounded text-sm text-center" placeholder="Qty" />
                {item.drugId && <span className="text-green-600 text-xs">Ready</span>}
                <button onClick={() => setDispItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 text-sm">Remove</button>
              </div>
            ))}
            {dispItems.length === 0 && <div className="text-xs text-gray-400 py-2">No items added. Click + Add Drug to start dispensing.</div>}
          </div>

          {/* Error + Dispense button */}
          {dispError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{dispError}</div>}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{dispItems.filter(i => i.drugId && i.qty > 0).length} of {dispItems.length} items ready</div>
            <button onClick={async () => {
              const validItems = dispItems.filter(i => i.drugId && i.qty > 0);
              if (validItems.length === 0) { setDispError('No valid items to dispense'); return; }
              setDispLoading(true); setDispError('');
              const result = await dispensing.dispense(selectedRx.id, validItems, staffId, 0);
              setDispLoading(false);
              if (!result.success) { setDispError(result.error || 'Dispensing failed'); return; }
              flash('Dispensed successfully'); setSelectedRx(null); setDispItems([]); setDispError('');
            }} disabled={dispLoading || dispItems.filter(i => i.drugId && i.qty > 0).length === 0}
              className="px-6 py-2 bg-h1-success text-white text-sm rounded-lg font-medium disabled:opacity-40">{dispLoading ? 'Processing...' : 'Dispense (FEFO Auto-Pick)'}</button>
          </div>
        </div>}
      </div>}

      {/* ===== DRUG MASTER ===== */}
      {tab === 'drug_master' && <div className="space-y-3">
        <div className="flex gap-2"><input type="text" value={drugSearch} onChange={e => setDrugSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Search drugs..." />
          <button onClick={() => setShowAddDrug(!showAddDrug)} className="px-3 py-2 bg-h1-navy text-white text-xs rounded-lg">{showAddDrug?'Cancel':'+ Add Drug'}</button></div>
        {showAddDrug && <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Generic name *</label><input type="text" value={drugForm.generic_name} onChange={e => setDrugForm(f => ({...f, generic_name:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Brand name</label><input type="text" value={drugForm.brand_name} onChange={e => setDrugForm(f => ({...f, brand_name:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Manufacturer</label><input type="text" value={drugForm.manufacturer} onChange={e => setDrugForm(f => ({...f, manufacturer:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Strength</label><input type="text" value={drugForm.strength} onChange={e => setDrugForm(f => ({...f, strength:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="500mg" /></div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div><label className="text-xs text-gray-500">Formulation</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{['tablet','capsule','syrup','injection','ointment','drops','inhaler','powder','gel','patch'].map(f => (
                <button key={f} onClick={() => setDrugForm(d => ({...d, formulation:f}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${drugForm.formulation===f?'bg-h1-navy text-white':'bg-white'}`}>{f}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Unit</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{['strip','vial','bottle','tube','ampoule','sachet','box','unit'].map(u => (
                <button key={u} onClick={() => setDrugForm(d => ({...d, unit:u}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${drugForm.unit===u?'bg-h1-navy text-white':'bg-white'}`}>{u}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Schedule</label>
              <div className="flex gap-0.5 mt-0.5">{['','H','H1','X'].map(s => (
                <button key={s} onClick={() => setDrugForm(d => ({...d, schedule:s, is_narcotic:s==='X'}))} className={`px-2 py-0.5 rounded text-[9px] border ${drugForm.schedule===s?'bg-h1-navy text-white':'bg-white'}`}>{s||'None'}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">GST %</label>
              <div className="flex gap-0.5 mt-0.5">{[0,5,12,18].map(g => (
                <button key={g} onClick={() => setDrugForm(d => ({...d, gst_rate:g}))} className={`px-2 py-0.5 rounded text-[9px] border ${drugForm.gst_rate===g?'bg-h1-navy text-white':'bg-white'}`}>{g}%</button>
              ))}</div></div>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={drugForm.is_antibiotic} onChange={e => setDrugForm(d => ({...d, is_antibiotic:e.target.checked}))} /> Antibiotic</label>
              <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={drugForm.is_narcotic} onChange={e => setDrugForm(d => ({...d, is_narcotic:e.target.checked}))} /> Narcotic</label>
            </div>
          </div>
          <button onClick={async () => { if (!drugForm.generic_name) return; await drugMaster.addDrug(drugForm); setShowAddDrug(false); flash('Drug added'); }} className="px-4 py-2 bg-h1-success text-white text-sm rounded-lg">Save Drug</button>
        </div>}
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Generic Name</th><th className="p-2 text-left">Brand</th><th className="p-2">Form</th><th className="p-2">Strength</th><th className="p-2">Sch</th><th className="p-2">GST</th><th className="p-2">Reorder</th>
        </tr></thead><tbody>{(drugSearch ? drugResults : drugMaster.drugs.slice(0,50)).map(d => (
          <tr key={d.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-medium">{d.generic_name}{d.is_antibiotic && <span className="ml-1 text-[9px] bg-orange-100 text-orange-700 px-1 rounded">AB</span>}{d.is_narcotic && <span className="ml-1 text-[9px] bg-red-100 text-red-700 px-1 rounded">NAR</span>}</td>
            <td className="p-2 text-gray-500">{d.brand_name || '—'}</td>
            <td className="p-2 text-center">{d.formulation}</td>
            <td className="p-2 text-center">{d.strength || '—'}</td>
            <td className="p-2 text-center">{d.schedule ? <span className={`px-1 py-0.5 rounded text-[9px] ${d.schedule==='X'?'bg-red-100 text-red-700':d.schedule==='H1'?'bg-orange-100 text-orange-700':'bg-gray-100'}`}>{d.schedule}</span> : '—'}</td>
            <td className="p-2 text-center">{d.gst_rate}%</td>
            <td className="p-2 text-center">{d.reorder_level || 20}</td>
          </tr>))}</tbody></table></div>
        <div className="text-xs text-gray-400 text-center">{drugMaster.drugs.length} drugs in master</div>
      </div>}

      {/* ===== STOCK OVERVIEW ===== */}
      {tab === 'inventory' && <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={() => stock.load()} className="px-3 py-1.5 rounded-lg text-xs border bg-white">All Stock</button>
            <button onClick={() => stock.load({lowStock:true})} className="px-3 py-1.5 rounded-lg text-xs border bg-red-50 text-red-700">Low Stock ({stock.lowStock.length})</button>
            <button onClick={() => stock.load({expiringSoon:true})} className="px-3 py-1.5 rounded-lg text-xs border bg-orange-50 text-orange-700">Expiring ({stock.expiringSoon.length})</button>
          </div>
          <button onClick={() => setShowAddStock(!showAddStock)} className="px-3 py-1.5 bg-h1-navy text-white text-xs rounded-lg">{showAddStock?'Cancel':'+ Add Stock'}</button>
        </div>
        {showAddStock && <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Drug *</label>
              <input type="text" value={stockDrugQ} onChange={e => setStockDrugQ(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search drug..." />
              {stockDrugResults.length > 0 && <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow z-10 mt-1 max-h-40 overflow-y-auto">{stockDrugResults.map(d => (
                <button key={d.id} onClick={() => { setStockForm(f => ({...f, drug_id:d.id, drug_name:d.generic_name})); setStockDrugQ(d.generic_name); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-h1-teal-light border-b">{d.generic_name} {d.strength} ({d.formulation})</button>
              ))}</div>}</div>
            <div><label className="text-xs text-gray-500">Batch # *</label><input type="text" value={stockForm.batch_number} onChange={e => setStockForm(f => ({...f, batch_number:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Expiry *</label><input type="date" value={stockForm.expiry_date} onChange={e => setStockForm(f => ({...f, expiry_date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Supplier</label><input type="text" value={stockForm.supplier} onChange={e => setStockForm(f => ({...f, supplier:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Purchase rate *</label><input type="number" value={stockForm.purchase_rate} onChange={e => setStockForm(f => ({...f, purchase_rate:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">MRP *</label><input type="number" value={stockForm.mrp} onChange={e => setStockForm(f => ({...f, mrp:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Quantity *</label><input type="number" value={stockForm.quantity_received} onChange={e => setStockForm(f => ({...f, quantity_received:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          {stockError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{stockError}</div>}
          <button onClick={async () => {
            setStockError('');
            const result = await stock.addStock({ drug_id:stockForm.drug_id, batch_number:stockForm.batch_number, expiry_date:stockForm.expiry_date, purchase_rate:parseFloat(stockForm.purchase_rate), mrp:parseFloat(stockForm.mrp), quantity_received:parseInt(stockForm.quantity_received), supplier:stockForm.supplier });
            if (!result.success) { setStockError(result.error || 'Failed to add stock'); return; }
            setShowAddStock(false); setStockError(''); flash('Stock added');
            setStockForm({ drug_id:'', drug_name:'', batch_number:'', expiry_date:'', purchase_rate:'', mrp:'', quantity_received:'', supplier:'' });
          }} className="px-4 py-2 bg-h1-success text-white text-sm rounded-lg">Add Stock</button>
        </div>}
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Drug</th><th className="p-2">Form</th><th className="p-2 text-right">Total Qty</th><th className="p-2">Batches</th><th className="p-2">Earliest Exp</th><th className="p-2 text-right">Avg Cost</th><th className="p-2 text-right">MRP</th><th className="p-2 text-right">Value</th>
        </tr></thead><tbody>{stock.aggregated.map(a => (
          <tr key={a.drugId} className={`border-b hover:bg-gray-50 ${a.totalQty <= 10 ? 'bg-red-50' : ''}`}>
            <td className="p-2 font-medium">{a.drug?.generic_name} <span className="text-gray-400">{a.drug?.strength}</span></td>
            <td className="p-2 text-center">{a.drug?.formulation}</td>
            <td className={`p-2 text-right font-bold ${a.totalQty <= 10 ? 'text-red-700' : ''}`}>{a.totalQty}</td>
            <td className="p-2 text-center">{a.batches}</td>
            <td className={`p-2 text-center ${expiryColor(a.earliestExpiry)}`}>{a.earliestExpiry} ({daysToExpiry(a.earliestExpiry)}d)</td>
            <td className="p-2 text-right">₹{a.avgCost.toFixed(2)}</td>
            <td className="p-2 text-right">₹{parseFloat(a.mrp).toFixed(2)}</td>
            <td className="p-2 text-right font-bold">₹{fmt(Math.round(a.totalCost))}</td>
          </tr>))}</tbody></table></div>
      </div>}

      {/* ===== BATCH TRACKER ===== */}
      {tab === 'inventory' && /* batch */ <div className="space-y-3">
        <h2 className="text-sm font-semibold">Batch-wise Stock</h2>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Drug</th><th className="p-2">Batch #</th><th className="p-2">Expiry</th><th className="p-2 text-right">Qty Avail</th><th className="p-2 text-right">Dispensed</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">MRP</th><th className="p-2">Supplier</th>
        </tr></thead><tbody>{stock.stock.map(s => (
          <tr key={s.id} className={`border-b ${daysToExpiry(s.expiry_date) <= 0 ? 'bg-red-50' : daysToExpiry(s.expiry_date) <= 90 ? 'bg-yellow-50' : ''}`}>
            <td className="p-2 font-medium">{s.drug?.generic_name} <span className="text-gray-400">{s.drug?.strength}</span></td>
            <td className="p-2 text-center font-mono text-[10px]">{s.batch_number}</td>
            <td className={`p-2 text-center ${expiryColor(s.expiry_date)}`}>{s.expiry_date}</td>
            <td className={`p-2 text-right font-bold ${s.quantity_available <= 5 ? 'text-red-700' : ''}`}>{s.quantity_available}</td>
            <td className="p-2 text-right text-gray-400">{s.quantity_dispensed || 0}</td>
            <td className="p-2 text-right">₹{parseFloat(s.purchase_rate).toFixed(2)}</td>
            <td className="p-2 text-right">₹{parseFloat(s.mrp).toFixed(2)}</td>
            <td className="p-2 text-[10px] text-gray-400">{s.supplier || '—'}</td>
          </tr>))}</tbody></table></div>
      </div>}

      {/* ===== EXPIRY MANAGEMENT ===== */}
      {tab === 'inventory' && /* expiry */ <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center"><div className="text-[10px] text-red-600">Already Expired</div><div className="text-2xl font-bold text-red-700">{stock.expired.length}</div></div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-center"><div className="text-[10px] text-orange-600">Expiring in 90 days</div><div className="text-2xl font-bold text-orange-700">{stock.expiringSoon.length}</div></div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center"><div className="text-[10px] text-yellow-600">Value at Risk</div><div className="text-2xl font-bold text-yellow-700">₹{fmt(stock.expiringSoon.reduce((s,i) => s+parseFloat(i.purchase_rate)*i.quantity_available, 0))}</div></div>
        </div>
        {stock.expired.length > 0 && <><h3 className="text-sm font-bold text-red-700">Expired Stock — Action Required</h3>
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-red-50 border-b"><th className="p-2 text-left">Drug</th><th className="p-2">Batch</th><th className="p-2">Expired</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Loss</th></tr></thead><tbody>{stock.expired.map(s => (
            <tr key={s.id} className="border-b bg-red-50"><td className="p-2 font-medium text-red-700">{s.drug?.generic_name}</td><td className="p-2 text-center font-mono text-[10px]">{s.batch_number}</td><td className="p-2 text-center text-red-600">{s.expiry_date}</td><td className="p-2 text-right font-bold">{s.quantity_available}</td><td className="p-2 text-right text-red-700 font-bold">₹{fmt(Math.round(parseFloat(s.purchase_rate)*s.quantity_available))}</td></tr>
          ))}</tbody></table></div></>}
        <h3 className="text-sm font-bold text-orange-700">Expiring Within 90 Days</h3>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-orange-50 border-b"><th className="p-2 text-left">Drug</th><th className="p-2">Batch</th><th className="p-2">Expiry</th><th className="p-2">Days Left</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Value</th></tr></thead><tbody>{stock.expiringSoon.filter(s => daysToExpiry(s.expiry_date) > 0).map(s => (
          <tr key={s.id} className="border-b"><td className="p-2 font-medium">{s.drug?.generic_name}</td><td className="p-2 text-center font-mono text-[10px]">{s.batch_number}</td><td className="p-2 text-center">{s.expiry_date}</td>
            <td className={`p-2 text-center font-bold ${daysToExpiry(s.expiry_date) <= 30 ? 'text-red-600' : 'text-yellow-600'}`}>{daysToExpiry(s.expiry_date)}d</td>
            <td className="p-2 text-right">{s.quantity_available}</td><td className="p-2 text-right">₹{fmt(Math.round(parseFloat(s.purchase_rate)*s.quantity_available))}</td></tr>
        ))}</tbody></table></div>
      </div>}

      {/* ===== PO / GRN / TRANSFERS / CONTROLLED / RETURNS — Framework ===== */}
      {tab === 'more' && /* po */ <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">Purchase Orders</h2>
          <a href="/vpms" className="px-3 py-1.5 bg-h1-navy text-white text-xs rounded-lg">Open VPMS →</a>
        </div>
        <div className="text-xs text-gray-500 mb-3">Purchase orders are managed in the VPMS (Vendor & Purchase Management System). POs created there auto-flow to pharmacy stock via the integration bridge.</div>
        <div className="grid grid-cols-3 gap-3">
          {stock.lowStock.length > 0 && <div className="bg-red-50 rounded-lg p-3"><div className="text-xs font-bold text-red-700 mb-1">Low Stock Alerts ({stock.lowStock.length})</div>
            {stock.lowStock.slice(0, 8).map((s: any) => <div key={s.id} className="text-[10px] flex justify-between"><span>{s.drug_name}</span><span className="font-bold text-red-600">{s.quantity} left</span></div>)}
          </div>}
          {stock.expiringSoon.length > 0 && <div className="bg-h1-yellow-light rounded-lg p-3"><div className="text-xs font-bold text-h1-yellow mb-1">Expiring Soon ({stock.expiringSoon.length})</div>
            {stock.expiringSoon.slice(0, 8).map((s: any) => <div key={s.id} className="text-[10px] flex justify-between"><span>{s.drug_name}</span><span className="text-h1-yellow">{s.expiry_date}</span></div>)}
          </div>}
        </div>
      </div>}

      {tab === 'more' && /* grn */ <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold text-sm mb-3">Goods Receipt Note</h2>
        <div className="text-xs text-gray-500 mb-3">GRN verification happens in the Stock tab when adding new stock entries. Each stock entry serves as a GRN with batch number, expiry, supplier, and quantity tracking.</div>
        <div className="text-center py-8"><button onClick={() => setTab('inventory')} className="px-4 py-2 bg-h1-navy text-white text-sm rounded-lg">Go to Stock Management →</button></div>
      </div>}

      {tab === 'more' && /* transfers */ <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Inter-Centre Stock Transfer</h2>
        </div>
        {/* Transfer form */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-500">New Transfer (from this centre)</h3>
          <div className="grid grid-cols-5 gap-2">
            <div className="relative"><label className="text-[9px] text-gray-500">Drug</label>
              <input type="text" value={xferForm.drugSearch} onChange={e => { setXferForm(f => ({ ...f, drugSearch: e.target.value })); }}
                className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Search drug..." />
              {xferForm.drugSearch.length >= 2 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-32 overflow-y-auto">
                {drugMaster.search(xferForm.drugSearch).slice(0, 5).map((d: any) => (
                  <button key={d.id} onClick={() => setXferForm(f => ({ ...f, drugId: d.id, drugName: d.drug_name || d.generic_name, drugSearch: '' }))}
                    className="w-full text-left px-2 py-1 text-[10px] hover:bg-h1-teal-light border-b">{d.drug_name || d.generic_name}</button>
                ))}
              </div>}
              {xferForm.drugId && <div className="text-[10px] text-h1-teal mt-0.5">{xferForm.drugName}</div>}
            </div>
            <div><label className="text-[9px] text-gray-500">Qty</label>
              <input type="number" value={xferForm.quantity} onChange={e => setXferForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Batch</label>
              <input type="text" value={xferForm.batchNumber} onChange={e => setXferForm(f => ({ ...f, batchNumber: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">To Centre</label>
              <select value={xferForm.toCentreId} onChange={e => setXferForm(f => ({ ...f, toCentreId: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">Select</option>{centres.filter(c => c.id !== centreId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="flex items-end"><button onClick={async () => {
              const r = await transfers.createTransfer({ drugId: xferForm.drugId, quantity: parseInt(xferForm.quantity), batchNumber: xferForm.batchNumber, toCentreId: xferForm.toCentreId, reason: xferForm.reason, staffId });
              if (r.success) { flash('Transfer initiated'); setXferForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', toCentreId: '', reason: '' }); }
              else flash(r.error || 'Failed');
            }} disabled={!xferForm.drugId || !xferForm.quantity || !xferForm.toCentreId}
              className="w-full py-1.5 bg-h1-navy text-white text-xs rounded disabled:opacity-40">Transfer</button></div>
          </div>
        </div>
        {/* Transfer list */}
        {transfers.loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
        transfers.transfers.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No transfers</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Drug</th><th className="p-2">Qty</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2">Status</th><th className="p-2">Date</th><th className="p-2"></th>
          </tr></thead><tbody>{transfers.transfers.map((t: any) => (
            <tr key={t.id} className="border-b"><td className="p-2 font-medium">{t.drug?.drug_name}</td>
              <td className="p-2 text-center">{t.quantity}</td>
              <td className="p-2 text-center">{t.from_centre?.code}</td><td className="p-2 text-center">{t.to_centre?.code}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${t.status === 'received' ? 'bg-green-100 text-green-700' : t.status === 'initiated' ? 'bg-h1-teal-light text-h1-teal' : 'bg-gray-100'}`}>{t.status}</span></td>
              <td className="p-2 text-center text-gray-400">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
              <td className="p-2">{t.status === 'initiated' && t.to_centre_id === centreId && <button onClick={() => { transfers.receiveTransfer(t.id, staffId); flash('Transfer received'); }} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Receive</button>}</td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {tab === 'controlled' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="font-bold text-sm">Controlled Substance Register</h2><p className="text-xs text-gray-500">Schedule H, H1, X drugs — every unit tracked with witness</p></div>
          <div className="flex gap-2">
            {controlled.stats.unwitnessed > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold">{controlled.stats.unwitnessed} unwitnessed entries</span>}
          </div>
        </div>
        {/* Entry form */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-500">Log Entry</h3>
          <div className="grid grid-cols-6 gap-2">
            <div className="relative"><label className="text-[9px] text-gray-500">Drug</label>
              <input type="text" value={ctrlForm.drugSearch} onChange={e => setCtrlForm(f => ({ ...f, drugSearch: e.target.value }))}
                className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Search..." />
              {ctrlForm.drugSearch.length >= 2 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-32 overflow-y-auto">
                {drugMaster.search(ctrlForm.drugSearch).slice(0, 5).map((d: any) => (
                  <button key={d.id} onClick={() => setCtrlForm(f => ({ ...f, drugId: d.id, drugName: d.drug_name || d.generic_name, drugSearch: '' }))}
                    className="w-full text-left px-2 py-1 text-[10px] hover:bg-h1-teal-light border-b">{d.drug_name || d.generic_name}</button>
                ))}
              </div>}
              {ctrlForm.drugId && <div className="text-[10px] text-h1-teal mt-0.5">{ctrlForm.drugName}</div>}
            </div>
            <div><label className="text-[9px] text-gray-500">Type</label>
              <select value={ctrlForm.transactionType} onChange={e => setCtrlForm(f => ({ ...f, transactionType: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {['received', 'dispensed', 'returned', 'destroyed', 'wastage'].map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Qty</label>
              <input type="number" value={ctrlForm.quantity} onChange={e => setCtrlForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Batch</label>
              <input type="text" value={ctrlForm.batchNumber} onChange={e => setCtrlForm(f => ({ ...f, batchNumber: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500 text-red-600">Witness *</label>
              <input type="text" value={ctrlForm.witnessId} onChange={e => setCtrlForm(f => ({ ...f, witnessId: e.target.value }))} className="w-full px-2 py-1.5 border border-red-200 rounded text-xs" placeholder="Witness staff ID" /></div>
            <div className="flex items-end"><button onClick={async () => {
              const r = await controlled.addEntry({ drugId: ctrlForm.drugId, quantity: parseInt(ctrlForm.quantity), batchNumber: ctrlForm.batchNumber, transactionType: ctrlForm.transactionType as any, administeredBy: staffId, witnessedBy: ctrlForm.witnessId, notes: ctrlForm.notes });
              if (r.success) { flash('Entry logged'); setCtrlForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', transactionType: 'dispensed', witnessId: '', notes: '' }); }
              else flash(r.error || 'Failed');
            }} disabled={!ctrlForm.drugId || !ctrlForm.quantity || !ctrlForm.witnessId}
              className="w-full py-1.5 bg-red-600 text-white text-xs rounded disabled:opacity-40">Log</button></div>
          </div>
        </div>
        {/* Register */}
        {controlled.loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Drug</th><th className="p-2">Type</th><th className="p-2">Qty</th><th className="p-2">Batch</th><th className="p-2">By</th><th className="p-2">Witness</th><th className="p-2">Date/Time</th>
          </tr></thead><tbody>{controlled.register.slice(0, 50).map((r: any) => (
            <tr key={r.id} className={`border-b ${r.transaction_type === 'wastage' ? 'bg-red-50' : ''}`}>
              <td className="p-2 font-medium">{r.drug?.drug_name}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${r.transaction_type === 'dispensed' ? 'bg-h1-teal-light text-h1-teal' : r.transaction_type === 'received' ? 'bg-green-100 text-green-700' : r.transaction_type === 'wastage' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{r.transaction_type}</span></td>
              <td className="p-2 text-center font-bold">{r.quantity}</td>
              <td className="p-2 text-center text-gray-400">{r.batch_number}</td>
              <td className="p-2 text-[10px]">{r.staff?.full_name}</td>
              <td className="p-2 text-[10px]">{r.witness?.full_name || <span className="text-red-600 font-bold">NO WITNESS</span>}</td>
              <td className="p-2 text-center text-gray-400 text-[10px]">{new Date(r.created_at).toLocaleString('en-IN')}</td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {tab === 'more' && /* returns */ <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Returns & Write-offs</h2>
          <div className="flex gap-2 text-[10px]">
            <span className="bg-h1-teal-light text-h1-teal px-2 py-1 rounded">Patient returns: {returns.stats.patientReturns}</span>
            <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Expiry write-off: {returns.stats.expiryWriteOff}</span>
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Total refund: ₹{fmt(returns.stats.totalRefund)}</span>
          </div>
        </div>
        {/* Return form */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-500">Process Return / Write-off</h3>
          <div className="grid grid-cols-6 gap-2">
            <div className="relative"><label className="text-[9px] text-gray-500">Drug</label>
              <input type="text" value={retForm.drugSearch} onChange={e => { setRetForm(f => ({ ...f, drugSearch: e.target.value })); }}
                className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Search..." />
              {retForm.drugSearch.length >= 2 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-32 overflow-y-auto">
                {drugMaster.search(retForm.drugSearch).slice(0, 5).map((d: any) => (
                  <button key={d.id} onClick={() => setRetForm(f => ({ ...f, drugId: d.id, drugName: d.drug_name || d.generic_name, drugSearch: '' }))}
                    className="w-full text-left px-2 py-1 text-[10px] hover:bg-h1-teal-light border-b">{d.drug_name || d.generic_name}</button>
                ))}
              </div>}
              {retForm.drugId && <div className="text-[10px] text-h1-teal mt-0.5">{retForm.drugName}</div>}
            </div>
            <div><label className="text-[9px] text-gray-500">Type</label>
              <select value={retForm.returnType} onChange={e => setRetForm(f => ({ ...f, returnType: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {['patient_return', 'supplier_return', 'expiry_write_off', 'damage'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Qty</label>
              <input type="number" value={retForm.quantity} onChange={e => setRetForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Batch</label>
              <input type="text" value={retForm.batchNumber} onChange={e => setRetForm(f => ({ ...f, batchNumber: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Reason</label>
              <input type="text" value={retForm.reason} onChange={e => setRetForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Reason" /></div>
            <div className="flex items-end"><button onClick={async () => {
              const r = await returns.processReturn({ drugId: retForm.drugId, quantity: parseInt(retForm.quantity), batchNumber: retForm.batchNumber, returnType: retForm.returnType as any, reason: retForm.reason, amount: parseFloat(retForm.amount) || 0, staffId });
              if (r.success) { flash('Return processed'); setRetForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', returnType: 'patient_return', reason: '', amount: '' }); }
              else flash(r.error || 'Failed');
            }} disabled={!retForm.drugId || !retForm.quantity || !retForm.reason}
              className="w-full py-1.5 bg-orange-600 text-white text-xs rounded disabled:opacity-40">Process</button></div>
          </div>
        </div>
        {/* Returns list */}
        {returns.loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
        returns.returns.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No returns processed</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Drug</th><th className="p-2">Type</th><th className="p-2">Qty</th><th className="p-2">Batch</th><th className="p-2">Reason</th><th className="p-2 text-right">Refund</th><th className="p-2">By</th><th className="p-2">Date</th>
          </tr></thead><tbody>{returns.returns.slice(0, 50).map((r: any) => (
            <tr key={r.id} className="border-b"><td className="p-2 font-medium">{r.drug?.drug_name}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${r.return_type === 'patient_return' ? 'bg-h1-teal-light text-h1-teal' : r.return_type === 'expiry_write_off' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{r.return_type?.replace(/_/g, ' ')}</span></td>
              <td className="p-2 text-center">{r.quantity}</td><td className="p-2 text-center text-gray-400">{r.batch_number}</td>
              <td className="p-2 text-gray-500 text-[10px]">{r.reason}</td>
              <td className="p-2 text-right font-bold">{parseFloat(r.refund_amount) > 0 ? `₹${fmt(parseFloat(r.refund_amount))}` : '—'}</td>
              <td className="p-2 text-[10px]">{r.staff?.full_name}</td>
              <td className="p-2 text-center text-gray-400 text-[10px]">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}
    </div>
  );
}

export default function PharmacyPage() { return <RoleGuard module="pharmacy"><PharmacyInner /></RoleGuard>; }
