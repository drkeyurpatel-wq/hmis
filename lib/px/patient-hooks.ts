// lib/px/patient-hooks.ts
// Patient-facing hooks — no auth required, all operations via SECURITY DEFINER RPCs

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  PxTokenContext, FoodMenuItem, FoodOrder, FoodOrderItem,
  PxComplaint, NurseCall, ComplaintCategory, NurseCallPriority,
} from './types';

const supabase = createClient();

// ============================================================
// Token Validation
// ============================================================

export function usePxToken(token: string) {
  const [context, setContext] = useState<PxTokenContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('No token provided'); setLoading(false); return; }

    async function validate() {
      try {
        const { data, error: rpcError } = await supabase.rpc('px_validate_token', { p_token: token });
        if (rpcError) throw rpcError;
        if (!data || data.length === 0) {
          setError('Invalid or expired token. Please scan the QR code on your wristband again.');
          setContext(null);
        } else {
          setContext(data[0]);
          setError(null);
        }
      } catch (err: any) {
        console.error('Token validation error:', err);
        setError('Unable to verify your identity. Please contact the nursing station.');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  return { context, loading, error, token };
}

// ============================================================
// Food Menu (via RPC)
// ============================================================

export function useFoodMenu(centreId: string | undefined) {
  const [menu, setMenu] = useState<FoodMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;
    async function fetchMenu() {
      try {
        const { data, error } = await supabase.rpc('px_get_menu', { p_centre_id: centreId });
        if (error) throw error;
        setMenu(data || []);
      } catch (err) { console.error('Error fetching menu:', err); }
      finally { setLoading(false); }
    }
    fetchMenu();
  }, [centreId]);

  const availableNow = useCallback(() => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return menu.filter((item) => {
      if (!item.available_from || !item.available_until) return true;
      return timeStr >= item.available_from && timeStr <= item.available_until;
    });
  }, [menu]);

  const categories = [...new Set(menu.map((m) => m.category))];
  return { menu, availableNow, categories, loading };
}

// ============================================================
// Food Cart
// ============================================================

export function useFoodCart() {
  const [cart, setCart] = useState<Map<string, FoodOrderItem>>(new Map());

  const addItem = useCallback((item: FoodMenuItem, qty = 1) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) { next.set(item.id, { ...existing, qty: existing.qty + qty }); }
      else { next.set(item.id, { menu_item_id: item.id, name: item.name, qty, price: item.price, dietary_tags: item.dietary_tags }); }
      return next;
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setCart((prev) => { const next = new Map(prev); next.delete(menuItemId); return next; });
  }, []);

  const updateQty = useCallback((menuItemId: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) { next.delete(menuItemId); }
      else { const existing = next.get(menuItemId); if (existing) next.set(menuItemId, { ...existing, qty }); }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);
  const items = Array.from(cart.values());
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  return { cart, items, addItem, removeItem, updateQty, clearCart, totalAmount, itemCount };
}

// ============================================================
// Food Order Submission (via RPC)
// ============================================================

export function useSubmitFoodOrder(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (items: FoodOrderItem[], totalAmount: number) => {
    if (!token) { setError('Session expired. Please scan QR again.'); return null; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('px_create_food_order', {
        p_token: token, p_items: JSON.stringify(items), p_total_amount: totalAmount,
      });
      if (rpcError) throw rpcError;
      return data;
    } catch (err: any) {
      console.error('Error submitting food order:', err);
      setError(err.message?.includes('Invalid') ? 'Session expired. Please scan QR again.' : 'Failed to place order. Please try again.');
      return null;
    } finally { setSubmitting(false); }
  }, [token]);

  return { submit, submitting, error };
}

// ============================================================
// My Orders (via RPC)
// ============================================================

export function useMyOrders(token: string | undefined) {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('px_get_my_orders', { p_token: token });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) { console.error('Error fetching orders:', err); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(fetchOrders, 15000);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'nurse_rejected'].includes(o.status));
  return { orders, activeOrders, loading, refresh: fetchOrders };
}

// ============================================================
// Complaints (via RPC)
// ============================================================

export function useSubmitComplaint(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (category: ComplaintCategory, description: string, priority = 'normal') => {
    if (!token) { setError('Session expired.'); return null; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('px_create_complaint', {
        p_token: token, p_category: category, p_description: description, p_priority: priority,
      });
      if (rpcError) throw rpcError;
      return data;
    } catch (err: any) {
      console.error('Error submitting complaint:', err);
      setError('Failed to submit complaint. Please try again.');
      return null;
    } finally { setSubmitting(false); }
  }, [token]);

  return { submit, submitting, error };
}

export function useMyComplaints(token: string | undefined) {
  const [complaints, setComplaints] = useState<PxComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    async function fetch() {
      try {
        const { data, error } = await supabase.rpc('px_get_my_complaints', { p_token: token });
        if (error) throw error;
        setComplaints(data || []);
      } catch (err) { console.error('Error fetching complaints:', err); }
      finally { setLoading(false); }
    }
    fetch();
  }, [token]);

  return { complaints, loading };
}

// ============================================================
// Nurse Calls (via RPC)
// ============================================================

export function useNurseCall(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const submit = useCallback(async (reason: string, priority: NurseCallPriority = 'routine', details?: string) => {
    if (!token) { setError('Session expired.'); return null; }
    if (cooldown) { setError('Please wait 2 minutes between nurse calls.'); return null; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('px_create_nurse_call', {
        p_token: token, p_reason: reason, p_priority: priority, p_details: details || null,
      });
      if (rpcError) {
        if (rpcError.message?.includes('wait')) { setError('You have a recent active call. Please wait for a response.'); return null; }
        throw rpcError;
      }
      setCooldown(true);
      setTimeout(() => setCooldown(false), 120000);
      return data;
    } catch (err: any) {
      console.error('Error submitting nurse call:', err);
      setError('Failed to send nurse call. Please try again or use the bedside button.');
      return null;
    } finally { setSubmitting(false); }
  }, [token, cooldown]);

  return { submit, submitting, error, cooldown };
}

export function useMyNurseCalls(token: string | undefined) {
  const [calls, setCalls] = useState<NurseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchCalls = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('px_get_my_nurse_calls', { p_token: token });
      if (error) throw error;
      setCalls(data || []);
    } catch (err) { console.error('Error fetching nurse calls:', err); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchCalls();
    intervalRef.current = setInterval(fetchCalls, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchCalls]);

  const activeCalls = calls.filter((c) => ['pending', 'acknowledged', 'in_progress'].includes(c.status));
  return { calls, activeCalls, loading, refresh: fetchCalls };
}

// ============================================================
// Feedback (via RPC)
// ============================================================

export function useSubmitFeedback(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: {
    overall_rating: number;
    category_ratings: Record<string, number>;
    comments?: string;
    would_recommend?: boolean;
    is_public?: boolean;
  }) => {
    if (!token) { setError('Session expired.'); return null; }
    setSubmitting(true); setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc('px_submit_feedback', {
        p_token: token, p_overall_rating: data.overall_rating,
        p_category_ratings: data.category_ratings,
        p_comments: data.comments || null,
        p_would_recommend: data.would_recommend ?? null,
        p_is_public: data.is_public ?? false,
      });
      if (rpcError) throw rpcError;
      return result;
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
      return null;
    } finally { setSubmitting(false); }
  }, [token]);

  return { submit, submitting, error };
}
