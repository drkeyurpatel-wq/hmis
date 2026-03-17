// app/api/nhcx/route.ts
// NHCX Gateway Integration API
// Outgoing: Coverage check, Pre-auth, Claim submit
// Incoming: Callbacks from NHCX (on_check, on_submit, payment notice)

import { NextRequest, NextResponse } from 'next/server';

import { buildCoverageEligibilityRequestBundle, buildClaimBundle, parseClaimResponse, parseCoverageEligibilityResponse } from '@/lib/nhcx/fhir-bundles';
import { checkCoverageEligibility, submitPreAuth, submitClaim, submitPredetermination, processCallback, mapHMISClaimToNHCX } from '@/lib/nhcx/nhcx-client';
import type { NHCXConfig } from '@/lib/nhcx/fhir-bundles';

const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return _supabase;
}

// NHCX Config — loaded from environment or database
function getNHCXConfig(): NHCXConfig {
  return {
    participantCode: process.env.NHCX_PARTICIPANT_CODE || '',
    facilityHfrId: process.env.NHCX_HFR_ID || '',
    facilityName: 'Health1 Super Speciality Hospital',
    facilityCity: 'Ahmedabad',
    facilityState: 'Gujarat',
    facilityPincode: '380058',
    nhcxGatewayUrl: process.env.NHCX_GATEWAY_URL || 'https://hcxbeta.nha.gov.in',
    username: process.env.NHCX_USERNAME || '',
    secret: process.env.NHCX_SECRET || '',
  };
}

