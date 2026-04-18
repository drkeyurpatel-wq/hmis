// lib/claims/store.ts — Centralized Claims State (Zustand + Supabase Realtime)
// All claims pages read from this store. Mutations auto-invalidate.

import { create } from 'zustand';
import { sb } from '@/lib/supabase/browser';
import {
  fetchClaimStats, fetchClaims, fetchClaim, fetchPayers,
  fetchOpenQueries, fetchRejections, fetchClaimTimeline,
  fetchClaimQueries, fetchClaimDocuments, fetchDocChecklist,
  updateClaim, addClaimQuery, recordSettlement, uploadClaimDocument,
} from './api';
import { notifyClaimStatusChange } from './notifications';
import type { ClaimStatus, ClaimType } from './types';

// ═══ Types ═══

interface ClaimsState {
  // ─── Shared Data ───
  centreId: string | null;
  stats: any | null;
  payers: any[];
  payersLoaded: boolean;

  // ─── Dashboard ───
  claims: any[];
  claimsLoading: boolean;

  // ─── Detail ───
  activeClaim: any | null;
  activeTimeline: any[];
  activeQueries: any[];
  activeDocuments: any[];
  activeChecklist: any[];
  detailLoading: boolean;

  // ─── Query Centre ───
  openQueries: any[];
  rejections: any[];
  queriesLoading: boolean;

  // ─── Realtime ───
  realtimeChannel: any | null;
  lastUpdate: number;

  // ─── Actions ───
  init: (centreId: string) => Promise<void>;
  refreshStats: () => Promise<void>;
  loadClaims: (filters?: { statuses?: ClaimStatus[]; payer_id?: string; claim_type?: ClaimType; search?: string }) => Promise<void>;
  loadClaimDetail: (claimId: string) => Promise<void>;
  loadQueryCentre: () => Promise<void>;

  // ─── Mutations (auto-invalidate) ───
  transitionStatus: (claimId: string, newStatus: ClaimStatus, extras?: Record<string, any>) => Promise<boolean>;
  submitQuery: (params: { claim_id: string; query_text: string; query_category: string; priority: string; routed_to_role?: string }) => Promise<boolean>;
  respondToQuery: (queryId: string, responseText: string, staffId?: string) => Promise<boolean>;
  settleClaimAction: (params: { claim_id: string; settlement_amount: number; deduction_amount?: number; utr_number?: string; payment_mode?: string }) => Promise<boolean>;
  uploadDoc: (params: { claim_id: string; file: File; document_name: string; document_category: string }) => Promise<boolean>;
  inlineUpdateClaim: (claimId: string, field: string, value: any) => Promise<boolean>;

  // ─── Realtime ───
  subscribeRealtime: (centreId: string) => void;
  unsubscribeRealtime: () => void;

  // ─── Internal ───
  _invalidateAll: () => Promise<void>;
  _invalidateDetail: (claimId: string) => Promise<void>;
}

// ═══ Store ═══

