'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDrugMaster, usePharmacyStock, useDispensingQueue, usePharmacyDashboard } from '@/lib/pharmacy/pharmacy-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtL = (n: number) => n >= 100000 ? `${(n/100000).toFixed(2)}L` : `${fmt(n)}`;

type Tab = 'dashboard'|'dispensing'|'drug_master'|'stock'|'batch'|'expiry'|'po'|'grn'|'transfers'|'controlled'|'returns';

function PharmacyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const drugMaster = useDrugMaster();
  const stock = usePharmacyStock(centreId);
  const dispensing = useDispensingQueue(centreId);
  const dashboard = usePharmacyDashboard(centreId);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

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
    ['dashboard','Dashboard','📊'],['dispensing','Dispensing','💊'],['drug_master','Drug Master','📋'],
    ['stock','Stock','📦'],['batch','Batch Tracker','🔢'],['expiry','Expiry Alert','⏰'],
    ['po','Purchase Orders','📝'],['grn','GRN','📥'],['transfers','Transfers','🔄'],
    ['controlled','Controlled Drugs','🔒'],['returns','Returns','↩️'],
  ];

  const daysToExpiry = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  const expiryColor = (d: string) => { const days = daysToExpiry(d); return days <= 0 ? 'text-red-700 bg-red-50' : days <= 30 ? 'text-red-600 bg-red-50' : days <= 90 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600'; };

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-3">
        <div><h1 className="text-xl font-bold text-gray-900">Pharmacy</h1><p className="text-xs text-gray-500">Drug dispensing, stock management, procurement</p></div>
      </div>

      <div className="flex gap-0.5 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k,l,icon]) => <button key={k} onClick={() => setTab(k)}
          className={`px-2 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 -mb-px ${tab===k?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{icon} {l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <div className="space-y-4">
        <div className="grid grid-cols-6 gap-3">
          {[['Dispensed Today',dashboard.todayDispensed,'text-blue-700','bg-blue-50'],
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
            <div className="flex justify-between text-sm"><span className="text-gray-500">Margin:</span><span className="font-bold text-blue-700">₹{fmtL(stock.totalMRPValue - stock.totalValue)}</span></div>
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
          <div key={rx.id} className="bg-white rounded-xl border p-4 hover:border-blue-300 cursor-pointer" onClick={() => setSelectedRx(rx)}>
            <div className="flex justify-between">
              <div><span className="font-semibold text-sm">{rx.patient?.first_name} {rx.patient?.last_name}</span><span className="text-xs text-gray-400 ml-2">{rx.patient?.uhid}</span></div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] ${rx.status==='pending'?'bg-yellow-100 text-yellow-700':rx.status==='dispensed'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{rx.status}</span>
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
                className="text-xs text-blue-600">+ Add Drug</button>
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
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b">{d.generic_name} {d.strength} ({d.formulation}) {d.brand_name ? `— ${d.brand_name}` : ''}</button>
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
              className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">{dispLoading ? 'Processing...' : 'Dispense (FEFO Auto-Pick)'}</button>
          </div>
        </div>}
      </div>}

      {/* ===== DRUG MASTER ===== */}
      {tab === 'drug_master' && <div className="space-y-3">
        <div className="flex gap-2"><input type="text" value={drugSearch} onChange={e => setDrugSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Search drugs..." />
          <button onClick={() => setShowAddDrug(!showAddDrug)} className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg">{showAddDrug?'Cancel':'+ Add Drug'}</button></div>
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
                <button key={f} onClick={() => setDrugForm(d => ({...d, formulation:f}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${drugForm.formulation===f?'bg-blue-600 text-white':'bg-white'}`}>{f}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Unit</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{['strip','vial','bottle','tube','ampoule','sachet','box','unit'].map(u => (
                <button key={u} onClick={() => setDrugForm(d => ({...d, unit:u}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${drugForm.unit===u?'bg-blue-600 text-white':'bg-white'}`}>{u}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Schedule</label>
              <div className="flex gap-0.5 mt-0.5">{['','H','H1','X'].map(s => (
                <button key={s} onClick={() => setDrugForm(d => ({...d, schedule:s, is_narcotic:s==='X'}))} className={`px-2 py-0.5 rounded text-[9px] border ${drugForm.schedule===s?'bg-blue-600 text-white':'bg-white'}`}>{s||'None'}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">GST %</label>
              <div className="flex gap-0.5 mt-0.5">{[0,5,12,18].map(g => (
                <button key={g} onClick={() => setDrugForm(d => ({...d, gst_rate:g}))} className={`px-2 py-0.5 rounded text-[9px] border ${drugForm.gst_rate===g?'bg-blue-600 text-white':'bg-white'}`}>{g}%</button>
              ))}</div></div>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={drugForm.is_antibiotic} onChange={e => setDrugForm(d => ({...d, is_antibiotic:e.target.checked}))} /> Antibiotic</label>
              <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={drugForm.is_narcotic} onChange={e => setDrugForm(d => ({...d, is_narcotic:e.target.checked}))} /> Narcotic</label>
            </div>
          </div>
          <button onClick={async () => { if (!drugForm.generic_name) return; await drugMaster.addDrug(drugForm); setShowAddDrug(false); flash('Drug added'); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Drug</button>
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
      {tab === 'stock' && <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={() => stock.load()} className="px-3 py-1.5 rounded-lg text-xs border bg-white">All Stock</button>
            <button onClick={() => stock.load({lowStock:true})} className="px-3 py-1.5 rounded-lg text-xs border bg-red-50 text-red-700">Low Stock ({stock.lowStock.length})</button>
            <button onClick={() => stock.load({expiringSoon:true})} className="px-3 py-1.5 rounded-lg text-xs border bg-orange-50 text-orange-700">Expiring ({stock.expiringSoon.length})</button>
          </div>
          <button onClick={() => setShowAddStock(!showAddStock)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showAddStock?'Cancel':'+ Add Stock'}</button>
        </div>
        {showAddStock && <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Drug *</label>
              <input type="text" value={stockDrugQ} onChange={e => setStockDrugQ(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search drug..." />
              {stockDrugResults.length > 0 && <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow z-10 mt-1 max-h-40 overflow-y-auto">{stockDrugResults.map(d => (
                <button key={d.id} onClick={() => { setStockForm(f => ({...f, drug_id:d.id, drug_name:d.generic_name})); setStockDrugQ(d.generic_name); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b">{d.generic_name} {d.strength} ({d.formulation})</button>
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
          }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Add Stock</button>
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
      {tab === 'batch' && <div className="space-y-3">
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
      {tab === 'expiry' && <div className="space-y-3">
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
      {tab === 'po' && <div className="text-center py-12 bg-white rounded-xl border text-gray-400"><div className="text-lg mb-2">Purchase Orders</div><div className="text-sm">Linked to VPMS. POs created in vendor system flow through integration bridge.</div></div>}
      {tab === 'grn' && <div className="text-center py-12 bg-white rounded-xl border text-gray-400"><div className="text-lg mb-2">Goods Receipt Note</div><div className="text-sm">GRN verification for incoming stock. Tables ready — UI next session.</div></div>}
      {tab === 'transfers' && <div className="text-center py-12 bg-white rounded-xl border text-gray-400"><div className="text-lg mb-2">Inter-Centre Stock Transfer</div><div className="text-sm">Transfer stock between Shilaj / Vastral / Modasa / Udaipur. Tables ready.</div></div>}
      {tab === 'controlled' && <div className="text-center py-12 bg-white rounded-xl border text-gray-400"><div className="text-lg mb-2">Controlled Substance Register</div><div className="text-sm">Schedule H, H1, X drug tracking. Every unit in/out logged with witness. Tables ready.</div></div>}
      {tab === 'returns' && <div className="text-center py-12 bg-white rounded-xl border text-gray-400"><div className="text-lg mb-2">Returns &amp; Write-offs</div><div className="text-sm">Patient returns, supplier returns, expiry write-off, damage. Tables ready.</div></div>}
    </div>
  );
}

export default function PharmacyPage() { return <RoleGuard module="pharmacy"><PharmacyInner /></RoleGuard>; }
