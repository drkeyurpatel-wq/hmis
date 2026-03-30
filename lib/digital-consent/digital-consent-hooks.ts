// lib/digital-consent/digital-consent-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface ConsentTemplate {
  id: string; centre_id: string; template_name: string;
  procedure_type: string | null; consent_type: string;
  version: number; is_current: boolean;
  content_en: string; content_hi: string | null; content_gu: string | null;
  risks_en: string | null; risks_hi: string | null; risks_gu: string | null;
  benefits_en: string | null; benefits_hi: string | null; benefits_gu: string | null;
  alternatives_en: string | null; alternatives_hi: string | null; alternatives_gu: string | null;
  requires_witness: boolean; requires_interpreter: boolean;
  mandatory_checklist: { item: string; checked: boolean }[];
  is_active: boolean; created_at: string;
}

export interface DigitalConsent {
  id: string; admission_id: string | null; patient_id: string;
  template_id: string | null; centre_id: string | null;
  ot_booking_id: string | null; consent_type: string;
  procedure_name: string; language: string;
  content_shown: string | null; education_shown: boolean;
  risks_explained: string | null; alternatives_explained: string | null;
  // Pre-op checklist
  identity_verified: boolean; procedure_explained: boolean;
  questions_answered: boolean; interpreter_used: boolean;
  interpreter_name: string | null;
  // Signatures
  patient_signature_data: string | null;
  witness_signature_data: string | null;
  witness_name: string | null; witness_relation: string | null;
  witness_staff_id: string | null;
  // Status
  consent_given: boolean; consent_date: string | null;
  obtained_by: string | null;
  revoked: boolean; revoked_at: string | null;
  withdrawal_reason: string | null;
  device_info: string | null; template_version: number | null;
  created_at: string;
  // Joined
  patient?: { first_name: string; last_name: string; uhid: string } | null;
  obtainer?: { full_name: string } | null;
  template?: { template_name: string } | null;
}

export interface ConsentAudit {
  id: string; consent_id: string; action: string;
  performed_by: string | null; details: string | null;
  device_info: string | null; created_at: string;
  performer?: { full_name: string } | null;
}

const CONSENT_SELECT = `*, patient:hmis_patients!hmis_consents_patient_id_fkey(first_name, last_name, uhid),
  obtainer:hmis_staff!hmis_consents_obtained_by_fkey(full_name),
  template:hmis_consent_templates!hmis_consents_template_id_fkey(template_name)`;

