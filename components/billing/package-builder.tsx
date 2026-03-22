// components/billing/package-builder.tsx
// Build billing packages from real tariff items
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface PackageItem { tariffId: string; serviceName: string; category: string; rate: number; quantity: number; days: number; total: number; }
interface Package { id: string; name: string; description: string; roomCategory: string; los: number; items: PackageItem[]; gross: number; discount: number; net: number; isActive: boolean; }

interface Props { centreId: string; onFlash: (m: string) => void; }

export default function PackageBuilder({ centreId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // Builder state
  const [pkgName, setPkgName] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [roomCat, setRoomCat] = useState('economy');
  const [los, setLos] = useState(3);
  const [items, setItems] = useState<PackageItem[]>([]);
  const [discountPct, setDiscountPct] = useState(10);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);

  // Load existing packages
  useEffect(() => {
    if (!centreId || !sb()) { setLoading(false); return; }
    sb().from('hmis_packages').select('*').eq('centre_id', centreId).order('name')
      .then(({ data }: any) => {
        setPackages((data || []).map((p: any) => ({
          id: p.id, name: p.name, description: p.description || '',
          roomCategory: p.room_category || 'economy', los: p.expected_los || 3,
          items: p.items || [], gross: parseFloat(p.gross_amount || 0),
          discount: parseFloat(p.discount_amount || 0), net: parseFloat(p.net_amount || 0),
          isActive: p.is_active,
        })));
        setLoading(false);
      });
  }, [centreId]);

  // Search tariff
  useEffect(() => {
    if (search.length < 2 || !sb()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_tariff_master')
        .select('id, service_name, category, rate_self')
        .eq('centre_id', centreId).eq('is_active', true)
        .ilike('service_name', `%${search}%`).limit(8);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, centreId]);

  const addItem = (tariff: any, qty: number = 1, days: number = 1) => {
    const rate = parseFloat(tariff.rate_self || 0);
    setItems(prev => [...prev, {
      tariffId: tariff.id, serviceName: tariff.service_name, category: tariff.category,
      rate, quantity: qty, days, total: rate * qty * days,
    }]);
    setSearch(''); setResults([]);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.rate * updated.quantity * updated.days;
      return updated;
    }));
  };

  const gross = items.reduce((s, i) => s + i.total, 0);
  const discountAmt = Math.round(gross * discountPct / 100);
  const net = gross - discountAmt;

  // Quick-add common package components
  const quickAdd = async (searchTerm: string, qty: number = 1, days: number = 1) => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_tariff_master')
      .select('id, service_name, category, rate_self')
      .eq('centre_id', centreId).eq('is_active', true)
      .ilike('service_name', `%${searchTerm}%`).limit(1).maybeSingle();
    if (data) addItem(data, qty, days);
  };

  // Save package
  const savePackage = async () => {
    if (!pkgName || items.length === 0) return;
    const { error } = await sb().from('hmis_packages').insert({
      centre_id: centreId, name: pkgName, description: pkgDesc,
      room_category: roomCat, expected_los: los,
      items: items, gross_amount: gross, discount_amount: discountAmt,
      discount_percentage: discountPct, net_amount: net, is_active: true,
    });
    if (error) { onFlash(error.message); return; }
    onFlash(`Package saved: ${pkgName} — ${fmt(net)}`);
    setPkgName(''); setPkgDesc(''); setItems([]); setShowNew(false);
    // Reload
    const { data } = await sb().from('hmis_packages').select('*').eq('centre_id', centreId).order('name');
    setPackages((data || []).map((p: any) => ({ id: p.id, name: p.name, description: p.description || '', roomCategory: p.room_category || 'economy', los: p.expected_los || 3, items: p.items || [], gross: parseFloat(p.gross_amount || 0), discount: parseFloat(p.discount_amount || 0), net: parseFloat(p.net_amount || 0), isActive: p.is_active })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-bold text-sm">Package Builder</h2><p className="text-xs text-gray-500">Compose packages from tariff items — TKR, CABG, LSCS, etc.</p></div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg">{showNew ? 'Cancel' : '+ Build Package'}</button>
      </div>

      {/* Builder */}
      {showNew && <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Package Name *</label>
            <input type="text" value={pkgName} onChange={e => setPkgName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Total Knee Replacement (Economy)" /></div>
          <div><label className="text-xs text-gray-500">Room Category</label>
            <select value={roomCat} onChange={e => setRoomCat(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['economy', 'twin_sharing', 'special', 'deluxe', 'suite'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500">Expected LOS (days)</label>
            <input type="number" value={los} onChange={e => setLos(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border rounded-lg text-sm" min="1" /></div>
        </div>

        {/* Quick-add buttons */}
        <div><label className="text-xs text-gray-500 mb-1 block">Quick Add Components</label>
          <div className="flex flex-wrap gap-1">
            {[
              ['🛏️ Bed charges', 'Bed Charges', 1, los],
              ['👩‍⚕️ Nursing', 'Nursing Charges', 1, los],
              ['👨‍⚕️ MO Visit', 'Medical Officer', 1, los],
              ['🍽️ Diet', 'Diet Charges', 1, los],
              ['🔬 CBC', 'CBC', 1, 1], ['🔬 RBS', 'Random Blood Sugar', 1, 1],
              ['🔬 RFT', 'Renal Function', 1, 1], ['🔬 LFT', 'Liver Function', 1, 1],
              ['🩻 X-Ray', 'X-RAY CHEST', 1, 1], ['🩻 ECG', 'ECG', 1, 1],
              ['💊 Admission Kit', 'Admission Kit', 1, 1],
              ['🏥 Registration', 'Registration', 1, 1],
              ['🏥 OT Charges', 'OT Charges', 1, 1],
            ].map(([label, term, qty, days]) => (
              <button key={label as string} onClick={() => quickAdd(term as string, qty as number, days as number)}
                className="px-2 py-1 bg-gray-50 border rounded text-[9px] hover:bg-blue-50">{label as string}</button>
            ))}
          </div>
        </div>

        {/* Tariff search */}
        <div className="relative"><label className="text-xs text-gray-500">Search & Add Any Service</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-xs" placeholder="Search tariff: physiotherapy, dressing, ventilator..." />
          {results.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
            {results.map((t: any) => (
              <button key={t.id} onClick={() => addItem(t)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b flex justify-between">
                <span>{t.service_name} <span className="text-gray-400">({t.category?.replace('_', ' ')})</span></span>
                <span className="font-bold text-blue-600">{fmt(parseFloat(t.rate_self))}</span>
              </button>
            ))}
          </div>}
        </div>

        {/* Item table */}
        {items.length > 0 && <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Service</th><th className="p-2">Category</th><th className="p-2 w-16">Rate</th><th className="p-2 w-14">Qty</th><th className="p-2 w-14">Days</th><th className="p-2 w-20 text-right">Total</th><th className="p-2 w-8"></th>
          </tr></thead><tbody>{items.map((item, i) => (
            <tr key={i} className="border-b">
              <td className="p-2 font-medium">{item.serviceName}</td>
              <td className="p-2 text-center text-gray-400">{item.category?.replace('_', ' ')}</td>
              <td className="p-2 text-center">{fmt(item.rate)}</td>
              <td className="p-2"><input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} className="w-12 text-center border rounded px-1 py-0.5 text-[10px]" min="1" /></td>
              <td className="p-2"><input type="number" value={item.days} onChange={e => updateItem(i, 'days', parseInt(e.target.value) || 1)} className="w-12 text-center border rounded px-1 py-0.5 text-[10px]" min="1" /></td>
              <td className="p-2 text-right font-bold">{fmt(item.total)}</td>
              <td className="p-2"><button onClick={() => removeItem(i)} className="text-red-400">✕</button></td>
            </tr>
          ))}</tbody></table>
        </div>}

        {/* Totals + discount */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Gross: {fmt(gross)}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Discount:</span>
              <input type="number" value={discountPct} onChange={e => setDiscountPct(parseInt(e.target.value) || 0)} className="w-14 px-1 py-0.5 border rounded text-xs text-center" min="0" max="50" />
              <span className="text-xs text-gray-400">% = {fmt(discountAmt)}</span>
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700">Package: {fmt(net)}</div>
        </div>

        <div className="flex gap-3">
          <input type="text" value={pkgDesc} onChange={e => setPkgDesc(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-xs" placeholder="Description / inclusions / exclusions..." />
          <button onClick={savePackage} disabled={!pkgName || items.length === 0}
            className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Save Package</button>
        </div>
      </div>}

      {/* Existing packages */}
      {loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
      packages.length === 0 && !showNew ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No packages built yet. Click 'Build Package' to compose from tariff items.</div> :
      <div className="grid grid-cols-2 gap-3">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between mb-2">
              <div><div className="font-bold text-sm">{pkg.name}</div>
                <div className="text-[10px] text-gray-500">{pkg.description}</div>
                <div className="text-[10px] text-gray-400">{pkg.roomCategory?.replace('_', ' ')} | {pkg.los} days | {(pkg.items || []).length} items</div></div>
              <div className="text-right"><div className="text-lg font-bold text-blue-700">{fmt(pkg.net)}</div>
                {pkg.discount > 0 && <div className="text-[10px] text-gray-400 line-through">{fmt(pkg.gross)}</div>}</div>
            </div>
            {(pkg.items || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1">
              {(pkg.items as any[]).slice(0, 6).map((item: any, i: number) => (
                <span key={i} className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded">{item.serviceName?.substring(0, 25)} {fmt(item.total)}</span>
              ))}
              {(pkg.items as any[]).length > 6 && <span className="text-[8px] text-gray-400">+{(pkg.items as any[]).length - 6} more</span>}
            </div>}
          </div>
        ))}
      </div>}
    </div>
  );
}
