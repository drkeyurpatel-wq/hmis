// lib/dietary/dietary-hooks.ts — Indian hospital dietary management
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export const MEAL_SCHEDULE = [
  { key: 'early_tea', label: 'Early Tea', time: '6:00 AM', hour: 6 },
  { key: 'breakfast', label: 'Breakfast', time: '8:00 AM', hour: 8 },
  { key: 'mid_morning', label: 'Mid Morning', time: '10:30 AM', hour: 10 },
  { key: 'lunch', label: 'Lunch', time: '12:30 PM', hour: 12 },
  { key: 'evening_tea', label: 'Evening Tea', time: '4:00 PM', hour: 16 },
  { key: 'dinner', label: 'Dinner', time: '7:30 PM', hour: 19 },
  { key: 'bedtime', label: 'Bedtime', time: '9:00 PM', hour: 21 },
];

export const DIET_TYPES = ['regular', 'diabetic', 'renal', 'cardiac', 'liver', 'liquid', 'clear_liquid', 'soft', 'npo', 'high_protein', 'low_sodium', 'post_surgery', 'tube_feed'];
export const FOOD_PREFS = ['veg', 'nonveg', 'egg', 'jain', 'vegan'];
export const TEXTURES = ['normal', 'soft', 'pureed', 'liquid', 'minced'];

export function getCurrentMeal(): string {
  const h = new Date().getHours();
  if (h < 7) return 'early_tea'; if (h < 9) return 'breakfast'; if (h < 11) return 'mid_morning';
  if (h < 14) return 'lunch'; if (h < 17) return 'evening_tea'; if (h < 20) return 'dinner';
  return 'bedtime';
}

export interface DietOrder {
  id: string; patient_id: string; patient_name: string; uhid: string;
  admission_id: string; ipd_number: string; bed_number: string; ward_name: string;
  diet_type: string; food_preference: string; texture: string;
  special_instructions: string; allergies: string[]; extra_items: string;
  calorie_target: number | null; protein_target: number | null;
  fluid_restriction_ml: number | null; sodium_restriction_mg: number | null;
  meal_plan: Record<string, boolean>;
  fasting: boolean; npo_from: string | null; npo_reason: string;
  status: string; ordered_by_name: string; created_at: string;
}

export interface MealService {
  id: string; diet_order_id: string; patient_id: string; patient_name: string;
  meal_type: string; service_date: string; items_served: any[];
  total_calories: number | null; fluid_intake_ml: number | null;
  oral_intake_pct: number | null; consumed: string;
  served_by_name: string; served_at: string;
}

