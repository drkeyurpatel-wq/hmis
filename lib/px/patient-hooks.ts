// lib/px/patient-hooks.ts
// Patient-facing hooks — no auth required, token-based access

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  PxTokenContext,
  FoodMenuItem,
  FoodOrder,
  FoodOrderItem,
  PxComplaint,
  NurseCall,
  PxFeedback,
  ComplaintCategory,
  NurseCallPriority,
} from './types';

const supabase = createClientComponentClient();

// ============================================================
// Token Validation
// ============================================================

export function usePxToken(token: string) {
  const [context, setContext] = useState<PxTokenContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    async function validate() {
      try {
        const { data, error: rpcError } = await supabase.rpc('px_validate_token', {
          p_token: token,
        });

        if (rpcError) throw rpcError;
        if (!data || data.length === 0) {
          setError('Invalid or expired token. Please scan the QR code on your wristband again.');
          setContext(null);
        } else {
          setContext(data[0]);
          setError(null);
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setError('Unable to verify your identity. Please contact the nursing station.');
      } finally {
        setLoading(false);
      }
    }

    validate();
  }, [token]);

  return { context, loading, error };
}

// ============================================================
// Food Menu
// ============================================================

export function useFoodMenu(centreId: string | undefined) {
  const [menu, setMenu] = useState<FoodMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;

    async function fetchMenu() {
      try {
        const { data, error } = await supabase
          .from('hmis_px_food_menu')
          .select('*')
          .eq('centre_id', centreId)
          .eq('is_available', true)
          .order('sort_order');

        if (error) throw error;
        setMenu(data || []);
      } catch (err) {
        console.error('Error fetching menu:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, [centreId]);

  // Filter by current time availability
  const availableNow = useCallback(() => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return menu.filter((item) => {
      if (!item.available_from || !item.available_until) return true; // always available
      return timeStr >= item.available_from && timeStr <= item.available_until;
    });
  }, [menu]);

  const categories = [...new Set(menu.map((m) => m.category))];

  return { menu, availableNow, categories, loading };
}

// ============================================================
// Food Cart & Ordering
// ============================================================

export function useFoodCart() {
  const [cart, setCart] = useState<Map<string, FoodOrderItem>>(new Map());

  const addItem = useCallback((item: FoodMenuItem, qty = 1) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, qty: existing.qty + qty });
      } else {
        next.set(item.id, {
          menu_item_id: item.id,
          name: item.name,
          qty,
          price: item.price,
          dietary_tags: item.dietary_tags,
        });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(menuItemId);
      return next;
    });
  }, []);

  const updateQty = useCallback((menuItemId: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(menuItemId);
      } else {
        const existing = next.get(menuItemId);
        if (existing) next.set(menuItemId, { ...existing, qty });
      }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);

  const items = Array.from(cart.values());
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return { cart, items, addItem, removeItem, updateQty, clearCart, totalAmount, itemCount };
}

