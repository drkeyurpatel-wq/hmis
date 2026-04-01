'use client';
// lib/collect/useARTasks.ts
// Hook for daily task list and quick actions.

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ARTask } from './ar-types';

export function useARTasks(centreId: string | null, staffId: string | null) {
  const [tasks, setTasks] = useState<ARTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await sb().rpc('get_ar_daily_tasks', {
      p_centre_id: centreId,
      p_staff_id: staffId || null,
    });
    if (err) { setError(err.message); setTasks([]); }
    else { setTasks(rows || []); }
    setLoading(false);
  }, [centreId, staffId]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total: tasks.length,
    openQueries: tasks.filter(t => t.has_open_query).length,
    critical: tasks.filter(t => t.priority === 'critical').length,
    dueTodayCount: tasks.filter(t => t.next_followup_date && t.next_followup_date <= new Date().toISOString().split('T')[0]).length,
  };

  return { tasks, loading, error, stats, refetch: load };
}

// Quick follow-up logger
export function useLogFollowup() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logFollowup = useCallback(async (input: {
    claimId: string;
    actionType: string;
    contactedPerson?: string;
    description: string;
    outcome?: string;
    nextFollowupDate?: string;
    amountPromised?: number;
    staffId: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('ar_claim_followups').insert({
      claim_id: input.claimId,
      action_type: input.actionType,
      contacted_person: input.contactedPerson || null,
      description: input.description,
      outcome: input.outcome || null,
      next_followup_date: input.nextFollowupDate || null,
      amount_promised: input.amountPromised || null,
      created_by: input.staffId,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    return true;
  }, []);

  return { logFollowup, saving, error };
}

// Quick priority/assignment update
export function useUpdateClaim() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateClaim = useCallback(async (claimId: string, updates: {
    priority?: string;
    assigned_to?: string;
    next_followup_date?: string;
    status?: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('hmis_claims').update(updates).eq('id', claimId);
    setSaving(false);
    if (err) { setError(err.message); return false; }
    return true;
  }, []);

  return { updateClaim, saving, error };
}
