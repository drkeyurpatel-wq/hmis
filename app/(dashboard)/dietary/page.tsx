'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDietary, MEAL_SCHEDULE, DIET_TYPES, FOOD_PREFS, TEXTURES, getCurrentMeal, type DietOrder } from '@/lib/dietary/dietary-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const DIET_COLORS: Record<string, string> = { regular: 'bg-green-100 text-green-700', diabetic: 'bg-amber-100 text-amber-700', renal: 'bg-purple-100 text-purple-700', cardiac: 'bg-red-100 text-red-700', liver: 'bg-orange-100 text-orange-700', liquid: 'bg-blue-100 text-blue-700', clear_liquid: 'bg-blue-100 text-blue-700', soft: 'bg-teal-100 text-teal-700', npo: 'bg-red-600 text-white', high_protein: 'bg-green-100 text-green-700', low_sodium: 'bg-amber-100 text-amber-700', post_surgery: 'bg-indigo-100 text-indigo-700', tube_feed: 'bg-gray-100 text-gray-700' };
const PREF_COLORS: Record<string, string> = { veg: 'bg-green-600 text-white', nonveg: 'bg-red-600 text-white', egg: 'bg-amber-500 text-white', jain: 'bg-orange-500 text-white', vegan: 'bg-green-700 text-white' };
const PREF_ICONS: Record<string, string> = { veg: '🟢', nonveg: '🔴', egg: '🟡', jain: '🟠', vegan: '🟢' };

type Tab = 'service' | 'kitchen' | 'orders' | 'menu';

function DietaryInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const diet = useDietary(centreId);

  const [tab, setTab] = useState<Tab>('service');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [activeMeal, setActiveMeal] = useState(getCurrentMeal());
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showServe, setShowServe] = useState<DietOrder | null>(null);

  // Patient search (admitted only)
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selAdm, setSelAdm] = useState<any>(null);

  useEffect(() => {
    if (patSearch.length < 2 || !sb() || !centreId) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_admissions')
        .select(`id, ipd_number, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender),
          bed:hmis_beds!hmis_beds_current_admission_id_fkey(bed_number, room:hmis_rooms(room_number, ward:hmis_wards(name)))`)
        .eq('centre_id', centreId).eq('status', 'active');
      const q = patSearch.toLowerCase();
      const filtered = (data || []).filter((a: any) =>
        a.patient?.first_name?.toLowerCase().includes(q) || a.patient?.last_name?.toLowerCase().includes(q) ||
        a.patient?.uhid?.toLowerCase().includes(q) || a.ipd_number?.toLowerCase().includes(q)
      ).slice(0, 10);
      setPatResults(filtered);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch, centreId]);

  // Order form
  const [of, setOf] = useState({
    diet_type: 'regular', food_preference: 'veg', texture: 'normal',
    special_instructions: '', allergies: '', extra_items: '',
    calorie_target: '', protein_target: '', fluid_restriction_ml: '',
    sodium_restriction_mg: '',
    meal_plan: { early_tea: true, breakfast: true, mid_morning: true, lunch: true, evening_tea: true, dinner: true, bedtime: true },
  });

  // Serve form
  const [sf, setSf] = useState({ consumed: 'full', oral_intake_pct: '100', fluid_intake_ml: '', notes: '' });

  const handleCreateOrder = async () => {
    if (!selAdm) return;
    const res = await diet.createOrder({
      patient_id: selAdm.patient?.id, admission_id: selAdm.id,
      diet_type: of.diet_type, food_preference: of.food_preference, texture: of.texture,
      special_instructions: of.special_instructions,
      allergies: of.allergies ? of.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      extra_items: of.extra_items,
      calorie_target: of.calorie_target ? parseInt(of.calorie_target) : null,
      protein_target: of.protein_target ? parseInt(of.protein_target) : null,
      fluid_restriction_ml: of.fluid_restriction_ml ? parseInt(of.fluid_restriction_ml) : null,
      sodium_restriction_mg: of.sodium_restriction_mg ? parseInt(of.sodium_restriction_mg) : null,
      meal_plan: of.meal_plan,
    }, staffId);
    if (res.success) { flash('Diet order created'); setShowNewOrder(false); setSelAdm(null); }
  };

  const handleServe = async () => {
    if (!showServe) return;
    const res = await diet.serveMeal({
      diet_order_id: showServe.id, patient_id: showServe.patient_id,
      meal_type: activeMeal, service_date: new Date().toISOString().split('T')[0],
      consumed: sf.consumed, oral_intake_pct: parseInt(sf.oral_intake_pct) || 100,
      fluid_intake_ml: sf.fluid_intake_ml ? parseInt(sf.fluid_intake_ml) : null,
    }, staffId);
    if (res.success) { flash(`${activeMeal.replace('_', ' ')} served to ${showServe.patient_name}`); setShowServe(null); }
  };

  // Served meals set for current meal
  const servedSet = useMemo(() => new Set(diet.meals.filter(m => m.meal_type === activeMeal).map(m => m.diet_order_id)), [diet.meals, activeMeal]);

  // Orders for current meal
  const currentOrders = useMemo(() => diet.orders.filter(o => !o.fasting && o.diet_type !== 'npo' && o.meal_plan[activeMeal]), [diet.orders, activeMeal]);
  const pendingOrders = useMemo(() => currentOrders.filter(o => !servedSet.has(o.id)), [currentOrders, servedSet]);
  const servedOrders = useMemo(() => currentOrders.filter(o => servedSet.has(o.id)), [currentOrders, servedSet]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Dietary & Kitchen</h1>
          <p className="text-xs text-gray-500">{diet.stats.activeOrders} active orders · Current meal: {MEAL_SCHEDULE.find(m => m.key === diet.stats.currentMeal)?.label}</p></div>
        <button onClick={() => setShowNewOrder(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ New Diet Order</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { l: 'Active Orders', v: diet.stats.activeOrders },
          { l: 'Served Today', v: diet.stats.mealsServedToday },
          { l: 'Now Pending', v: diet.stats.currentPending, warn: diet.stats.currentPending > 0 },
          { l: 'NPO / Fasting', v: diet.stats.npo },
          { l: 'Fluid Restricted', v: diet.stats.fluidRestricted },
          { l: 'Avg Intake', v: diet.stats.avgIntake + '%' },
          { l: 'Veg / NV', v: `${diet.stats.byPref.veg || 0}/${diet.stats.byPref.nonveg || 0}` },
          { l: 'Jain', v: diet.stats.byPref.jain || 0 },
        ].map(k => <div key={k.l} className={`${k.warn ? 'bg-amber-50' : 'bg-white'} rounded-xl border p-2 text-center`}>
          <div className="text-[8px] text-gray-500 leading-tight">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      <div className="flex gap-1">
        {(['service', 'kitchen', 'orders', 'menu'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'service' ? `Meal Service (${pendingOrders.length} pending)` : t === 'kitchen' ? 'Kitchen Production' : t === 'orders' ? `Diet Orders (${diet.orders.length})` : `Menu (${diet.menuItems.length})`}
          </button>
        )}
      </div>

      {/* ═══ MEAL SERVICE TAB ═══ */}
      {tab === 'service' && <>
        {/* Meal time selector */}
        <div className="flex gap-1 overflow-x-auto pb-1">{MEAL_SCHEDULE.map(m => {
          const isCurrent = m.key === getCurrentMeal();
          const served = diet.meals.filter(ml => ml.meal_type === m.key).length;
          const total = diet.orders.filter(o => !o.fasting && o.diet_type !== 'npo' && o.meal_plan[m.key]).length;
          return (
            <button key={m.key} onClick={() => setActiveMeal(m.key)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-colors ${activeMeal === m.key ? 'bg-teal-600 text-white' : isCurrent ? 'bg-teal-50 border-teal-300 border' : 'bg-white border'}`}>
              <div className="font-medium">{m.label}</div>
              <div className="text-[9px] opacity-75">{m.time} · {served}/{total}</div>
            </button>
          );
        })}</div>

        {/* Pending */}
        {pendingOrders.length > 0 && <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-700">Pending ({pendingOrders.length})</h3>
          {pendingOrders.map(o => (
            <div key={o.id} className="bg-white rounded-xl border p-3 flex items-center justify-between hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-lg">{PREF_ICONS[o.food_preference]}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{o.patient_name}</span>
                    <span className="text-[10px] text-gray-400">{o.uhid}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${DIET_COLORS[o.diet_type] || 'bg-gray-100'}`}>{o.diet_type.replace('_', ' ')}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${PREF_COLORS[o.food_preference]}`}>{o.food_preference}</span>
                    {o.texture !== 'normal' && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{o.texture}</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {o.ward_name} / {o.bed_number}
                    {o.special_instructions && <span className="ml-2 text-amber-600">⚠ {o.special_instructions}</span>}
                    {o.allergies.length > 0 && <span className="ml-2 text-red-600 font-bold">Allergy: {o.allergies.join(', ')}</span>}
                    {o.extra_items && <span className="ml-2 text-teal-600">+ {o.extra_items}</span>}
                    {o.fluid_restriction_ml && <span className="ml-2 text-purple-600">Fluid: ≤{o.fluid_restriction_ml}ml/day</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowServe(o); setSf({ consumed: 'full', oral_intake_pct: '100', fluid_intake_ml: '', notes: '' }); }}
                className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">Serve</button>
            </div>
          ))}
        </div>}

        {/* NPO patients */}
        {diet.orders.filter(o => o.diet_type === 'npo' || o.fasting).length > 0 && <div className="space-y-1">
          <h3 className="text-xs font-bold text-red-600">NPO / Fasting ({diet.orders.filter(o => o.diet_type === 'npo' || o.fasting).length})</h3>
          {diet.orders.filter(o => o.diet_type === 'npo' || o.fasting).map(o => (
            <div key={o.id} className="bg-red-50 rounded-lg p-2 flex items-center gap-3 text-xs">
              <span className="text-red-600 font-bold">NPO</span>
              <span className="font-medium">{o.patient_name}</span>
              <span className="text-gray-400">{o.ward_name}/{o.bed_number}</span>
              <span className="text-red-500">{o.npo_reason || 'Pre-surgery / Doctor ordered'}</span>
            </div>
          ))}
        </div>}

        {/* Served */}
        {servedOrders.length > 0 && <div className="space-y-1">
          <h3 className="text-xs font-bold text-green-700">Served ({servedOrders.length})</h3>
          {servedOrders.map(o => {
            const meal = diet.meals.find(m => m.diet_order_id === o.id && m.meal_type === activeMeal);
            return (
              <div key={o.id} className="bg-green-50 rounded-lg p-2 flex items-center gap-3 text-xs">
                <span className="text-green-600 font-bold">✓</span>
                <span className="font-medium">{o.patient_name}</span>
                <span className="text-gray-400">{o.ward_name}/{o.bed_number}</span>
                <span className={`${PREF_COLORS[o.food_preference]} text-[8px] px-1 py-0.5 rounded`}>{o.food_preference}</span>
                {meal && <span className="text-gray-500">{meal.consumed} · {meal.oral_intake_pct}% eaten{meal.fluid_intake_ml ? ` · ${meal.fluid_intake_ml}ml fluid` : ''}</span>}
              </div>
            );
          })}
        </div>}
      </>}

      {/* ═══ KITCHEN PRODUCTION TAB ═══ */}
      {tab === 'kitchen' && <div className="space-y-4">
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Meal</th><th className="p-2">Time</th>
            <th className="p-2">🟢 Veg</th><th className="p-2">🔴 Non-veg</th><th className="p-2">🟠 Jain</th>
            <th className="p-2 font-bold">Total</th>
            {Object.keys(diet.stats.byDiet).slice(0, 5).map(d => <th key={d} className="p-2 capitalize text-[10px]">{d.replace('_', ' ')}</th>)}
          </tr></thead><tbody>{MEAL_SCHEDULE.map(m => {
            const c = diet.productionCounts[m.key];
            const isCurrent = m.key === getCurrentMeal();
            return (
              <tr key={m.key} className={`border-b ${isCurrent ? 'bg-teal-50 font-medium' : ''}`}>
                <td className="p-2 font-medium">{m.label} {isCurrent && <span className="text-[8px] bg-teal-600 text-white px-1 py-0.5 rounded ml-1">NOW</span>}</td>
                <td className="p-2 text-center text-gray-500">{m.time}</td>
                <td className="p-2 text-center font-bold text-green-700">{c?.veg || 0}</td>
                <td className="p-2 text-center font-bold text-red-700">{c?.nonveg || 0}</td>
                <td className="p-2 text-center font-bold text-orange-700">{c?.jain || 0}</td>
                <td className="p-2 text-center font-black">{(c?.veg || 0) + (c?.nonveg || 0) + (c?.jain || 0)}</td>
                {Object.keys(diet.stats.byDiet).slice(0, 5).map(d => <td key={d} className="p-2 text-center text-[10px]">{c?.byDiet[d] || 0}</td>)}
              </tr>
            );
          })}</tbody></table>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold mb-3">Ward-wise count ({MEAL_SCHEDULE.find(m => m.key === getCurrentMeal())?.label})</h3>
            {Object.entries(diet.stats.byWard).sort((a: any, b: any) => b[1] - a[1]).map(([ward, count]) => (
              <div key={ward} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                <span>{ward}</span><span className="font-bold">{count as number}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold mb-3">Diet type distribution</h3>
            {Object.entries(diet.stats.byDiet).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize w-24 text-center ${DIET_COLORS[type] || 'bg-gray-100'}`}>{type.replace('_', ' ')}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${((count as number) / Math.max(1, diet.stats.activeOrders)) * 100}%` }} /></div>
                <span className="text-xs font-bold w-6 text-right">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ═══ ORDERS TAB ═══ */}
      {tab === 'orders' && (diet.orders.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No active diet orders</div>
        : <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Patient</th><th className="p-2">Ward/Bed</th>
            <th className="p-2">Diet</th><th className="p-2">Pref</th><th className="p-2">Texture</th>
            <th className="p-2">Restrictions</th><th className="p-2">Special</th>
            <th className="p-2">Allergies</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{diet.orders.map(o => (
            <tr key={o.id} className={`border-b hover:bg-gray-50 ${o.diet_type === 'npo' ? 'bg-red-50/30' : ''}`}>
              <td className="p-2"><div className="font-medium">{o.patient_name}</div><div className="text-[10px] text-gray-400">{o.uhid} · {o.ipd_number}</div></td>
              <td className="p-2 text-center text-[10px]">{o.ward_name}<div className="font-bold">{o.bed_number}</div></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${DIET_COLORS[o.diet_type] || 'bg-gray-100'}`}>{o.diet_type.replace('_', ' ')}</span></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${PREF_COLORS[o.food_preference]}`}>{PREF_ICONS[o.food_preference]} {o.food_preference}</span></td>
              <td className="p-2 text-center">{o.texture !== 'normal' ? <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{o.texture}</span> : '—'}</td>
              <td className="p-2 text-[10px]">
                {o.calorie_target && <div>Cal: {o.calorie_target} kcal</div>}
                {o.fluid_restriction_ml && <div className="text-purple-600">Fluid: ≤{o.fluid_restriction_ml} ml</div>}
                {o.sodium_restriction_mg && <div className="text-amber-600">Na: ≤{o.sodium_restriction_mg} mg</div>}
                {!o.calorie_target && !o.fluid_restriction_ml && !o.sodium_restriction_mg && '—'}
              </td>
              <td className="p-2 text-[10px] max-w-[150px] truncate">{o.special_instructions || o.extra_items || '—'}</td>
              <td className="p-2 text-center">{o.allergies.length > 0 ? <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{o.allergies.join(', ')}</span> : '—'}</td>
              <td className="p-2">
                <div className="flex gap-0.5">
                  {o.diet_type !== 'npo' && <button onClick={() => diet.updateOrder(o.id, { diet_type: 'npo', npo_reason: 'Doctor ordered' })} className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">NPO</button>}
                  {o.diet_type === 'npo' && <button onClick={() => diet.updateOrder(o.id, { diet_type: 'regular' })} className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Resume</button>}
                  <button onClick={() => diet.updateOrder(o.id, { status: 'discontinued' })} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">D/C</button>
                </div>
              </td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* ═══ MENU TAB ═══ */}
      {tab === 'menu' && <div className="space-y-4">
        {['dal', 'rice', 'roti', 'sabzi', 'main_course', 'soup', 'snack', 'curd_raita', 'beverage', 'fruit', 'dessert'].map(cat => {
          const items = diet.menuItems.filter(i => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-bold mb-2 capitalize">{cat.replace('_', ' / ')}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <span className="text-sm">{PREF_ICONS[item.food_type]}</span>
                    <div className="flex-1">
                      <div className="text-xs font-medium">{item.item_name}</div>
                      {item.item_name_gujarati && <div className="text-[9px] text-gray-400">{item.item_name_gujarati}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold">{item.calories_kcal} kcal</div>
                      <div className="text-[9px] text-gray-400">P:{item.protein_g}g</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>}

      {/* ═══ NEW ORDER MODAL ═══ */}
      {showNewOrder && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewOrder(false)}>
        <div className="bg-white rounded-xl w-[600px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">New Diet Order</h3><button onClick={() => setShowNewOrder(false)} className="text-gray-400 text-lg">×</button></div>

          {selAdm ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
            <span className="font-medium">{selAdm.patient?.first_name} {selAdm.patient?.last_name}</span>
            <span className="text-xs text-gray-500">{selAdm.patient?.uhid} · IPD: {selAdm.ipd_number}</span>
            <button onClick={() => setSelAdm(null)} className="ml-auto text-xs text-red-500">×</button>
          </div> : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search admitted patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(a => {
              const bed = Array.isArray(a.bed) ? a.bed[0] : a.bed;
              return <button key={a.id} onClick={() => { setSelAdm(a); setPatSearch(''); setPatResults([]); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{a.patient?.first_name} {a.patient?.last_name} · {a.patient?.uhid} · {bed?.room?.ward?.name}/{bed?.bed_number}</button>;
            })}</div>}</div>}

          {/* Diet type */}
          <div><label className="text-[9px] text-gray-500">Diet type *</label>
            <div className="flex gap-1 mt-1 flex-wrap">{DIET_TYPES.map(d =>
              <button key={d} onClick={() => setOf(f => ({...f, diet_type: d}))} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-medium capitalize ${of.diet_type === d ? (DIET_COLORS[d] || 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{d.replace('_', ' ')}</button>
            )}</div>
          </div>

          {/* Food preference */}
          <div><label className="text-[9px] text-gray-500">Food preference *</label>
            <div className="flex gap-1 mt-1">{FOOD_PREFS.map(p =>
              <button key={p} onClick={() => setOf(f => ({...f, food_preference: p}))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold capitalize ${of.food_preference === p ? PREF_COLORS[p] : 'bg-gray-100 text-gray-500'}`}>{PREF_ICONS[p]} {p}</button>
            )}</div>
          </div>

          {/* Texture */}
          <div><label className="text-[9px] text-gray-500">Texture</label>
            <div className="flex gap-1 mt-1">{TEXTURES.map(t =>
              <button key={t} onClick={() => setOf(f => ({...f, texture: t}))} className={`flex-1 py-1.5 rounded-lg text-[10px] capitalize ${of.texture === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
            )}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Special instructions</label><input value={of.special_instructions} onChange={e => setOf(f => ({...f, special_instructions: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="No onion, extra curd, less oil..." /></div>
            <div><label className="text-[9px] text-gray-500">Allergies (comma-separated)</label><input value={of.allergies} onChange={e => setOf(f => ({...f, allergies: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nuts, Milk, Gluten..." /></div>
            <div><label className="text-[9px] text-gray-500">Calorie target (kcal/day)</label><input type="number" value={of.calorie_target} onChange={e => setOf(f => ({...f, calorie_target: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1800" /></div>
            <div><label className="text-[9px] text-gray-500">Protein target (g/day)</label><input type="number" value={of.protein_target} onChange={e => setOf(f => ({...f, protein_target: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="60" /></div>
            <div><label className="text-[9px] text-gray-500">Fluid restriction (ml/day)</label><input type="number" value={of.fluid_restriction_ml} onChange={e => setOf(f => ({...f, fluid_restriction_ml: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 1000 (leave blank for no restriction)" /></div>
            <div><label className="text-[9px] text-gray-500">Sodium restriction (mg/day)</label><input type="number" value={of.sodium_restriction_mg} onChange={e => setOf(f => ({...f, sodium_restriction_mg: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 2000" /></div>
          </div>

          {/* Meal plan */}
          <div><label className="text-[9px] text-gray-500">Meals included</label>
            <div className="flex gap-1 mt-1 flex-wrap">{MEAL_SCHEDULE.map(m =>
              <label key={m.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer ${of.meal_plan[m.key as keyof typeof of.meal_plan] ? 'bg-teal-50 text-teal-700 font-medium' : 'bg-gray-50 text-gray-400'}`}>
                <input type="checkbox" checked={of.meal_plan[m.key as keyof typeof of.meal_plan]} onChange={() => setOf(f => ({...f, meal_plan: {...f.meal_plan, [m.key]: !f.meal_plan[m.key as keyof typeof f.meal_plan]}}))} className="rounded" />
                {m.label}
              </label>
            )}</div>
          </div>

          <button onClick={handleCreateOrder} disabled={!selAdm} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Create Diet Order</button>
        </div>
      </div>}

      {/* ═══ SERVE MODAL ═══ */}
      {showServe && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowServe(null)}>
        <div className="bg-white rounded-xl w-[400px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm">Serve {MEAL_SCHEDULE.find(m => m.key === activeMeal)?.label}</h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs">
            <div className="font-medium">{showServe.patient_name} <span className="text-gray-400">{showServe.uhid}</span></div>
            <div className="flex gap-2 mt-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${DIET_COLORS[showServe.diet_type]}`}>{showServe.diet_type.replace('_', ' ')}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${PREF_COLORS[showServe.food_preference]}`}>{PREF_ICONS[showServe.food_preference]} {showServe.food_preference}</span>
              {showServe.texture !== 'normal' && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{showServe.texture}</span>}
            </div>
            {showServe.special_instructions && <div className="mt-1 text-amber-600">⚠ {showServe.special_instructions}</div>}
            {showServe.allergies.length > 0 && <div className="mt-1 text-red-600 font-bold">⛔ Allergy: {showServe.allergies.join(', ')}</div>}
            {showServe.fluid_restriction_ml && <div className="mt-1 text-purple-600">Fluid: ≤{showServe.fluid_restriction_ml} ml/day</div>}
            <div className="mt-1 text-gray-500">{showServe.ward_name} / Bed {showServe.bed_number}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Consumption</label><select value={sf.consumed} onChange={e => setSf(f => ({...f, consumed: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="full">Full</option><option value="partial">Partial</option><option value="refused">Refused</option></select></div>
            <div><label className="text-[9px] text-gray-500">Intake %</label><select value={sf.oral_intake_pct} onChange={e => setSf(f => ({...f, oral_intake_pct: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {[100, 75, 50, 25, 10, 0].map(p => <option key={p} value={String(p)}>{p}%</option>)}</select></div>
          </div>
          {showServe.fluid_restriction_ml && <div><label className="text-[9px] text-gray-500">Fluid intake this meal (ml)</label>
            <input type="number" value={sf.fluid_intake_ml} onChange={e => setSf(f => ({...f, fluid_intake_ml: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 150" /></div>}

          <button onClick={handleServe} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium hover:bg-teal-700">Mark Served</button>
        </div>
      </div>}
    </div>
  );
}

export default function DietaryPage() { return <RoleGuard module="ipd"><DietaryInner /></RoleGuard>; }
