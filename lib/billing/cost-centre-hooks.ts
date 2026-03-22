// lib/billing/cost-centre-hooks.ts
// Hooks for cost centre CRUD, mapping resolution, and P&L data

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// TYPES
// ============================================================
export interface CostCentre {
  id: string;
  code: string;
  name: string;
  type: 'revenue' | 'expense' | 'overhead' | 'shared';
  parent_id: string | null;
  gl_revenue_account_id: string | null;
  gl_expense_account_id: string | null;
  budget_monthly: number;
  is_active: boolean;
}

export interface CostCentreMap {
  id: string;
  cost_centre_id: string;
  cost_centre?: { code: string; name: string };
  match_type: 'department' | 'tariff_category' | 'bill_type';
  match_value: string;
  priority: number;
  is_active: boolean;
}

export interface CostCentreExpense {
  id: string;
  cost_centre_id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  reference_number: string;
}

export interface PnLRow {
  costCentreId: string;
  costCentreCode: string;
  costCentreName: string;
  costCentreType: string;
  revenue: number;
  expenses: number;
  margin: number;
  marginPct: number;
  budgetMonthly: number;
  budgetVariance: number;
  revenueByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
}

// ============================================================
// COST CENTRE MASTER HOOK
// ============================================================
export function useCostCentres(centreId: string | null) {
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [maps, setMaps] = useState<CostCentreMap[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [ccRes, mapRes] = await Promise.all([
      sb().from('hmis_cost_centres').select('*').eq('centre_id', centreId).order('code'),
      sb().from('hmis_cost_centre_maps')
        .select('*, cost_centre:hmis_cost_centres(code, name)')
        .eq('centre_id', centreId).order('priority', { ascending: false }),
    ]);
    setCostCentres(ccRes.data || []);
    setMaps(mapRes.data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const saveCostCentre = useCallback(async (cc: Partial<CostCentre> & { id?: string }) => {
    if (!centreId || !sb()) return { error: 'No centre' };
    if (cc.id) {
      const { error } = await sb().from('hmis_cost_centres')
        .update({ name: cc.name, code: cc.code, type: cc.type, parent_id: cc.parent_id || null,
          gl_revenue_account_id: cc.gl_revenue_account_id || null,
          gl_expense_account_id: cc.gl_expense_account_id || null,
          budget_monthly: cc.budget_monthly || 0, updated_at: new Date().toISOString() })
        .eq('id', cc.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await sb().from('hmis_cost_centres')
        .insert({ centre_id: centreId, name: cc.name, code: cc.code, type: cc.type || 'revenue',
          parent_id: cc.parent_id || null,
          gl_revenue_account_id: cc.gl_revenue_account_id || null,
          gl_expense_account_id: cc.gl_expense_account_id || null,
          budget_monthly: cc.budget_monthly || 0, is_active: true });
      if (error) return { error: error.message };
    }
    load();
    return { error: null };
  }, [centreId, load]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    if (!sb()) return;
    await sb().from('hmis_cost_centres').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
    setCostCentres(prev => prev.map(c => c.id === id ? { ...c, is_active: isActive } : c));
  }, []);

  const saveMap = useCallback(async (map: Partial<CostCentreMap> & { id?: string }) => {
    if (!centreId || !sb()) return { error: 'No centre' };
    if (map.id) {
      const { error } = await sb().from('hmis_cost_centre_maps')
        .update({ cost_centre_id: map.cost_centre_id, match_type: map.match_type, match_value: map.match_value, priority: map.priority || 0 })
        .eq('id', map.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await sb().from('hmis_cost_centre_maps')
        .insert({ centre_id: centreId, cost_centre_id: map.cost_centre_id, match_type: map.match_type, match_value: map.match_value, priority: map.priority || 0, is_active: true });
      if (error) return { error: error.message };
    }
    load();
    return { error: null };
  }, [centreId, load]);

  const deleteMap = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_cost_centre_maps').delete().eq('id', id);
    setMaps(prev => prev.filter(m => m.id !== id));
  }, []);

  return { costCentres, maps, loading, load, saveCostCentre, toggleActive, saveMap, deleteMap };
}

// ============================================================
// RESOLVE COST CENTRE — called during billing
// ============================================================
export async function resolveCostCentre(
  centreId: string,
  context: { departmentId?: string; departmentName?: string; tariffCategory?: string; billType?: string }
): Promise<string | null> {
  if (!sb()) return null;

  // Fetch active maps for this centre, ordered by priority desc
  const { data: maps } = await sb().from('hmis_cost_centre_maps')
    .select('cost_centre_id, match_type, match_value, priority')
    .eq('centre_id', centreId).eq('is_active', true)
    .order('priority', { ascending: false });

  if (!maps || maps.length === 0) return null;

  // Try matching in priority order
  for (const map of maps) {
    if (map.match_type === 'department' && context.departmentName &&
        map.match_value.toLowerCase() === context.departmentName.toLowerCase()) {
      return map.cost_centre_id;
    }
    if (map.match_type === 'department' && context.departmentId &&
        map.match_value === context.departmentId) {
      return map.cost_centre_id;
    }
    if (map.match_type === 'tariff_category' && context.tariffCategory &&
        map.match_value.toLowerCase() === context.tariffCategory.toLowerCase()) {
      return map.cost_centre_id;
    }
    if (map.match_type === 'bill_type' && context.billType &&
        map.match_value.toLowerCase() === context.billType.toLowerCase()) {
      return map.cost_centre_id;
    }
  }

  return null;
}

// ============================================================
// P&L HOOK — live profit & loss by cost centre
// ============================================================
export function usePnL(centreId: string | null) {
  const [rows, setRows] = useState<PnLRow[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, margin: 0, marginPct: 0 });
  const [loading, setLoading] = useState(false);

  const loadPnL = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    // Fetch cost centres, bill items with cost_centre_id, and expenses in parallel
    const [ccRes, itemsRes, expensesRes, unmappedRes] = await Promise.all([
      sb().from('hmis_cost_centres').select('id, code, name, type, budget_monthly')
        .eq('centre_id', centreId).eq('is_active', true).order('code'),
      sb().from('hmis_bill_items')
        .select('cost_centre_id, net_amount, description, bill:hmis_bills!inner(bill_date, centre_id, status)')
        .eq('bill.centre_id', centreId)
        .gte('bill.bill_date', dateFrom).lte('bill.bill_date', dateTo)
        .neq('bill.status', 'cancelled'),
      sb().from('hmis_cost_centre_expenses')
        .select('cost_centre_id, amount, category')
        .eq('centre_id', centreId)
        .gte('expense_date', dateFrom).lte('expense_date', dateTo),
      // Also get revenue from bills without cost_centre_id on items (fallback grouping by bill_type)
      sb().from('hmis_bills')
        .select('id, bill_type, net_amount, bill_date')
        .eq('centre_id', centreId)
        .gte('bill_date', dateFrom).lte('bill_date', dateTo)
        .neq('status', 'cancelled'),
    ]);

    const costCentres = ccRes.data || [];
    const items = itemsRes.data || [];
    const expenses = expensesRes.data || [];

    // Build P&L rows
    const ccMap: Record<string, PnLRow> = {};
    for (const cc of costCentres) {
      ccMap[cc.id] = {
        costCentreId: cc.id, costCentreCode: cc.code, costCentreName: cc.name,
        costCentreType: cc.type, revenue: 0, expenses: 0, margin: 0, marginPct: 0,
        budgetMonthly: cc.budget_monthly || 0, budgetVariance: 0,
        revenueByCategory: {}, expenseByCategory: {},
      };
    }

    // Add "Unmapped" bucket
    ccMap['__unmapped'] = {
      costCentreId: '__unmapped', costCentreCode: 'UNMAP', costCentreName: 'Unmapped Revenue',
      costCentreType: 'revenue', revenue: 0, expenses: 0, margin: 0, marginPct: 0,
      budgetMonthly: 0, budgetVariance: 0, revenueByCategory: {}, expenseByCategory: {},
    };

    // Revenue from mapped bill items
    for (const item of items) {
      const ccId = item.cost_centre_id || '__unmapped';
      const row = ccMap[ccId] || ccMap['__unmapped'];
      const amt = parseFloat(item.net_amount) || 0;
      row.revenue += amt;
      const cat = item.description?.split(' ')[0] || 'Other';
      row.revenueByCategory[cat] = (row.revenueByCategory[cat] || 0) + amt;
    }

    // If no items have cost_centre_id at all, fall back to bill-level revenue
    const mappedRevenue = items.filter(i => i.cost_centre_id).length;
    if (mappedRevenue === 0 && (unmappedRes.data || []).length > 0) {
      for (const bill of (unmappedRes.data || [])) {
        const amt = parseFloat(bill.net_amount) || 0;
        ccMap['__unmapped'].revenue += amt;
        const bt = bill.bill_type || 'other';
        ccMap['__unmapped'].revenueByCategory[bt] = (ccMap['__unmapped'].revenueByCategory[bt] || 0) + amt;
      }
    }

    // Expenses
    for (const exp of expenses) {
      const row = ccMap[exp.cost_centre_id] || ccMap['__unmapped'];
      const amt = parseFloat(String(exp.amount)) || 0;
      row.expenses += amt;
      row.expenseByCategory[exp.category] = (row.expenseByCategory[exp.category] || 0) + amt;
    }

    // Compute margins
    const result: PnLRow[] = [];
    let totalRev = 0, totalExp = 0;
    for (const row of Object.values(ccMap)) {
      if (row.revenue === 0 && row.expenses === 0 && row.costCentreId === '__unmapped') continue;
      row.margin = row.revenue - row.expenses;
      row.marginPct = row.revenue > 0 ? Math.round((row.margin / row.revenue) * 1000) / 10 : 0;
      row.budgetVariance = row.expenses > 0 ? row.budgetMonthly - row.expenses : 0;
      totalRev += row.revenue;
      totalExp += row.expenses;
      result.push(row);
    }

    result.sort((a, b) => b.revenue - a.revenue);
    setRows(result);
    setTotals({
      revenue: totalRev, expenses: totalExp,
      margin: totalRev - totalExp,
      marginPct: totalRev > 0 ? Math.round(((totalRev - totalExp) / totalRev) * 1000) / 10 : 0,
    });
    setLoading(false);
  }, [centreId]);

  // Expense CRUD
  const addExpense = useCallback(async (expense: Omit<CostCentreExpense, 'id'> & { staffId?: string }) => {
    if (!centreId || !sb()) return { error: 'No centre' };
    const { error } = await sb().from('hmis_cost_centre_expenses').insert({
      centre_id: centreId, cost_centre_id: expense.cost_centre_id,
      expense_date: expense.expense_date, category: expense.category,
      description: expense.description, amount: expense.amount,
      vendor: expense.vendor || null, reference_number: expense.reference_number || null,
      created_by: expense.staffId || null,
    });
    return { error: error?.message || null };
  }, [centreId]);

  return { rows, totals, loading, loadPnL, addExpense };
}
