// lib/billing/service-master-hooks.ts
// Hooks for billing_service_masters and billing_rate_cards tables

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ServiceMaster, RateCard, PayorType } from './types';

// ═══════════════════════════════════════════════════════════
// SERVICE MASTERS
// ═══════════════════════════════════════════════════════════

export function useServiceMasters(centreId: string | null) {
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: {
    category?: string; department?: string; search?: string; activeOnly?: boolean;
  }) => {
    if (!centreId) return;
    setLoading(true);
    let q = sb().from('billing_service_masters')
      .select('*')
      .eq('centre_id', centreId)
      .order('department')
      .order('service_category')
      .order('service_name')
      .limit(2000);

    if (filters?.activeOnly !== false) q = q.eq('is_active', true);
    if (filters?.category) q = q.eq('service_category', filters.category);
    if (filters?.department) q = q.eq('department', filters.department);

    const { data } = await q;
    const all = (data || []) as ServiceMaster[];
    setServices(all);
    setCategories([...new Set(all.map(s => s.service_category))].sort());
    setDepartments([...new Set(all.map(s => s.department))].sort());
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const search = useCallback((query: string) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return services.filter(s =>
      s.service_name.toLowerCase().includes(q) ||
      s.service_code.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [services]);

  const create = useCallback(async (input: {
    serviceCode: string;
    serviceName: string;
    department: string;
    serviceCategory: string;
    baseRate: number;
    gstApplicable?: boolean;
    gstPercentage?: number;
    hsnSacCode?: string;
    isPayableToDoctor?: boolean;
    doctorPayoutType?: string;
  }) => {
    if (!centreId) return null;
    const { data, error } = await sb().from('billing_service_masters').insert({
      centre_id: centreId,
      service_code: input.serviceCode,
      service_name: input.serviceName,
      department: input.department,
      service_category: input.serviceCategory,
      base_rate: input.baseRate,
      gst_applicable: input.gstApplicable || false,
      gst_percentage: input.gstPercentage || 0,
      hsn_sac_code: input.hsnSacCode || null,
      is_payable_to_doctor: input.isPayableToDoctor ?? true,
      doctor_payout_type: input.doctorPayoutType || null,
      effective_from: new Date().toISOString().split('T')[0],
    }).select().single();

    if (error) return null;
    load();
    return data as ServiceMaster;
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: Partial<{
    serviceName: string;
    baseRate: number;
    gstApplicable: boolean;
    gstPercentage: number;
    isActive: boolean;
    isPayableToDoctor: boolean;
  }>) => {
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.serviceName !== undefined) upd.service_name = updates.serviceName;
    if (updates.baseRate !== undefined) upd.base_rate = updates.baseRate;
    if (updates.gstApplicable !== undefined) upd.gst_applicable = updates.gstApplicable;
    if (updates.gstPercentage !== undefined) upd.gst_percentage = updates.gstPercentage;
    if (updates.isActive !== undefined) upd.is_active = updates.isActive;
    if (updates.isPayableToDoctor !== undefined) upd.is_payable_to_doctor = updates.isPayableToDoctor;

    await sb().from('billing_service_masters').update(upd).eq('id', id);
    load();
  }, [load]);

  const getRateForPayor = useCallback((serviceId: string, payorType: PayorType, rateCards: RateCard[]): number => {
    const card = rateCards.find(rc =>
      rc.service_master_id === serviceId &&
      rc.payor_type === payorType &&
      rc.is_active
    );
    if (card) return Number(card.rate);

    const service = services.find(s => s.id === serviceId);
    return service ? Number(service.base_rate) : 0;
  }, [services]);

  return { services, categories, departments, loading, load, search, create, update, getRateForPayor };
}

// ═══════════════════════════════════════════════════════════
// RATE CARDS
// ═══════════════════════════════════════════════════════════

export function useRateCards(centreId: string | null) {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (payorType?: string) => {
    if (!centreId) return;
    setLoading(true);
    let q = sb().from('billing_rate_cards')
      .select('*, service_master:billing_service_masters(id, service_code, service_name, department, base_rate)')
      .eq('centre_id', centreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (payorType) q = q.eq('payor_type', payorType);

    const { data } = await q;
    setRateCards((data || []) as RateCard[]);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: {
    payorType: PayorType;
    payorId?: string;
    serviceMasterId: string;
    rate: number;
    discountPercentage?: number;
  }) => {
    if (!centreId) return null;
    const { data, error } = await sb().from('billing_rate_cards').insert({
      centre_id: centreId,
      payor_type: input.payorType,
      payor_id: input.payorId || null,
      service_master_id: input.serviceMasterId,
      rate: input.rate,
      discount_percentage: input.discountPercentage || 0,
      effective_from: new Date().toISOString().split('T')[0],
    }).select().single();

    if (error) return null;
    load();
    return data as RateCard;
  }, [centreId, load]);

  const deactivate = useCallback(async (id: string) => {
    await sb().from('billing_rate_cards').update({
      is_active: false,
      effective_to: new Date().toISOString().split('T')[0],
    }).eq('id', id);
    load();
  }, [load]);

  return { rateCards, loading, load, create, deactivate };
}

// ═══════════════════════════════════════════════════════════
// PATIENT SEARCH (reusable across billing screens)
// ═══════════════════════════════════════════════════════════

export function usePatientSearch() {
  const [results, setResults] = useState<Array<{
    id: string; first_name: string; last_name: string;
    uhid: string; phone_primary: string | null;
    age_years: number | null; gender: string | null;
  }>>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await sb().from('hmis_patients')
      .select('id, first_name, last_name, uhid, phone_primary, age_years, gender')
      .or(`uhid.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_primary.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(10);
    setResults(data || []);
    setSearching(false);
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, searching, search, clear };
}

// ═══════════════════════════════════════════════════════════
// DOCTOR SEARCH
// ═══════════════════════════════════════════════════════════

export function useDoctorSearch(centreId: string | null) {
  const [doctors, setDoctors] = useState<Array<{
    id: string; full_name: string; specialisation: string | null;
    designation: string | null;
  }>>([]);

  const load = useCallback(async () => {
    if (!centreId) return;
    const { data } = await sb().from('hmis_staff')
      .select('id, full_name, specialisation, designation')
      .eq('staff_type', 'doctor')
      .eq('is_active', true)
      .order('full_name')
      .limit(100);
    setDoctors(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const search = useCallback((query: string) => {
    if (!query) return doctors;
    const q = query.toLowerCase();
    return doctors.filter(d => d.full_name.toLowerCase().includes(q));
  }, [doctors]);

  return { doctors, search };
}
