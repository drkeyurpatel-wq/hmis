// lib/consent/consent-hooks.ts
// Hooks for digital consent management — templates + signed consents

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() {
  if (typeof window === 'undefined') return null as any;
  if (!_sb) { try { _sb = createClient(); } catch { return null; } }
  return _sb;
}

// ============================================================
// CONSENT TEMPLATES
// ============================================================
export function useConsentTemplates(centreId?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sb()) return;
    setLoading(true);
    let query = sb()
      .from('hmis_consent_templates')
      .select('*')
      .eq('is_active', true)
      .order('category, name');

    // Get global templates + centre-specific ones
    if (centreId) {
      query = query.or(`centre_id.is.null,centre_id.eq.${centreId}`);
    } else {
      query = query.is('centre_id', null);
    }

    const { data } = await query;
    setTemplates(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  return { templates, loading, reload: load };
}

// ============================================================
// PATIENT CONSENTS (signed instances)
// ============================================================
export function usePatientConsents(patientId: string | null, admissionId?: string | null) {
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sb() || !patientId) return;
    setLoading(true);
    let query = sb()
      .from('hmis_patient_consents')
      .select('*, template:hmis_consent_templates(name, category), obtained_staff:hmis_staff!hmis_patient_consents_obtained_by_fkey(full_name)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (admissionId) {
      query = query.eq('admission_id', admissionId);
    }

    const { data } = await query;
    setConsents(data || []);
    setLoading(false);
  }, [patientId, admissionId]);

  useEffect(() => { load(); }, [load]);

  // Sign a new consent
  const signConsent = useCallback(async (params: {
    patientId: string;
    admissionId?: string;
    templateId?: string;
    consentType: string;
    procedureName?: string;
    consentHtml?: string;
    risksExplained?: string;
    alternativesExplained?: string;
    signatureData: string;
    witnessId?: string;
    witnessName?: string;
    witnessRelation?: string;
    witnessSignature?: string;
    doctorSignature?: string;
    consentLanguage?: string;
    obtainedBy: string;
    centreId?: string;
  }) => {
    if (!sb()) return null;
    const { data, error } = await sb()
      .from('hmis_patient_consents')
      .insert({
        patient_id: params.patientId,
        admission_id: params.admissionId || null,
        template_id: params.templateId || null,
        consent_type: params.consentType,
        procedure_name: params.procedureName || null,
        consent_html: params.consentHtml || null,
        risks_explained: params.risksExplained || null,
        alternatives_explained: params.alternativesExplained || null,
        signature_data: params.signatureData,
        witnessed_by: params.witnessId || null,
        witness_name: params.witnessName || null,
        witness_relation: params.witnessRelation || null,
        witness_signature: params.witnessSignature || null,
        doctor_signature: params.doctorSignature || null,
        consent_language: params.consentLanguage || 'English',
        obtained_by: params.obtainedBy,
        centre_id: params.centreId || null,
        signed_at: new Date().toISOString(),
        is_valid: true,
      })
      .select()
      .single();

    if (!error) load();
    return data;
  }, [load]);

  // Revoke a consent
  const revokeConsent = useCallback(async (consentId: string, reason: string, staffId: string) => {
    if (!sb()) return;
    await sb()
      .from('hmis_patient_consents')
      .update({
        is_valid: false,
        revoked_at: new Date().toISOString(),
        revoked_by: staffId,
        revoke_reason: reason,
      })
      .eq('id', consentId);
    load();
  }, [load]);

  return { consents, loading, signConsent, revokeConsent, reload: load };
}