export const useClaimsStore = create<ClaimsState>((set, get) => ({
  centreId: null,
  stats: null,
  payers: [],
  payersLoaded: false,
  claims: [],
  claimsLoading: false,
  activeClaim: null,
  activeTimeline: [],
  activeQueries: [],
  activeDocuments: [],
  activeChecklist: [],
  detailLoading: false,
  openQueries: [],
  rejections: [],
  queriesLoading: false,
  realtimeChannel: null,
  lastUpdate: 0,

  // ─── Initialize (called once per session) ───
  init: async (centreId: string) => {
    if (get().centreId === centreId && get().payersLoaded) return; // already init'd
    set({ centreId });
    const [stats, payers] = await Promise.all([
      fetchClaimStats(centreId),
      get().payersLoaded ? Promise.resolve(get().payers) : fetchPayers(),
    ]);
    set({ stats, payers, payersLoaded: true });
    get().subscribeRealtime(centreId);
  },

  // ─── Refresh Stats ───
  refreshStats: async () => {
    const { centreId } = get();
    if (!centreId) return;
    const stats = await fetchClaimStats(centreId);
    set({ stats });
  },

  // ─── Load Claims List ───
  loadClaims: async (filters) => {
    const { centreId } = get();
    if (!centreId) return;
    set({ claimsLoading: true });
    const claims = await fetchClaims(centreId, filters);
    set({ claims, claimsLoading: false });
  },

  // ─── Load Claim Detail ───
  loadClaimDetail: async (claimId: string) => {
    set({ detailLoading: true });
    const [claim, timeline, queries, documents] = await Promise.all([
      fetchClaim(claimId),
      fetchClaimTimeline(claimId),
      fetchClaimQueries(claimId),
      fetchClaimDocuments(claimId),
    ]);
    let checklist: any[] = [];
    if (claim?.payer_id && claim?.claim_type) {
      checklist = await fetchDocChecklist(claim.payer_id, claim.claim_type);
    }
    set({
      activeClaim: claim,
      activeTimeline: timeline,
      activeQueries: queries,
      activeDocuments: documents,
      activeChecklist: checklist,
      detailLoading: false,
    });
  },

  // ─── Load Query Centre ───
  loadQueryCentre: async () => {
    const { centreId } = get();
    if (!centreId) return;
    set({ queriesLoading: true });
    const [openQueries, rejections] = await Promise.all([
      fetchOpenQueries(centreId),
      fetchRejections(centreId),
    ]);
    set({ openQueries, rejections, queriesLoading: false });
  },

  // ═══ MUTATIONS (auto-invalidate) ═══

  transitionStatus: async (claimId, newStatus, extras) => {
    try {
      await updateClaim(claimId, { status: newStatus, ...extras });
      notifyClaimStatusChange(claimId, newStatus).catch(() => {});
      // Invalidate everything that could be affected
      await get()._invalidateAll();
      await get()._invalidateDetail(claimId);
      return true;
    } catch (e) { console.error(e); return false; }
  },

  submitQuery: async (params) => {
    try {
      await addClaimQuery(params);
      await get()._invalidateAll();
      await get()._invalidateDetail(params.claim_id);
      return true;
    } catch (e) { console.error(e); return false; }
  },

  respondToQuery: async (queryId, responseText, staffId) => {
    try {
      await sb().from('clm_queries').update({
        response_text: responseText,
        responded_by: staffId || null,
        responded_at: new Date().toISOString(),
        status: 'responded',
      }).eq('id', queryId);
      // Find claim_id from the query to invalidate detail
      const { data: q } = await sb().from('clm_queries').select('claim_id').eq('id', queryId).single();
      await get()._invalidateAll();
      if (q?.claim_id) await get()._invalidateDetail(q.claim_id);
      return true;
    } catch (e) { console.error(e); return false; }
  },

  settleClaimAction: async (params) => {
    try {
      await recordSettlement(params);
      await get()._invalidateAll();
      await get()._invalidateDetail(params.claim_id);
      return true;
    } catch (e) { console.error(e); return false; }
  },

  uploadDoc: async (params) => {
    try {
      await uploadClaimDocument(params);
      await get()._invalidateDetail(params.claim_id);
      return true;
    } catch (e) { console.error(e); return false; }
  },

  inlineUpdateClaim: async (claimId, field, value) => {
    try {
      await updateClaim(claimId, { [field]: value });
      // Optimistic: update local state immediately
      const { activeClaim } = get();
      if (activeClaim?.id === claimId) {
        set({ activeClaim: { ...activeClaim, [field]: value } });
      }
      return true;
    } catch (e) { console.error(e); return false; }
  },

  // ═══ REALTIME ═══

  subscribeRealtime: (centreId: string) => {
    const existing = get().realtimeChannel;
    if (existing) existing.unsubscribe();

    const channel = sb()
      .channel(`claims-${centreId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clm_claims',
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        console.log('[Claims Realtime] clm_claims change:', payload.eventType);
        // Debounce: don't refresh more than once per 2 seconds
        const now = Date.now();
        if (now - get().lastUpdate > 2000) {
          set({ lastUpdate: now });
          get().refreshStats();
          // If we're looking at the changed claim, refresh its detail
          const changedId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (changedId && get().activeClaim?.id === changedId) {
            get()._invalidateDetail(changedId);
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clm_queries',
      }, () => {
        console.log('[Claims Realtime] clm_queries change');
        const now = Date.now();
        if (now - get().lastUpdate > 2000) {
          set({ lastUpdate: now });
          get().loadQueryCentre();
        }
      })
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel;
    if (ch) ch.unsubscribe();
    set({ realtimeChannel: null });
  },

  // ═══ Internal Invalidation ═══

  _invalidateAll: async () => {
    const { centreId } = get();
    if (!centreId) return;
    // Refresh stats + query centre in parallel
    await Promise.all([
      get().refreshStats(),
      get().loadQueryCentre(),
    ]);
  },

  _invalidateDetail: async (claimId: string) => {
    // Only reload if we're currently viewing this claim
    if (get().activeClaim?.id === claimId) {
      await get().loadClaimDetail(claimId);
    }
  },
}));