// ============================================================
// POST — Outgoing requests + incoming callbacks
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    // ---- OUTGOING: Submit to NHCX ----
    if (action === 'coverage_check' || action === 'preauth_submit' || action === 'claim_submit' || action === 'predetermination_submit') {
      return handleOutgoing(action, body);
    }

    // ---- INCOMING: Callback from NHCX gateway ----
    if (action === 'on_check' || action === 'on_submit' || action === 'on_request') {
      return handleCallback(action, body);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[NHCX API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// OUTGOING — Build FHIR bundle and submit to NHCX
// ============================================================
async function handleOutgoing(action: string, body: any) {
  const config = getNHCXConfig();
  if (!config.participantCode) {
    return NextResponse.json({ error: 'NHCX not configured. Set NHCX_PARTICIPANT_CODE in environment.' }, { status: 400 });
  }

  const { claimId, patientId } = body;

  // Load claim + patient + insurance from HMIS
  const { data: claim } = await getSupabase().from('hmis_claims').select('*').eq('id', claimId).single();
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  const { data: patient } = await getSupabase().from('hmis_patients').select('*').eq('id', claim.patient_id || patientId).single();
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const { data: insurance } = await getSupabase().from('hmis_patient_insurance')
    .select('*, insurer:hmis_insurers(*), tpa:hmis_tpas(*)')
    .eq('patient_id', patient.id).eq('is_primary', true).single();

  // Load bill items if claim has a bill
  let billItems: any[] = [];
  if (claim.bill_id) {
    const { data } = await getSupabase().from('hmis_bill_items').select('*').eq('bill_id', claim.bill_id);
    billItems = data || [];
  }

  // Map HMIS data to NHCX format
  const { patientData, insuranceData, claimData } = mapHMISClaimToNHCX(claim, patient, insurance, billItems);

  let result;
  let nhcxAction: string;

  if (action === 'coverage_check') {
    const { bundle, recipientCode } = buildCoverageEligibilityRequestBundle(config, patientData, insuranceData);
    result = await checkCoverageEligibility(config, bundle, recipientCode);
    nhcxAction = 'coverageeligibility/check';
  } else if (action === 'preauth_submit') {
    claimData.claimType = 'preauthorization';
    const { bundle, recipientCode } = buildClaimBundle(config, patientData, insuranceData, claimData);
    result = await submitPreAuth(config, bundle, recipientCode);
    nhcxAction = 'preauth/submit';
  } else if (action === 'claim_submit') {
    claimData.claimType = 'claim';
    const { bundle, recipientCode } = buildClaimBundle(config, patientData, insuranceData, claimData);
    result = await submitClaim(config, bundle, recipientCode);
    nhcxAction = 'claim/submit';
  } else {
    claimData.claimType = 'predetermination';
    const { bundle, recipientCode } = buildClaimBundle(config, patientData, insuranceData, claimData);
    result = await submitPredetermination(config, bundle, recipientCode);
    nhcxAction = 'predetermination/submit';
  }

  // Log NHCX transaction
  await getSupabase().from('hmis_nhcx_transactions').insert({
    claim_id: claimId,
    patient_id: patient.id,
    action: nhcxAction,
    direction: 'outgoing',
    nhcx_api_call_id: result.apiCallId,
    nhcx_correlation_id: result.correlationId,
    nhcx_workflow_id: result.workflowId,
    status: result.success ? 'submitted' : 'failed',
    error_message: result.error,
    request_timestamp: new Date().toISOString(),
  }).select();

  // Update claim status
  if (result.success) {
    const newStatus = action === 'coverage_check' ? 'eligibility_check_sent' :
      action === 'preauth_submit' ? 'preauth_submitted' :
      action === 'claim_submit' ? 'claim_submitted' : 'predetermination_submitted';
    await getSupabase().from('hmis_claims').update({
      nhcx_correlation_id: result.correlationId,
      nhcx_workflow_id: result.workflowId,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', claimId);
  }

  return NextResponse.json({
    success: result.success,
    apiCallId: result.apiCallId,
    correlationId: result.correlationId,
    workflowId: result.workflowId,
    error: result.error,
  });
}

// ============================================================
// INCOMING — Process NHCX callback
// ============================================================
async function handleCallback(action: string, body: any) {
  const { payload } = body;
  if (!payload) return NextResponse.json({ error: 'No payload' }, { status: 400 });

  const result = processCallback(payload);

  // Log incoming transaction
  const correlationId = result.headers['x-hcx-correlation_id'];
  await getSupabase().from('hmis_nhcx_transactions').insert({
    action: action,
    direction: 'incoming',
    nhcx_correlation_id: correlationId,
    nhcx_workflow_id: result.headers['x-hcx-workflow_id'],
    status: result.status,
    response_payload: result.fhirBundle,
    response_timestamp: new Date().toISOString(),
  });

  // Find the original claim by correlation_id
  if (correlationId) {
    const { data: claim } = await getSupabase().from('hmis_claims')
      .select('id, status')
      .eq('nhcx_correlation_id', correlationId)
      .single();

    if (claim && result.fhirBundle) {
      // Parse response based on type
      if (action === 'on_check') {
        const eligibility = parseCoverageEligibilityResponse(result.fhirBundle);
        await getSupabase().from('hmis_claims').update({
          status: eligibility.eligible ? 'eligible' : 'not_eligible',
          nhcx_response: eligibility,
          updated_at: new Date().toISOString(),
        }).eq('id', claim.id);
      } else if (action === 'on_submit') {
        const claimResponse = parseClaimResponse(result.fhirBundle);
        const statusMap: Record<string, string> = {
          'complete': 'approved',
          'partial': 'partially_approved',
          'error': 'rejected',
        };
        await getSupabase().from('hmis_claims').update({
          status: statusMap[claimResponse.status] || claimResponse.status,
          approved_amount: claimResponse.approvedAmount,
          nhcx_response: claimResponse,
          remarks: claimResponse.disposition,
          updated_at: new Date().toISOString(),
        }).eq('id', claim.id);
      }
    }
  }

  // Acknowledge callback to NHCX
  return NextResponse.json({
    timestamp: Date.now().toString(),
    api_call_id: result.headers['x-hcx-request_id'] || uuidv4(),
    correlation_id: correlationId,
  }, { status: 202 });
}

// ============================================================
// GET — Health check + NHCX config status
// ============================================================
export async function GET() {
  const config = getNHCXConfig();
  return NextResponse.json({
    status: 'ok',
    nhcx: {
      configured: !!config.participantCode,
      gateway: config.nhcxGatewayUrl,
      participantCode: config.participantCode ? config.participantCode.substring(0, 10) + '...' : 'NOT SET',
      hfrId: config.facilityHfrId || 'NOT SET',
    },
  });
}