export function useDigitalConsent(centreId: string | null) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [consents, setConsents] = useState<DigitalConsent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_consent_templates')
      .select('*').eq('centre_id', centreId).eq('is_active', true).eq('is_current', true)
      .order('template_name');
    setTemplates((data || []) as ConsentTemplate[]);
  }, [centreId]);

  const loadConsents = useCallback(async (patientId?: string, admissionId?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_consents')
      .select(CONSENT_SELECT)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false }).limit(200);
    if (patientId) q = q.eq('patient_id', patientId);
    if (admissionId) q = q.eq('admission_id', admissionId);
    const { data } = await q;
    setConsents((data || []) as DigitalConsent[]);
    setLoading(false);
  }, [centreId]);

  // Create consent from template
  const createConsent = useCallback(async (input: {
    patient_id: string; admission_id?: string; template_id: string;
    ot_booking_id?: string; procedure_name: string; language?: string;
    obtained_by: string;
  }) => {
    if (!centreId || !sb()) return null;
    // Get template
    const { data: tpl } = await sb().from('hmis_consent_templates')
      .select('*').eq('id', input.template_id).single();
    if (!tpl) return null;

    const lang = input.language || 'en';
    const contentKey = `content_${lang}` as keyof typeof tpl;
    const risksKey = `risks_${lang}` as keyof typeof tpl;
    const altKey = `alternatives_${lang}` as keyof typeof tpl;

    const { data: consent, error } = await sb().from('hmis_consents').insert({
      patient_id: input.patient_id,
      admission_id: input.admission_id || null,
      template_id: input.template_id,
      centre_id: centreId,
      ot_booking_id: input.ot_booking_id || null,
      consent_type: tpl.consent_type,
      procedure_name: input.procedure_name,
      language: lang,
      content_shown: (tpl as any)[contentKey] || tpl.content_en,
      risks_explained: (tpl as any)[risksKey] || tpl.risks_en,
      alternatives_explained: (tpl as any)[altKey] || tpl.alternatives_en,
      obtained_by: input.obtained_by,
      template_version: tpl.version,
      consent_given: false,
      device_info: navigator.userAgent,
    }).select().single();

    if (!error && consent) {
      await logAudit(consent.id, 'created', input.obtained_by, `Consent created from template: ${tpl.template_name} v${tpl.version}`);
    }
    return consent;
  }, [centreId]);

  // Record education shown
  const markEducationShown = useCallback(async (consentId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update({ education_shown: true }).eq('id', consentId);
    await logAudit(consentId, 'education_shown', staffId, 'Patient education material presented');
  }, []);

  // Update pre-op checklist
  const updateChecklist = useCallback(async (consentId: string, updates: {
    identity_verified?: boolean; procedure_explained?: boolean;
    questions_answered?: boolean; interpreter_used?: boolean;
    interpreter_name?: string;
  }) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update(updates).eq('id', consentId);
  }, []);

  // Capture patient signature
  const capturePatientSignature = useCallback(async (consentId: string, signatureData: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update({
      patient_signature_data: signatureData,
      consent_date: new Date().toISOString(),
      ip_address: '', // Would be set server-side
    }).eq('id', consentId);
    await logAudit(consentId, 'patient_signed', staffId, 'Patient digital signature captured');
  }, []);

  // Capture witness signature
  const captureWitnessSignature = useCallback(async (consentId: string, signatureData: string, witnessStaffId: string, witnessName: string, witnessRelation?: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update({
      witness_signature_data: signatureData,
      witness_staff_id: witnessStaffId,
      witness_name: witnessName,
      witness_relation: witnessRelation || null,
    }).eq('id', consentId);
    await logAudit(consentId, 'witness_signed', witnessStaffId, `Witness: ${witnessName}`);
  }, []);

  // Finalize consent (mark as obtained)
  const finalizeConsent = useCallback(async (consentId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update({
      consent_given: true,
      consent_date: new Date().toISOString(),
      obtained_by: staffId,
    }).eq('id', consentId);
    await logAudit(consentId, 'obtained', staffId, 'Consent finalized and obtained');

    // BRIDGE: Update surgical planning checklist
    const { data: c } = await sb().from('hmis_consents')
      .select('centre_id, admission_id, ot_booking_id, consent_type')
      .eq('id', consentId).single();
    if (c) {
      import('@/lib/bridge/module-events').then(({ onConsentFinalized }) =>
        onConsentFinalized({
          centreId: c.centre_id || '', admissionId: c.admission_id,
          otBookingId: c.ot_booking_id, consentType: c.consent_type,
        }).catch(() => {})
      );
    }
  }, []);

  // Withdraw consent
  const withdrawConsent = useCallback(async (consentId: string, staffId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_consents').update({
      revoked: true, revoked_at: new Date().toISOString(),
      withdrawal_reason: reason, withdrawn_by: staffId,
      consent_given: false,
    }).eq('id', consentId);
    await logAudit(consentId, 'revoked', staffId, `Consent withdrawn: ${reason}`);
  }, []);

  // Create/update template
  const saveTemplate = useCallback(async (input: Partial<ConsentTemplate> & { template_name: string; content_en: string; consent_type: string }, staffId: string) => {
    if (!centreId || !sb()) return;
    if (input.id) {
      // New version — mark old as not current
      await sb().from('hmis_consent_templates').update({ is_current: false }).eq('id', input.id);
      const { data: old } = await sb().from('hmis_consent_templates').select('version').eq('id', input.id).single();
      await sb().from('hmis_consent_templates').insert({
        ...input, id: undefined, centre_id: centreId, version: (old?.version || 0) + 1,
        is_current: true, created_by: staffId,
      });
    } else {
      await sb().from('hmis_consent_templates').insert({
        ...input, centre_id: centreId, version: 1, is_current: true, created_by: staffId,
      });
    }
  }, [centreId]);

  // Audit trail
  const logAudit = async (consentId: string, action: string, staffId: string, details?: string) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_consent_audit').insert({
      consent_id: consentId, centre_id: centreId, action,
      performed_by: staffId, details: details || null,
      device_info: navigator.userAgent,
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadAudit = useCallback(async (consentId: string): Promise<ConsentAudit[]> => {
    if (!sb()) return [];
    const { data } = await sb().from('hmis_consent_audit')
      .select('*, performer:hmis_staff!hmis_consent_audit_performed_by_fkey(full_name)')
      .eq('consent_id', consentId)
      .order('created_at', { ascending: true });
    return (data || []) as ConsentAudit[];
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = consents.length;
    const signed = consents.filter(c => c.consent_given && !c.revoked).length;
    const pending = consents.filter(c => !c.consent_given && !c.revoked).length;
    const revoked = consents.filter(c => c.revoked).length;
    return { total, signed, pending, revoked };
  }, [consents]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTemplates(); loadConsents(); }, [loadTemplates, loadConsents]);

  return {
    templates, consents, loading, stats,
    loadTemplates, loadConsents, createConsent, markEducationShown,
    updateChecklist, capturePatientSignature, captureWitnessSignature,
    finalizeConsent, withdrawConsent, saveTemplate, loadAudit,
  };
}
