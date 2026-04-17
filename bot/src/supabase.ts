// bot/src/supabase.ts — Supabase client for the bot engine
// Connects to the same HMIS Supabase instance (bmuupgrzbfmddjwcqlss)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BotRunRecord, ClaimData, BotAction } from './types';
import { logger } from './logger';

let client: SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // service role key for bot (bypasses RLS)
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    client = createClient(url, key);
  }
  return client;
}

// ─── Fetch claims pending bot action ───
export async function fetchPendingClaims(payerId: string, action: BotAction): Promise<ClaimData[]> {
  const sb = getSupabase();
  let statuses: string[];

  switch (action) {
    case 'submit_preauth':
      statuses = ['preauth_pending'];
      break;
    case 'submit_claim':
      statuses = ['claim_submitted'];
      break;
    case 'check_status':
      statuses = ['preauth_pending', 'preauth_approved', 'preauth_query',
                   'claim_submitted', 'claim_under_review', 'claim_query',
                   'claim_approved', 'settlement_pending'];
      break;
    case 'download_letter':
      statuses = ['preauth_approved', 'claim_approved', 'settled'];
      break;
    default:
      statuses = [];
  }

  const { data, error } = await sb
    .from('clm_claims')
    .select('id, claim_number, patient_name, patient_phone, patient_uhid, abha_id, primary_diagnosis, icd_code, procedure_name, treating_doctor_name, department_name, admission_date, discharge_date, estimated_amount, approved_amount, claimed_amount, tpa_claim_number, tpa_preauth_number, policy_number, policy_holder_name')
    .eq('payer_id', payerId)
    .in('status', statuses)
    .order('created_at', { ascending: true }); // oldest first

  if (error) {
    logger.error({ error }, 'Failed to fetch pending claims');
    return [];
  }
  return (data || []) as ClaimData[];
}

// ─── Update claim after bot action ───
export async function updateClaimFromBot(
  claimId: string,
  updates: Record<string, any>
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('clm_claims')
    .update(updates)
    .eq('id', claimId);

  if (error) {
    logger.error({ error, claimId }, 'Failed to update claim from bot');
    throw error;
  }
}

// ─── Log bot run ───
export async function logBotRun(run: BotRunRecord): Promise<string | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clm_bot_runs')
    .insert({
      payer_id: run.payer_id,
      centre_id: run.centre_id,
      action: run.action,
      claim_id: run.claim_id || null,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      duration_ms: run.duration_ms,
      steps_completed: run.steps_completed,
      total_steps: run.total_steps,
      error_message: run.error_message || null,
      screenshot_url: run.screenshot_url || null,
      portal_response: run.portal_response || null,
      claims_processed: run.claims_processed,
      claims_updated: run.claims_updated,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to log bot run');
    return null;
  }
  return data?.id || null;
}

// ─── Update bot run status ───
export async function updateBotRun(
  runId: string,
  updates: Partial<BotRunRecord>
): Promise<void> {
  const sb = getSupabase();
  await sb.from('clm_bot_runs').update(updates).eq('id', runId);
}

// ─── Upload screenshot to storage ───
export async function uploadScreenshot(
  path: string,
  buffer: Buffer
): Promise<string | null> {
  const sb = getSupabase();
  const { error } = await sb.storage
    .from('claim-documents')
    .upload(`bot-screenshots/${path}`, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    logger.error({ error, path }, 'Failed to upload screenshot');
    return null;
  }

  const { data } = sb.storage
    .from('claim-documents')
    .getPublicUrl(`bot-screenshots/${path}`);

  return data?.publicUrl || null;
}

// ─── Upload downloaded document ───
export async function uploadBotDocument(
  claimId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const sb = getSupabase();
  const path = `claims/${claimId}/bot_${Date.now()}_${fileName}`;

  const { error: uploadError } = await sb.storage
    .from('claim-documents')
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    logger.error({ error: uploadError }, 'Failed to upload bot document');
    return null;
  }

  const { data: urlData } = sb.storage
    .from('claim-documents')
    .getPublicUrl(path);

  // Also create clm_documents record
  await sb.from('clm_documents').insert({
    claim_id: claimId,
    document_name: fileName,
    document_category: 'correspondence',
    file_path: path,
    file_url: urlData?.publicUrl || path,
    file_size_bytes: buffer.length,
    mime_type: mimeType,
    source: 'bot',
    status: 'uploaded',
  });

  return urlData?.publicUrl || null;
}

// ─── Fetch TPA payer info ───
export async function fetchPayerByCode(code: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('clm_payers')
    .select('id, code, name, type, portal_url')
    .eq('code', code)
    .single();
  return data;
}
