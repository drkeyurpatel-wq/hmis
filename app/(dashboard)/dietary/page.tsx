'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDietary } from '@/lib/modules/module-hooks';
import { Plus, X, UtensilsCrossed } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

const DIETS = ['regular', 'diabetic', 'renal', 'liquid', 'soft', 'npo', 'high_protein', 'low_salt', 'cardiac'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DIET_COLORS: Record<string, string> = { regular: 'h1-badge-green', diabetic: 'h1-badge-amber', renal: 'h1-badge-purple', liquid: 'h1-badge-blue', soft: 'h1-badge-gray', npo: 'h1-badge-red', high_protein: 'h1-badge-green', low_salt: 'h1-badge-amber', cardiac: 'h1-badge-red' };

function DietaryInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { orders, meals, loading, stats, createOrder, serveMeal } = useDietary(centreId);
  const [tab, setTab] = useState<'orders' | 'service' | 'new'>('orders');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Serve meal
  const handleServe = async (orderId: string, patientId: string, mealType: string) => {
    const res = await serveMeal({ diet_order_id: orderId, patient_id: patientId, meal_type: mealType, service_date: new Date().toISOString().split('T')[0] }, staffId);
    if (res.success) flash(`${mealType} served`);
  };

  const currentMeal = (() => { const h = new Date().getHours(); if (h < 10) return 'breakfast'; if (h < 15) return 'lunch'; if (h < 20) return 'dinner'; return 'snack'; })();

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Dietary & Kitchen</h1><p className="text-xs text-gray-400">{stats.activeOrders} active diet orders · {stats.mealsServed} meals served today</p></div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Active Orders</div><div className="text-2xl font-black text-gray-800">{stats.activeOrders}</div></div>
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Served Today</div><div className="text-2xl font-black text-emerald-700">{stats.mealsServed}</div></div>
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Pending</div><div className="text-2xl font-black text-amber-700">{stats.mealsNotServed}</div></div>
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Current Meal</div><div className="text-lg font-black text-teal-700 capitalize">{currentMeal}</div></div>
        <div className="bg-white rounded-xl border px-3 py-3">
          <div className="text-[9px] text-gray-400 uppercase font-semibold mb-1">Diet Types</div>
          <div className="flex flex-wrap gap-1">{Object.entries(stats.byDietType).map(([k, v]) => <span key={k} className={`h1-badge ${DIET_COLORS[k] || 'h1-badge-gray'} text-[8px]`}>{k} ({v as number})</span>)}</div>
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"><h3 className="text-xs font-bold text-gray-700">Active Diet Orders</h3>
          <span className="text-[10px] text-gray-400">{currentMeal} service window</span></div>
        <table className="h1-table">
          <thead><tr><th>Patient</th><th>Ward / Bed</th><th>Diet Type</th><th>Special Instructions</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th></tr></thead>
          <tbody>
            {orders.map(o => {
              const bed = o.admission?.bed;
              const servedMeals = meals.filter((m: any) => m.diet_order_id === o.id).map((m: any) => m.meal_type);
              return (
                <tr key={o.id}>
                  <td><div className="font-semibold">{o.patient?.first_name} {o.patient?.last_name}</div><div className="text-[10px] text-gray-400">{o.patient?.uhid}</div></td>
                  <td className="text-[11px]">{bed?.room?.ward?.name || '—'} / {bed?.name || '—'}</td>
                  <td><span className={`h1-badge ${DIET_COLORS[o.diet_type] || 'h1-badge-gray'} capitalize`}>{o.diet_type?.replace('_', ' ')}</span></td>
                  <td className="text-[11px] text-gray-500 max-w-[200px] truncate">{o.special_instructions || '—'}</td>
                  {MEALS.slice(0, 3).map(meal => (
                    <td key={meal} className="text-center">
                      {servedMeals.includes(meal)
                        ? <span className="text-emerald-600 text-xs font-bold">✓</span>
                        : <button onClick={() => handleServe(o.id, o.patient_id, meal)} className="px-2 py-1 bg-teal-50 text-teal-700 text-[10px] rounded-lg font-medium hover:bg-teal-100">Serve</button>}
                    </td>
                  ))}
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No active diet orders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function DietaryPage() { return <RoleGuard module="ipd"><DietaryInner /></RoleGuard>; }
