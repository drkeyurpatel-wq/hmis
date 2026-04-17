// lib/claims/notifications.ts
// Claims-specific WhatsApp notification wrappers
// Uses existing lib/notifications/whatsapp.ts infrastructure

import { sb } from '@/lib/supabase/browser';
import { STATUS_CONFIG, type ClaimStatus } from './types';

// Template-based WhatsApp messages for claim status updates
// Note: Templates must be pre-approved in WhatsApp Business / AiSensy dashboard
// Template names follow: claim_{event_type}

const CLAIM_NOTIFICATION_TEMPLATES: Record<string, {
  templateName: string;
  buildParams: (claim: any) => string[];
}> = {
  preauth_approved: {
    templateName: 'claim_preauth_approved',
    buildParams: (c) => [c.patient_name, c.claim_number, formatINR(c.approved_amount), c.clm_payers?.name || 'Insurer'],
  },
  preauth_rejected: {
    templateName: 'claim_preauth_rejected',
    buildParams: (c) => [c.patient_name, c.claim_number, c.clm_payers?.name || 'Insurer'],
  },
  preauth_query: {
    templateName: 'claim_query_raised',
    buildParams: (c) => [c.patient_name, c.claim_number],
  },
  claim_approved: {
    templateName: 'claim_approved',
    buildParams: (c) => [c.patient_name, c.claim_number, formatINR(c.approved_amount)],
  },
  claim_rejected: {
    templateName: 'claim_rejected',
    buildParams: (c) => [c.patient_name, c.claim_number],
  },
  settled: {
    templateName: 'claim_settled',
    buildParams: (c) => [c.patient_name, c.claim_number, formatINR(c.settled_amount), c.settlement_utr || ''],
  },
};

function formatINR(n: number | null): string {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Send WhatsApp notification on claim status change
export async function notifyClaimStatusChange(claimId: string, newStatus: ClaimStatus) {
  const template = CLAIM_NOTIFICATION_TEMPLATES[newStatus];
  if (!template) return; // No notification for this status

  try {
    // Fetch claim with payer
    const { data: claim } = await sb()
      .from('clm_claims')
      .select('*, clm_payers(name)')
      .eq('id', claimId)
      .single();

    if (!claim || !claim.patient_phone) return;

    const params = template.buildParams(claim);

    // Log to clm_notifications
    await sb().from('clm_notifications').insert({
      claim_id: claimId,
      recipient_type: 'patient',
      recipient_phone: claim.patient_phone,
      channel: 'whatsapp',
      message_content: `Claim ${claim.claim_number}: ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
      metadata: { template: template.templateName, params },
    });

    // Actual WhatsApp send via API route (server-side to protect token)
    await fetch('/api/claims/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: claim.patient_phone,
        templateName: template.templateName,
        params,
        centreId: claim.centre_id,
        claimId,
      }),
    });
  } catch (e) {
    console.error('Claim notification failed:', e);
  }
}

// Send internal notification (to insurance desk staff)
export async function notifyStaffQueryEscalation(claimId: string, queryId: string, escalationLevel: number) {
  try {
    const { data: claim } = await sb()
      .from('clm_claims')
      .select('claim_number, patient_name, centre_id, assigned_to')
      .eq('id', claimId)
      .single();

    if (!claim) return;

    await sb().from('clm_notifications').insert({
      claim_id: claimId,
      recipient_type: 'staff',
      recipient_user_id: claim.assigned_to,
      channel: 'in_app',
      message_content: `Query escalation L${escalationLevel} on ${claim.claim_number} (${claim.patient_name})`,
      metadata: { query_id: queryId, escalation_level: escalationLevel },
    });
  } catch (e) {
    console.error('Staff notification failed:', e);
  }
}