// ── Main Hook ──
export function useDietary(centreId: string | null) {
  const [orders, setOrders] = useState<DietOrder[]>([]);
  const [meals, setMeals] = useState<MealService[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [oRes, mRes, miRes] = await Promise.all([
      sb().from('hmis_diet_orders')
        .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid),
          admission:hmis_admissions!inner(ipd_number,
            bed:hmis_beds!hmis_beds_current_admission_id_fkey(bed_number, room:hmis_rooms(room_number, ward:hmis_wards(name)))),
          orderer:hmis_staff!hmis_diet_orders_ordered_by_fkey(full_name)`)
        .eq('centre_id', centreId).eq('status', 'active'),
      sb().from('hmis_meal_service')
        .select(`*, patient:hmis_patients(first_name, last_name),
          server:hmis_staff!hmis_meal_service_served_by_fkey(full_name)`)
        .eq('centre_id', centreId).eq('service_date', today),
      sb().from('hmis_menu_master').select('*').eq('centre_id', centreId).eq('is_active', true).order('category').order('item_name'),
    ]);

    setOrders((oRes.data || []).map((o: any) => {
      const bedArr = Array.isArray(o.admission?.bed) ? o.admission.bed : o.admission?.bed ? [o.admission.bed] : [];
      const bed = bedArr[0];
      return {
        id: o.id, patient_id: o.patient_id,
        patient_name: `${o.patient?.first_name || ''} ${o.patient?.last_name || ''}`.trim(),
        uhid: o.patient?.uhid || '',
        admission_id: o.admission_id, ipd_number: o.admission?.ipd_number || '',
        bed_number: bed?.bed_number || '—', ward_name: bed?.room?.ward?.name || '—',
        diet_type: o.diet_type || 'regular', food_preference: o.food_preference || 'veg',
        texture: o.texture || 'normal',
        special_instructions: o.special_instructions || o.instructions || '',
        allergies: o.allergies || [], extra_items: o.extra_items || '',
        calorie_target: o.calorie_target, protein_target: o.protein_target,
        fluid_restriction_ml: o.fluid_restriction_ml,
        sodium_restriction_mg: o.sodium_restriction_mg,
        meal_plan: o.meal_plan || { early_tea: true, breakfast: true, mid_morning: true, lunch: true, evening_tea: true, dinner: true, bedtime: true },
        fasting: o.fasting || false, npo_from: o.npo_from, npo_reason: o.npo_reason || '',
        status: o.status, ordered_by_name: o.orderer?.full_name || '', created_at: o.created_at,
      };
    }));

    setMeals((mRes.data || []).map((m: any) => ({
      id: m.id, diet_order_id: m.diet_order_id, patient_id: m.patient_id,
      patient_name: `${m.patient?.first_name || ''} ${m.patient?.last_name || ''}`.trim(),
      meal_type: m.meal_type, service_date: m.service_date,
      items_served: m.items_served || m.menu_items || [],
      total_calories: m.total_calories, fluid_intake_ml: m.fluid_intake_ml,
      oral_intake_pct: m.oral_intake_pct, consumed: m.consumed || 'full',
      served_by_name: m.server?.full_name || '', served_at: m.served_at,
    })));

    setMenuItems(miRes.data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createOrder = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_diet_orders').insert({
      centre_id: centreId, ordered_by: staffId,
      effective_from: new Date().toISOString(), ...data,
    });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateOrder = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_diet_orders').update(data).eq('id', id);
    load();
  }, [load]);

  const serveMeal = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_meal_service').insert({
      centre_id: centreId, served_by: staffId, served_at: new Date().toISOString(), ...data,
    });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const stats = useMemo(() => {
    const currentMeal = getCurrentMeal();
    const mealServedSet = new Set(meals.map(m => `${m.diet_order_id}-${m.meal_type}`));

    // Count by diet type
    const byDiet: Record<string, number> = {};
    const byPref: Record<string, number> = {};
    const byWard: Record<string, number> = {};
    orders.forEach(o => {
      byDiet[o.diet_type] = (byDiet[o.diet_type] || 0) + 1;
      byPref[o.food_preference] = (byPref[o.food_preference] || 0) + 1;
      byWard[o.ward_name] = (byWard[o.ward_name] || 0) + 1;
    });

    // Current meal pending
    const currentPending = orders.filter(o =>
      !o.fasting && o.diet_type !== 'npo' && o.meal_plan[currentMeal] &&
      !mealServedSet.has(`${o.id}-${currentMeal}`)
    );

    const totalFluidRestricted = orders.filter(o => o.fluid_restriction_ml !== null).length;
    const todayIntake = meals.reduce((s, m) => s + (m.oral_intake_pct || 0), 0);

    return {
      activeOrders: orders.length,
      mealsServedToday: meals.length,
      currentMeal,
      currentPending: currentPending.length,
      npo: orders.filter(o => o.diet_type === 'npo' || o.fasting).length,
      fluidRestricted: totalFluidRestricted,
      byDiet, byPref, byWard,
      avgIntake: meals.length > 0 ? Math.round(todayIntake / meals.length) : 0,
    };
  }, [orders, meals]);

  // Kitchen production counts
  const productionCounts = useMemo(() => {
    const counts: Record<string, { veg: number; nonveg: number; jain: number; byDiet: Record<string, number>; byTexture: Record<string, number> }> = {};
    MEAL_SCHEDULE.forEach(m => {
      counts[m.key] = { veg: 0, nonveg: 0, jain: 0, byDiet: {}, byTexture: {} };
    });
    orders.forEach(o => {
      if (o.diet_type === 'npo' || o.fasting) return;
      Object.entries(o.meal_plan).forEach(([meal, enabled]) => {
        if (!enabled || !counts[meal]) return;
        const c = counts[meal];
        if (o.food_preference === 'veg' || o.food_preference === 'vegan') c.veg++;
        else if (o.food_preference === 'jain') c.jain++;
        else c.nonveg++;
        c.byDiet[o.diet_type] = (c.byDiet[o.diet_type] || 0) + 1;
        c.byTexture[o.texture] = (c.byTexture[o.texture] || 0) + 1;
      });
    });
    return counts;
  }, [orders]);

  return { orders, meals, menuItems, loading, stats, productionCounts, load, createOrder, updateOrder, serveMeal };
}
