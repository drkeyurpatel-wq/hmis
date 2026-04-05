'use client';
import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { Package, ArrowLeftRight } from 'lucide-react';
import {
  useLinenInventory, useLinenExchange, LINEN_TYPES, type LinenType,
} from '@/lib/linen/linen-hooks';

type Tab = 'inventory' | 'exchange' | 'alerts';

function LinenInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('inventory');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const inv = useLinenInventory(centreId);
  const ex = useLinenExchange(centreId);

  // Add inventory form
  const [showAdd, setShowAdd] = useState(false);
  const [invForm, setInvForm] = useState({ itemType: 'bedsheet', ward: '', totalQty: '', parLevel: '' });

  // Exchange form
  const [showExAdd, setShowExAdd] = useState(false);
  const [exForm, setExForm] = useState({ ward: '', itemType: 'bedsheet', exchangeType: 'routine', soiledCount: '', cleanReceived: '', damagedCount: '0', notes: '' });

  // Date filter for exchange
  const [exDate, setExDate] = useState(new Date().toISOString().split('T')[0]);

  const wards = [...new Set(inv.inventory.map(i => i.ward))].sort();

  const addItem = async () => {
    if (!invForm.ward || !invForm.totalQty) { flash('Ward and quantity required'); return; }
    await inv.addInventory({ itemType: invForm.itemType, ward: invForm.ward, totalQty: parseInt(invForm.totalQty), parLevel: invForm.parLevel ? parseInt(invForm.parLevel) : 0 });
    setInvForm({ itemType: 'bedsheet', ward: '', totalQty: '', parLevel: '' });
    setShowAdd(false); flash('Inventory updated');
  };

  const logExchange = async () => {
    if (!exForm.ward || (!exForm.soiledCount && !exForm.cleanReceived)) { flash('Ward and counts required'); return; }
    await ex.logExchange({
      ward: exForm.ward, itemType: exForm.itemType, exchangeType: exForm.exchangeType,
      soiledCount: parseInt(exForm.soiledCount || '0'), cleanReceived: parseInt(exForm.cleanReceived || '0'),
      damagedCount: parseInt(exForm.damagedCount || '0'), staffId, notes: exForm.notes,
    });
    setExForm({ ward: '', itemType: 'bedsheet', exchangeType: 'routine', soiledCount: '', cleanReceived: '', damagedCount: '0', notes: '' });
    setShowExAdd(false); inv.load(); flash('Exchange logged');
  };

  const shortages = inv.inventory.filter(i => i.par_level > 0 && i.in_circulation < i.par_level);
  const formatType = (t: string) => t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div><h1 className="text-xl font-bold">Linen Management</h1><p className="text-xs text-gray-500">Inventory, exchange log, shortage alerts</p></div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-teal-700">{inv.stats.totalItems}</div><div className="text-[10px] text-gray-500">Total Items</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-green-600">{inv.stats.inCirc}</div><div className="text-[10px] text-gray-500">In Circulation</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-blue-600">{inv.stats.inLaundry}</div><div className="text-[10px] text-gray-500">In Laundry</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-red-600">{inv.stats.damaged}</div><div className="text-[10px] text-gray-500">Damaged</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-amber-600">{inv.stats.shortages}</div><div className="text-[10px] text-gray-500">Shortages</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['inventory', 'Inventory'], ['exchange', 'Exchange Log'], ['alerts', `Alerts (${shortages.length})`]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-xs font-medium rounded-lg ${tab === k ? 'bg-white shadow text-teal-700' : 'text-gray-500'} cursor-pointer`}>{l}</button>
        ))}
      </div>

      {/* ===== INVENTORY ===== */}
      {tab === 'inventory' && <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg cursor-pointer">{showAdd ? 'Cancel' : '+ Add / Update'}</button>
        </div>
        {showAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">Add / Update Inventory</h3>
          <div className="grid grid-cols-4 gap-2">
            <select value={invForm.itemType} onChange={e => setInvForm(f => ({ ...f, itemType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {LINEN_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
            </select>
            <input value={invForm.ward} onChange={e => setInvForm(f => ({ ...f, ward: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Ward name *" list="wards-list" />
            <input type="number" value={invForm.totalQty} onChange={e => setInvForm(f => ({ ...f, totalQty: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Total Qty *" />
            <input type="number" value={invForm.parLevel} onChange={e => setInvForm(f => ({ ...f, parLevel: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Par Level" />
          </div>
          <datalist id="wards-list">{wards.map(w => <option key={w} value={w} />)}</datalist>
          <button onClick={addItem} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg cursor-pointer">Save</button>
        </div>}

        {/* Ward-wise inventory cards */}
        {[...inv.byWard.entries()].map(([ward, items]) => (
          <div key={ward} className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b font-bold text-sm">{ward}</div>
            <table className="w-full text-xs">
              <thead><tr className="border-b">
                <th className="p-2 text-left">Item</th><th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Circulation</th><th className="p-2 text-right">Laundry</th>
                <th className="p-2 text-right">Damaged</th><th className="p-2 text-right">Par Level</th><th className="p-2">Status</th>
              </tr></thead>
              <tbody>{items.map(i => {
                const shortage = i.par_level > 0 && i.in_circulation < i.par_level;
                return (
                  <tr key={i.id} className={`border-b ${shortage ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="p-2 font-medium capitalize">{formatType(i.item_type)}</td>
                    <td className="p-2 text-right">{i.total_qty}</td>
                    <td className="p-2 text-right font-medium text-green-700">{i.in_circulation}</td>
                    <td className="p-2 text-right text-blue-600">{i.in_laundry}</td>
                    <td className="p-2 text-right text-red-600">{i.damaged}</td>
                    <td className="p-2 text-right text-gray-500">{i.par_level || '—'}</td>
                    <td className="p-2 text-center">{shortage ? <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-700 font-medium">SHORTAGE</span> : <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-100 text-green-700">OK</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ))}
        {inv.inventory.length === 0 && <div className="bg-white rounded-2xl border p-8 text-center">
          {inv.loading ? <p className="text-sm text-gray-400">Loading...</p> : <div className="flex flex-col items-center gap-2">
            <Package size={32} className="text-gray-300" />
            <p className="text-sm text-gray-500 font-medium">No linen inventory records</p>
            <p className="text-xs text-gray-400 max-w-sm">Add initial stock counts to begin tracking linen across wards.</p>
            <button onClick={() => setShowAdd(true)} className="mt-2 px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700 cursor-pointer">+ Add / Update</button>
          </div>}
        </div>}
      </div>}

      {/* ===== EXCHANGE LOG ===== */}
      {tab === 'exchange' && <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input type="date" value={exDate} onChange={e => { setExDate(e.target.value); ex.load(e.target.value); }} className="px-3 py-1.5 border rounded-lg text-sm" />
          <div className="text-xs text-gray-500">Soiled: <b className="text-amber-600">{ex.todayStats.totalSoiled}</b> · Clean: <b className="text-green-600">{ex.todayStats.totalClean}</b> · Damaged: <b className="text-red-600">{ex.todayStats.totalDamaged}</b></div>
          <div className="flex-1" />
          <button onClick={() => setShowExAdd(!showExAdd)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg cursor-pointer">{showExAdd ? 'Cancel' : '+ Log Exchange'}</button>
        </div>

        {showExAdd && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">Log Linen Exchange</h3>
          <div className="grid grid-cols-4 gap-2">
            <input value={exForm.ward} onChange={e => setExForm(f => ({ ...f, ward: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Ward *" list="wards-list" />
            <select value={exForm.itemType} onChange={e => setExForm(f => ({ ...f, itemType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              {LINEN_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
            </select>
            <select value={exForm.exchangeType} onChange={e => setExForm(f => ({ ...f, exchangeType: e.target.value }))} className="px-2 py-2 border rounded-lg text-sm">
              <option value="routine">Routine</option><option value="discharge">Discharge</option><option value="emergency">Emergency</option>
            </select>
            <div />
            <div><label className="text-[9px] text-gray-500">Soiled Out</label><input type="number" value={exForm.soiledCount} onChange={e => setExForm(f => ({ ...f, soiledCount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
            <div><label className="text-[9px] text-gray-500">Clean Received</label><input type="number" value={exForm.cleanReceived} onChange={e => setExForm(f => ({ ...f, cleanReceived: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
            <div><label className="text-[9px] text-gray-500">Damaged</label><input type="number" value={exForm.damagedCount} onChange={e => setExForm(f => ({ ...f, damagedCount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
            <div><label className="text-[9px] text-gray-500">Notes</label><input value={exForm.notes} onChange={e => setExForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" /></div>
          </div>
          <button onClick={logExchange} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg cursor-pointer">Log Exchange</button>
        </div>}

        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Ward</th><th className="p-2">Item</th><th className="p-2">Type</th>
              <th className="p-2 text-right">Soiled</th><th className="p-2 text-right">Clean</th>
              <th className="p-2 text-right">Damaged</th><th className="p-2">By</th><th className="p-2">Notes</th>
            </tr></thead>
            <tbody>{ex.exchanges.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{e.ward}</td>
                <td className="p-2 text-center capitalize">{formatType(e.item_type)}</td>
                <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${e.exchange_type === 'emergency' ? 'bg-red-100 text-red-700' : e.exchange_type === 'discharge' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{e.exchange_type}</span></td>
                <td className="p-2 text-right text-amber-600 font-medium">{e.soiled_count || '—'}</td>
                <td className="p-2 text-right text-green-600 font-medium">{e.clean_received || '—'}</td>
                <td className="p-2 text-right text-red-600">{e.damaged_count || '—'}</td>
                <td className="p-2 text-center text-gray-500">{e.exchanger?.full_name || '—'}</td>
                <td className="p-2 text-gray-400">{e.notes || ''}</td>
              </tr>
            ))}</tbody>
          </table>
          {ex.exchanges.length === 0 && <div className="p-8 text-center">
            {ex.loading ? <p className="text-sm text-gray-400">Loading...</p> : <div className="flex flex-col items-center gap-2">
              <ArrowLeftRight size={28} className="text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No linen exchanges logged</p>
              <p className="text-xs text-gray-400 max-w-sm">Record daily linen exchanges between laundry and wards.</p>
              <button onClick={() => setShowExAdd(true)} className="mt-2 px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700 cursor-pointer">+ Log Exchange</button>
            </div>}
          </div>}
        </div>
      </div>}

      {/* ===== ALERTS ===== */}
      {tab === 'alerts' && <div className="space-y-3">
        <h3 className="font-bold text-sm">Shortage Alerts ({shortages.length})</h3>
        {shortages.length > 0 ? <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-red-50 border-b">
              <th className="p-2 text-left">Ward</th><th className="p-2">Item</th><th className="p-2 text-right">Available</th>
              <th className="p-2 text-right">Par Level</th><th className="p-2 text-right">Deficit</th>
            </tr></thead>
            <tbody>{shortages.map(i => (
              <tr key={i.id} className="border-b bg-red-50/50">
                <td className="p-2 font-medium">{i.ward}</td>
                <td className="p-2 capitalize">{formatType(i.item_type)}</td>
                <td className="p-2 text-right font-bold text-red-600">{i.in_circulation}</td>
                <td className="p-2 text-right text-gray-500">{i.par_level}</td>
                <td className="p-2 text-right font-bold text-red-700">{i.par_level - i.in_circulation}</td>
              </tr>
            ))}</tbody>
          </table>
        </div> : <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center text-sm text-green-700">No shortages — all wards above par levels</div>}

        {/* Damaged summary */}
        <h3 className="font-bold text-sm">Damaged Items Summary</h3>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Ward</th><th className="p-2">Item</th><th className="p-2 text-right">Damaged Count</th></tr></thead>
            <tbody>{inv.inventory.filter(i => i.damaged > 0).map(i => (
              <tr key={i.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{i.ward}</td>
                <td className="p-2 capitalize">{formatType(i.item_type)}</td>
                <td className="p-2 text-right font-bold text-red-600">{i.damaged}</td>
              </tr>
            ))}</tbody>
          </table>
          {inv.inventory.filter(i => i.damaged > 0).length === 0 && <div className="p-6 text-center text-gray-400 text-xs">No damaged items recorded</div>}
        </div>
      </div>}
    </div>
  );
}

export default function LinenPage() {
  return <RoleGuard module="settings"><LinenInner /></RoleGuard>;
}
