// lib/patient/patient-hooks.ts
// Standard patient data hooks using useSupabaseQuery/useSupabaseMutation.
// Errors surface to UI — never swallowed.

'use client';

import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/use-supabase-query';
import { sb } from '@/lib/supabase/browser';
import { auditCreate } from '@/lib/audit/audit-logger';

// ============================================================
// TYPES
// ============================================================

export interface PatientListItem {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
  age_years: number | null;
  gender: string;
  phone_primary: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PatientRegistration {
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: string;
  date_of_birth?: string;
  age_years?: number;
  blood_group?: string;
  marital_status?: string;
  occupation?: string;
  religion?: string;
  nationality?: string;
  is_vip?: boolean;
  phone_primary: string;
  phone_secondary?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  id_type?: string;
  id_number?: string;
  abha_number?: string;
  abha_address?: string;
  scheme?: string;
  insurer?: string;
  policy_number?: string;
  tpa?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  allergies?: string;
  medical_history?: string;
}

// ============================================================
// HOOKS — List / Search
// ============================================================

/**
 * Fetch patient list for a centre. Progressive disclosure INDEX layer.
 * Returns compact data — click row to open Patient 360 for full detail.
 */
export function usePatientList(centreId: string | null) {
  return useSupabaseQuery<PatientListItem>(
    (client) =>
      client
        .from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, city, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    [centreId],
    { enabled: !!centreId }
  );
}

/**
 * Search patients by name, UHID, or phone.
 * Debounce on the caller side (300ms recommended).
 */
export function usePatientSearch(query: string, centreId: string | null) {
  return useSupabaseQuery<PatientListItem>(
    (client) => {
      let q = client
        .from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, city, is_active, created_at');

      // Smart search: UHID pattern, phone (digits only), or name
      const trimmed = query.trim();
      if (trimmed.startsWith('H1-')) {
        q = q.ilike('uhid', `%${trimmed}%`);
      } else if (/^\d{6,}$/.test(trimmed)) {
        q = q.ilike('phone_primary', `%${trimmed}%`);
      } else {
        q = q.or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,uhid.ilike.%${trimmed}%,phone_primary.ilike.%${trimmed}%`);
      }

      return q.order('created_at', { ascending: false }).limit(50);
    },
    [query, centreId],
    { enabled: !!centreId && query.trim().length >= 2 }
  );
}

// ============================================================
// HOOKS — Registration (Mutation)
// ============================================================

/**
 * Register a new patient. Generates UHID via hmis_next_sequence RPC.
 * Returns the created patient record on success.
 */
export function useRegisterPatient(options?: {
  onSuccess?: (patient: { id: string; uhid: string }) => void;
  onError?: (error: string) => void;
}) {
  return useSupabaseMutation<
    PatientRegistration & { centre_id: string; auth_user_id: string },
    { id: string; uhid: string }
  >(
    async (client, input) => {
      // Step 1: Generate UHID
      const { data: uhid, error: uhidErr } = await client.rpc('hmis_next_sequence', {
        p_centre_id: input.centre_id,
        p_type: 'uhid',
      });
      if (uhidErr || !uhid) {
        return { data: null, error: uhidErr || { message: 'UHID generation failed' } };
      }

      // Step 2: Insert patient
      const { data: patient, error: insErr } = await client
        .from('hmis_patients')
        .insert({
          uhid,
          registration_centre_id: input.centre_id,
          first_name: input.first_name.trim(),
          middle_name: input.middle_name?.trim() || null,
          last_name: input.last_name.trim(),
          gender: input.gender.toLowerCase(),
          date_of_birth: input.date_of_birth || null,
          age_years: input.age_years || null,
          blood_group: input.blood_group || null,
          marital_status: input.marital_status || null,
          occupation: input.occupation || null,
          religion: input.religion || null,
          nationality: input.nationality || 'Indian',
          is_vip: input.is_vip || false,
          phone_primary: input.phone_primary.trim(),
          phone_secondary: input.phone_secondary?.trim() || null,
          email: input.email?.trim() || null,
          address_line1: input.address_line1?.trim() || null,
          address_line2: input.address_line2?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state || null,
          pincode: input.pincode?.trim() || null,
          id_type: input.id_type || null,
          id_number: input.id_number?.trim() || null,
          abha_number: input.abha_number?.trim() || null,
          abha_address: input.abha_address?.trim() || null,
        })
        .select('id, uhid')
        .single();

      if (insErr) return { data: null, error: insErr };

      // Audit trail
      if (patient) {
        auditCreate(input.centre_id, input.auth_user_id, 'patient', patient.id, `Registered ${input.first_name} ${input.last_name} (${patient.uhid})`);
      }
      if (input.emergency_contact_name?.trim() && input.emergency_contact_phone?.trim() && patient) {
        await client.from('hmis_patient_contacts').insert({
          patient_id: patient.id,
          name: input.emergency_contact_name.trim(),
          relationship: input.emergency_contact_relation || 'Other',
          phone: input.emergency_contact_phone.trim(),
          is_emergency: true,
        });
        // Non-critical — don't fail registration if contact insert fails
      }

      return { data: patient, error: null };
    },
    options
  );
}

// ============================================================
// HOOKS — Patient Stats (for dashboard cards)
// ============================================================

export interface PatientStats {
  total: number;
  today: number;
  thisMonth: number;
  activeAdmissions: number;
}

export function usePatientStats(centreId: string | null) {
  return useSupabaseQuery<PatientStats>(
    async (client) => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 8) + '01';

      const [totalRes, todayRes, monthRes, admRes] = await Promise.all([
        client.from('hmis_patients').select('id', { count: 'exact', head: true }),
        client.from('hmis_patients').select('id', { count: 'exact', head: true }).gte('created_at', today),
        client.from('hmis_patients').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        client.from('hmis_ipd_admissions').select('id', { count: 'exact', head: true }).eq('status', 'admitted'),
      ]);

      return {
        data: [{
          total: totalRes.count || 0,
          today: todayRes.count || 0,
          thisMonth: monthRes.count || 0,
          activeAdmissions: admRes.count || 0,
        }],
        error: null,
      };
    },
    [centreId],
    { enabled: !!centreId }
  );
}
