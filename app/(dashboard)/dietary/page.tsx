'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDietary } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X, UtensilsCrossed } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const DIETS = ['regular', 'diabetic', 'renal', 'liquid', 'soft', 'npo', 'high_protein', 'low_salt', 'cardiac'];
const DIET_COLORS: Record<string, string> = { regular: 'h1-badge-green', diabetic: 'h1-badge-amber', renal: 'h1-badge-purple', liquid: 'h1-badge-blue', soft: 'h1-badge-gray', npo: 'h1-badge-red', high_protein: 'h1-badge-green', low_salt: 'h1-badge-amber', cardiac: 'h1-badge-red' };

function DietaryInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const { orders, meals, loading, stats, createOrder, serveMeal } = useDietary(centreId);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(''); const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [patSearch, setPatSearch] = useState(''); const [patResults, setPatResults] = useState<any[]>([]); const [selPat, setSelPat] = useState<any>(null);
  const [form, setForm] = useState({ diet_type: 'regular', special_instructions: '', allergies: '', calorie_target: '', protein_target: '' });

  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      // Search admitted patients
      const { data } = await sb().from('hmis_admissions').select('id, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years), ipd_number, bed:hmis_beds(name, room:hmis_rooms(name, ward:hmis_wards(name)))').eq('centre_id', centreId).eq('status', 'active').limit(10);
      const filtered = (data || []).filter((a: any) => {
        const q = patSearch.toLowerCase();
        return a.patient?.first_name?.toLowerCase().includes(q) || a.patient?.last_name?.toLowerCase().includes(q) || a.patient?.uhid?.toLowerCase().includes(q) || a.ipd_number?.toLowerCase().includes(q);
      });
      setPatResults(filtered);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch, centreId]);

  const handleCreateOrder = async () => {
    if (!selPat) return;
    const res = await createOrder({
      patient_id: selPat.patient?.id || selPat.patient_id, admission_id: selPat.id,
      ...form, allergies: form.allergies ? form.allergies.split(',').map((s: string) => s.trim()) : [],
      calorie_target: form.calorie_target ? parseInt(form.calorie_target) : null,
      protein_target: form.protein_target ? parseInt(form.protein_target) : null,
      meal_plan: { breakfast: true, lunch: true, dinner: true, snacks: true },
    }, staffId);
    if (res.success) { flash('Diet order created'); setShowNew(false); setSelPat(null); }
  };

  const handleServe = async (orderId: string, patientId: string, mealType: string) => {
    const res = await serveMeal({ diet_order_id: orderId, patient_id: patientId, meal_type: mealType, service_date: new Date().toISOString().split('T')[0] }, staffId);
    if (res.success) flash(`${mealType} served`);
  };

  const currentMeal = (() => { const h = new Date().getHours(); if (h < 10) return 'breakfast'; if (h < 15) return 'lunch'; if (h < 20) return 'dinner'; return 'snack'; })();

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Dietary & Kitchen</h1><p className="text-xs text-gray-400">{stats.activeOrders} orders · Current: {currentMeal}</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Diet Order</button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[{ l:'Active Orders', v:stats.activeOrders, c:'text-gray-800' }, { l:'Served Today', v:stats.mealsServed, c:'text-emerald-700' }, { l:'Pending', v:stats.mealsNotServed, c:stats.mealsNotServed > 0 ? 'text-amber-700' : 'text-gray-400' }, { l:'Current Meal', v:currentMeal, c:'text-teal-700' }, { l:'Diet Types', v:Object.keys(stats.byDietType).length, c:'text-blue-700' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black capitalize ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"><h3 className="text-xs font-bold text-gray-700">Active Diet Orders — {currentMeal} service</h3>
          <div className="flex gap-1">{Object.entries(stats.byDietType).map(([k, v]) => <span key={k} className={`h1-badge ${DIET_COLORS[k] || 'h1-badge-gray'} text-[8px] capitalize`}>{k.replace('_', ' ')} ({v as number})</span>)}</div>
        </div>
        <table className="h1-table"><thead><tr><th>Patient</th><th>Ward / Bed</th><th>Diet Type</th><th>Special Instructions</th><th>Allergies</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th></tr></thead>
          <tbody>{orders.map(o => {
            const bed = o.admission?.bed;
            const servedMeals = meals.filter((m: any) => m.diet_order_id === o.id).map((m: any) => m.meal_type);
            return (
              <tr key={o.id}>
                <td><div className="font-semibold">{o.patient?.first_name} {o.patient?.last_name}</div><div className="text-[10px] text-gray-400">{o.patient?.uhid}</div></td>
                <td className="text-[11px]">{bed?.room?.ward?.name || '—'} / {bed?.name || '—'}</td>
                <td><span className={`h1-badge ${DIET_COLORS[o.diet_type] || 'h1-badge-gray'} capitalize`}>{o.diet_type?.replace('_', ' ')}</span></td>
                <td className="text-[11px] text-gray-500 max-w-[200px] truncate">{o.special_instructions || '—'}</td>
                <td className="text-[10px]">{o.allergies?.length > 0 ? <span className="text-red-600 font-semibold">{o.allergies.join(', ')}</span> : '—'}</td>
                {['breakfast', 'lunch', 'dinner'].map(meal => (
                  <td key={meal} className="text-center">{servedMeals.includes(meal) ? <span className="text-emerald-600 font-bold text-sm">✓</span> : o.diet_type === 'npo' ? <span className="text-red-400 text-[9px]">NPO</span> : <button onClick={() => handleServe(o.id, o.patient_id, meal)} className="px-2.5 py-1.5 bg-teal-50 text-teal-700 text-[10px] rounded-lg font-semibold hover:bg-teal-100">Serve</button>}</td>
                ))}
              </tr>
            );
          })}{orders.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No active diet orders — admit patients and create diet orders</td></tr>}</tbody>
        </table>
      </div>

      {/* NEW DIET ORDER MODAL */}
      {showNew && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">New Diet Order</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
        <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Admitted Patient *</label>
          {selPat ? <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200 mt-1"><div className="font-bold">{selPat.patient?.first_name} {selPat.patient?.last_name}</div><div className="text-xs text-gray-500">{selPat.patient?.uhid} · IPD: {selPat.ipd_number}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
          : <div className="relative mt-1"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search admitted patient (name, UHID, IPD#)..." />{patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(a => <button key={a.id} onClick={() => { setSelPat(a); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{a.patient?.first_name} {a.patient?.last_name} · {a.patient?.uhid} · IPD: {a.ipd_number} · {a.bed?.room?.ward?.name}/{a.bed?.name}</button>)}</div>}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Diet Type *</label><div className="flex gap-1 mt-1 flex-wrap">{DIETS.map(d => (
            <button key={d} onClick={() => setForm(f => ({ ...f, diet_type: d }))} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold capitalize ${form.diet_type === d ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{d.replace('_', ' ')}</button>
          ))}</div></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Special Instructions</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-16 resize-none" value={form.special_instructions} onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))} placeholder="e.g. No salt, extra fluid, pureed food" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Food Allergies</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="e.g. Nuts, Gluten" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Calorie Target</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.calorie_target} onChange={e => setForm(f => ({ ...f, calorie_target: e.target.value }))} placeholder="e.g. 1800" /></div>
        </div>
        <button onClick={handleCreateOrder} disabled={!selPat} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create Diet Order</button>
      </div></div>}
    </div>
  );
}
export default function DietaryPage() { return <RoleGuard module="ipd"><DietaryInner /></RoleGuard>; }
