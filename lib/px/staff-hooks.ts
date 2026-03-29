// lib/px/staff-hooks.ts
// Staff-facing hooks — requires HMIS auth, centre-based RLS

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';
import type {
  FoodOrder,
  FoodOrderStatus,
  NurseCall,
  NurseCallStatus,
  PxComplaint,
  ComplaintStatus,
  PxFeedback,
  PxStats,
  FoodMenuItem,
} from './types';

// Lazy client — no module-level Supabase instantiation

// ============================================================
// Shared: Get current staff info
// ============================================================

export function useCurrentStaff() {
  const [staff, setStaff] = useState<{ id: string; name: string; centre_id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStaff() {
      try {
        const {
          data: { user },
        } = await sb()!.auth.getUser();
        if (!user) return;

        const { data } = await sb()!
          .from('hmis_staff')
          .select('id, full_name, staff_type, hmis_staff_centres(centre_id)')
          .eq('auth_user_id', user.id)
          .single();

        if (data) {
          const assignments = data.hmis_staff_centres as { centre_id: string }[];
          setStaff({
            id: data.id,
            name: data.full_name || '',
            centre_id: assignments?.[0]?.centre_id || '',
            role: data.staff_type,
          });
        }
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
  }, []);

  return { staff, loading };
}

// ============================================================
// Nursing Station: Nurse Calls Queue
// ============================================================

export function useNurseCallQueue(centreId: string | undefined, pollInterval = 5000) {
  const [calls, setCalls] = useState<NurseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchCalls = useCallback(async () => {
    if (!centreId) return;
    try {
      const { data, error } = await sb()!
        .from('hmis_px_nurse_calls')
        .select('*')
        .eq('centre_id', centreId)
        .in('status', ['pending', 'acknowledged', 'in_progress'])
        .order('priority', { ascending: true }) // emergency first (alphabetical: e < r < u doesn't work — we sort client-side)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Sort: emergency > urgent > routine, then oldest first
      const priorityOrder: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };
      const sorted = (data || []).sort((a, b) => {
        const pDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
        if (pDiff !== 0) return pDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setCalls(sorted);
    } catch (err) {
      console.error('Error fetching nurse calls:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    fetchCalls();
    intervalRef.current = setInterval(fetchCalls, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchCalls, pollInterval]);

  const updateCallStatus = useCallback(
    async (callId: string, status: NurseCallStatus, staffId: string) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

      if (status === 'acknowledged') {
        updates.acknowledged_by = staffId;
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'completed') {
        updates.completed_by = staffId;
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await sb()!.from('hmis_px_nurse_calls').update(updates).eq('id', callId);

      if (error) throw error;

      // Calculate response/resolution times
      const call = calls.find((c) => c.id === callId);
      if (call) {
        const created = new Date(call.created_at).getTime();
        const now = Date.now();
        if (status === 'acknowledged') {
          await sb()!
            .from('hmis_px_nurse_calls')
            .update({ response_seconds: Math.round((now - created) / 1000) })
            .eq('id', callId);
        } else if (status === 'completed') {
          await sb()!
            .from('hmis_px_nurse_calls')
            .update({ resolution_seconds: Math.round((now - created) / 1000) })
            .eq('id', callId);
        }
      }

      await fetchCalls();
    },
    [calls, fetchCalls]
  );

  return { calls, loading, refresh: fetchCalls, updateCallStatus };
}

// ============================================================
// Nursing Station: Food Order Approval Queue
// ============================================================

export function useFoodApprovalQueue(centreId: string | undefined, pollInterval = 10000) {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchOrders = useCallback(async () => {
    if (!centreId) return;
    try {
      const { data, error } = await sb()!
        .from('hmis_px_food_orders')
        .select('*')
        .eq('centre_id', centreId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching food approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(fetchOrders, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders, pollInterval]);

  const approveOrder = useCallback(
    async (orderId: string, nurseId: string, notes?: string) => {
      const { error } = await sb()!
        .from('hmis_px_food_orders')
        .update({
          status: 'nurse_approved' as FoodOrderStatus,
          nurse_id: nurseId,
          nurse_action_at: new Date().toISOString(),
          nurse_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    },
    [fetchOrders]
  );

  const rejectOrder = useCallback(
    async (orderId: string, nurseId: string, reason: string) => {
      const { error } = await sb()!
        .from('hmis_px_food_orders')
        .update({
          status: 'nurse_rejected' as FoodOrderStatus,
          nurse_id: nurseId,
          nurse_action_at: new Date().toISOString(),
          nurse_notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    },
    [fetchOrders]
  );

  return { orders, loading, refresh: fetchOrders, approveOrder, rejectOrder };
}

// ============================================================
// Kitchen Display: Approved Orders
// ============================================================

export function useKitchenQueue(centreId: string | undefined, pollInterval = 8000) {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchOrders = useCallback(async () => {
    if (!centreId) return;
    try {
      const { data, error } = await sb()!
        .from('hmis_px_food_orders')
        .select('*')
        .eq('centre_id', centreId)
        .in('status', ['nurse_approved', 'preparing', 'ready'])
        .order('nurse_action_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(fetchOrders, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders, pollInterval]);

  const updateOrderStatus = useCallback(
    async (orderId: string, status: FoodOrderStatus, kitchenNotes?: string) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

      if (status === 'preparing') updates.prepared_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();
      if (kitchenNotes) updates.kitchen_notes = kitchenNotes;

      const { error } = await sb()!.from('hmis_px_food_orders').update(updates).eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    },
    [fetchOrders]
  );

  return { orders, loading, refresh: fetchOrders, updateOrderStatus };
}

// ============================================================
// IPD Coordinator: All Requests Dashboard
// ============================================================

export function useCoordinatorDashboard(centreId: string | undefined) {
  const [stats, setStats] = useState<PxStats>({
    pending_food_orders: 0,
    active_nurse_calls: 0,
    open_complaints: 0,
    avg_rating: 0,
    total_feedback: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState<PxComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchDashboard = useCallback(async () => {
    if (!centreId) return;
    try {
      // Parallel queries for stats
      const [foodRes, callRes, complaintRes, feedbackRes, complaintsListRes] = await Promise.all([
        sb()!
          .from('hmis_px_food_orders')
          .select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId)
          .in('status', ['pending', 'nurse_approved', 'preparing']),
        sb()!
          .from('hmis_px_nurse_calls')
          .select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId)
          .in('status', ['pending', 'acknowledged', 'in_progress']),
        sb()!
          .from('hmis_px_complaints')
          .select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId)
          .in('status', ['open', 'assigned', 'in_progress']),
        sb()!
          .from('hmis_px_feedback')
          .select('overall_rating')
          .eq('centre_id', centreId),
        sb()!
          .from('hmis_px_complaints')
          .select('*')
          .eq('centre_id', centreId)
          .in('status', ['open', 'assigned', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const feedbackData = feedbackRes.data || [];
      const avgRating =
        feedbackData.length > 0
          ? feedbackData.reduce((sum, f) => sum + f.overall_rating, 0) / feedbackData.length
          : 0;

      setStats({
        pending_food_orders: foodRes.count || 0,
        active_nurse_calls: callRes.count || 0,
        open_complaints: complaintRes.count || 0,
        avg_rating: Math.round(avgRating * 10) / 10,
        total_feedback: feedbackData.length,
      });

      setRecentComplaints(complaintsListRes.data || []);
    } catch (err) {
      console.error('Error fetching coordinator dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 15000);
    return () => clearInterval(intervalRef.current);
  }, [fetchDashboard]);

  const updateComplaintStatus = useCallback(
    async (complaintId: string, status: ComplaintStatus, staffId: string, notes?: string) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

      if (status === 'assigned') {
        updates.assigned_to = staffId;
        updates.assigned_at = new Date().toISOString();
      } else if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        if (notes) updates.resolution_notes = notes;
      } else if (status === 'closed') {
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await sb()!.from('hmis_px_complaints').update(updates).eq('id', complaintId);
      if (error) throw error;
      await fetchDashboard();
    },
    [fetchDashboard]
  );

  return { stats, recentComplaints, loading, refresh: fetchDashboard, updateComplaintStatus };
}

// ============================================================
// Feedback Manager
// ============================================================

export function useFeedbackManager(centreId: string | undefined) {
  const [feedback, setFeedback] = useState<PxFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'no_response'>('all');

  const fetchFeedback = useCallback(async () => {
    if (!centreId) return;
    try {
      let query = sb()!
        .from('hmis_px_feedback')
        .select('*')
        .eq('centre_id', centreId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'positive') query = query.gte('overall_rating', 4);
      if (filter === 'negative') query = query.lte('overall_rating', 2);
      if (filter === 'no_response') query = query.is('staff_response', null);

      const { data, error } = await query;
      if (error) throw error;
      setFeedback(data || []);
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId, filter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const respondToFeedback = useCallback(
    async (feedbackId: string, response: string, staffId: string) => {
      const { error } = await sb()!
        .from('hmis_px_feedback')
        .update({
          staff_response: response,
          responded_by: staffId,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId);

      if (error) throw error;
      await fetchFeedback();
    },
    [fetchFeedback]
  );

  const markForGoogleReview = useCallback(
    async (feedbackId: string) => {
      const { error } = await sb()!
        .from('hmis_px_feedback')
        .update({
          google_review_status: 'prompted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId);

      if (error) throw error;
      await fetchFeedback();
    },
    [fetchFeedback]
  );

  return { feedback, loading, filter, setFilter, refresh: fetchFeedback, respondToFeedback, markForGoogleReview };
}

// ============================================================
// Food Menu Management (admin)
// ============================================================

export function useMenuManager(centreId: string | undefined) {
  const [items, setItems] = useState<FoodMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = useCallback(async () => {
    if (!centreId) return;
    try {
      const { data, error } = await sb()!
        .from('hmis_px_food_menu')
        .select('*')
        .eq('centre_id', centreId)
        .order('sort_order');

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const toggleAvailability = useCallback(
    async (itemId: string, available: boolean) => {
      const { error } = await sb()!
        .from('hmis_px_food_menu')
        .update({ is_available: available, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;
      await fetchMenu();
    },
    [fetchMenu]
  );

  const addMenuItem = useCallback(
    async (item: Partial<FoodMenuItem>) => {
      const { error } = await sb()!.from('hmis_px_food_menu').insert({
        ...item,
        centre_id: centreId,
      });

      if (error) throw error;
      await fetchMenu();
    },
    [centreId, fetchMenu]
  );

  return { items, loading, refresh: fetchMenu, toggleAvailability, addMenuItem };
}