export function useSubmitFoodOrder(context: PxTokenContext | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (items: FoodOrderItem[], totalAmount: number) => {
      if (!context) {
        setError('Session expired. Please scan QR again.');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const { data, error: insertError } = await supabase
          .from('hmis_px_food_orders')
          .insert({
            token_id: context.token_id,
            patient_id: context.patient_id,
            centre_id: context.centre_id,
            admission_id: context.admission_id,
            bed_label: context.bed_label,
            ward_name: context.ward_name,
            patient_name: context.patient_name,
            items: JSON.stringify(items),
            total_amount: totalAmount,
            status: 'pending',
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Log activity
        await supabase.from('hmis_px_activity_log').insert({
          token_id: context.token_id,
          centre_id: context.centre_id,
          patient_id: context.patient_id,
          activity_type: 'food_order',
          reference_id: data.id,
          details: { item_count: items.length, total: totalAmount },
          performed_by: 'patient',
        });

        return data.id;
      } catch (err) {
        console.error('Error submitting food order:', err);
        setError('Failed to place order. Please try again.');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [context]
  );

  return { submit, submitting, error };
}

// ============================================================
// Patient's Orders (tracking)
// ============================================================

export function useMyOrders(tokenId: string | undefined) {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchOrders = useCallback(async () => {
    if (!tokenId) return;
    try {
      const { data, error } = await supabase
        .from('hmis_px_food_orders')
        .select('*')
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    fetchOrders();
    // Poll every 15s for status updates
    intervalRef.current = setInterval(fetchOrders, 15000);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'nurse_rejected'].includes(o.status));

  return { orders, activeOrders, loading, refresh: fetchOrders };
}

// ============================================================
// Complaints
// ============================================================

export function useSubmitComplaint(context: PxTokenContext | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (category: ComplaintCategory, description: string, priority = 'normal') => {
      if (!context) {
        setError('Session expired.');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const { data, error: insertError } = await supabase
          .from('hmis_px_complaints')
          .insert({
            token_id: context.token_id,
            patient_id: context.patient_id,
            centre_id: context.centre_id,
            admission_id: context.admission_id,
            bed_label: context.bed_label,
            ward_name: context.ward_name,
            patient_name: context.patient_name,
            category,
            description,
            priority,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        await supabase.from('hmis_px_activity_log').insert({
          token_id: context.token_id,
          centre_id: context.centre_id,
          patient_id: context.patient_id,
          activity_type: 'complaint',
          reference_id: data.id,
          details: { category, priority },
          performed_by: 'patient',
        });

        return data.id;
      } catch (err) {
        console.error('Error submitting complaint:', err);
        setError('Failed to submit complaint. Please try again.');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [context]
  );

  return { submit, submitting, error };
}

export function useMyComplaints(tokenId: string | undefined) {
  const [complaints, setComplaints] = useState<PxComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) return;

    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('hmis_px_complaints')
          .select('*')
          .eq('token_id', tokenId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setComplaints(data || []);
      } catch (err) {
        console.error('Error fetching complaints:', err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [tokenId]);

  return { complaints, loading };
}

// ============================================================
// Nurse Calls
// ============================================================

export function useNurseCall(context: PxTokenContext | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const submit = useCallback(
    async (reason: string, priority: NurseCallPriority = 'routine', details?: string) => {
      if (!context) {
        setError('Session expired.');
        return null;
      }

      if (cooldown) {
        setError('Please wait 2 minutes between nurse calls.');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        // Check rate limit
        const { data: canCall } = await supabase.rpc('px_can_create_nurse_call', {
          p_token_id: context.token_id,
        });

        if (!canCall) {
          setError('You have a recent active call. Please wait for a response.');
          return null;
        }

        const { data, error: insertError } = await supabase
          .from('hmis_px_nurse_calls')
          .insert({
            token_id: context.token_id,
            patient_id: context.patient_id,
            centre_id: context.centre_id,
            admission_id: context.admission_id,
            bed_label: context.bed_label,
            ward_name: context.ward_name,
            patient_name: context.patient_name,
            reason,
            details,
            priority,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        await supabase.from('hmis_px_activity_log').insert({
          token_id: context.token_id,
          centre_id: context.centre_id,
          patient_id: context.patient_id,
          activity_type: 'nurse_call',
          reference_id: data.id,
          details: { reason, priority },
          performed_by: 'patient',
        });

        // Start cooldown
        setCooldown(true);
        setTimeout(() => setCooldown(false), 120000); // 2 min

        return data.id;
      } catch (err) {
        console.error('Error submitting nurse call:', err);
        setError('Failed to send nurse call. Please try again or use the bedside button.');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [context, cooldown]
  );

  return { submit, submitting, error, cooldown };
}

export function useMyNurseCalls(tokenId: string | undefined) {
  const [calls, setCalls] = useState<NurseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchCalls = useCallback(async () => {
    if (!tokenId) return;
    try {
      const { data, error } = await supabase
        .from('hmis_px_nurse_calls')
        .select('*')
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setCalls(data || []);
    } catch (err) {
      console.error('Error fetching nurse calls:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    fetchCalls();
    intervalRef.current = setInterval(fetchCalls, 10000); // poll every 10s
    return () => clearInterval(intervalRef.current);
  }, [fetchCalls]);

  const activeCalls = calls.filter((c) => ['pending', 'acknowledged', 'in_progress'].includes(c.status));

  return { calls, activeCalls, loading, refresh: fetchCalls };
}

// ============================================================
// Feedback
// ============================================================

export function useSubmitFeedback(context: PxTokenContext | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (data: {
      overall_rating: number;
      category_ratings: Record<string, number>;
      comments?: string;
      would_recommend?: boolean;
      is_public?: boolean;
    }) => {
      if (!context) {
        setError('Session expired.');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const { data: result, error: insertError } = await supabase
          .from('hmis_px_feedback')
          .insert({
            token_id: context.token_id,
            patient_id: context.patient_id,
            centre_id: context.centre_id,
            admission_id: context.admission_id,
            patient_name: context.patient_name,
            overall_rating: data.overall_rating,
            category_ratings: data.category_ratings,
            comments: data.comments || null,
            would_recommend: data.would_recommend ?? null,
            is_public: data.is_public ?? false,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        await supabase.from('hmis_px_activity_log').insert({
          token_id: context.token_id,
          centre_id: context.centre_id,
          patient_id: context.patient_id,
          activity_type: 'feedback',
          reference_id: result.id,
          details: { rating: data.overall_rating },
          performed_by: 'patient',
        });

        return result.id;
      } catch (err) {
        console.error('Error submitting feedback:', err);
        setError('Failed to submit feedback. Please try again.');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [context]
  );

  return { submit, submitting, error };
}
