// app/api/abdm/route.ts
// ABDM Integration API — ABHA creation, verification, linking, HIE-CM callbacks
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/api/auth-guard';

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return _supabase;
}

function getABDMConfig() {
  const { ABDMConfig } = require('@/lib/abdm/abdm-client');
  return {
    clientId: process.env.ABDM_CLIENT_ID || '',
    clientSecret: process.env.ABDM_CLIENT_SECRET || '',
    isProduction: process.env.ABDM_ENVIRONMENT === 'production',
    hipId: process.env.ABDM_HIP_ID || process.env.NHCX_HFR_ID || '',
    hipName: process.env.ABDM_HIP_NAME || 'Health1 Super Speciality Hospitals',
    callbackUrl: process.env.ABDM_CALLBACK_URL || '',
  };
}

// ============================================================
// POST — ABHA operations + HIE-CM callbacks
// ============================================================
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuthOrApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action } = body;

    // ---- ABHA CREATION (Aadhaar flow) ----
    if (action === 'aadhaar_generate_otp') {
      const { generateAadhaarOTP } = await import('@/lib/abdm/abdm-client');
      const result = await generateAadhaarOTP(getABDMConfig(), body.aadhaarNumber);
      return NextResponse.json(result);
    }

    if (action === 'aadhaar_verify_otp') {
      const { verifyAadhaarOTP } = await import('@/lib/abdm/abdm-client');
      const result = await verifyAadhaarOTP(getABDMConfig(), body.txnId, body.otp);
      return NextResponse.json(result);
    }

    if (action === 'create_abha') {
      const { createABHA } = await import('@/lib/abdm/abdm-client');
      const profile = await createABHA(getABDMConfig(), body.txnId);
      // Auto-link if patientId provided
      if (body.patientId) {
        const { linkABHAToPatient } = await import('@/lib/abdm/abdm-client');
        await linkABHAToPatient(getSupabase(), body.patientId, profile);
      }
      return NextResponse.json({ success: true, profile });
    }

    // ---- ABHA CREATION (Mobile flow) ----
    if (action === 'mobile_generate_otp') {
      const { generateMobileOTP } = await import('@/lib/abdm/abdm-client');
      const result = await generateMobileOTP(getABDMConfig(), body.mobile);
      return NextResponse.json(result);
    }

    if (action === 'mobile_verify_otp') {
      const { verifyMobileOTP } = await import('@/lib/abdm/abdm-client');
      const result = await verifyMobileOTP(getABDMConfig(), body.txnId, body.otp);
      return NextResponse.json(result);
    }

    // ---- ABHA VERIFICATION (existing ABHA) ----
    if (action === 'verify_abha_aadhaar') {
      const { verifyABHAByAadhaar } = await import('@/lib/abdm/abdm-client');
      const result = await verifyABHAByAadhaar(getABDMConfig(), body.abhaNumber);
      return NextResponse.json(result);
    }

    if (action === 'verify_abha_mobile') {
      const { verifyABHAByMobile } = await import('@/lib/abdm/abdm-client');
      const result = await verifyABHAByMobile(getABDMConfig(), body.abhaNumber);
      return NextResponse.json(result);
    }

    if (action === 'verify_abha_otp') {
      const { verifyABHAOTP, linkABHAToPatient } = await import('@/lib/abdm/abdm-client');
      const profile = await verifyABHAOTP(getABDMConfig(), body.txnId, body.otp);
      if (body.patientId) {
        await linkABHAToPatient(getSupabase(), body.patientId, profile);
      }
      return NextResponse.json({ success: true, profile });
    }

    // ---- ABHA SEARCH ----
    if (action === 'search_abha') {
      const { searchByABHAAddress } = await import('@/lib/abdm/abdm-client');
      const result = await searchByABHAAddress(getABDMConfig(), body.abhaAddress);
      return NextResponse.json(result);
    }

    // ---- QR SCAN ----
    if (action === 'parse_qr') {
      const { parseABHAQRCode } = await import('@/lib/abdm/abdm-client');
      const result = parseABHAQRCode(body.qrData);
      return NextResponse.json({ success: !!result, data: result });
    }

    // ---- LINK/UNLINK ----
    if (action === 'link_abha') {
      const { linkABHAToPatient } = await import('@/lib/abdm/abdm-client');
      const result = await linkABHAToPatient(getSupabase(), body.patientId, body.profile);
      return NextResponse.json(result);
    }

    if (action === 'unlink_abha') {
      const { unlinkABHA } = await import('@/lib/abdm/abdm-client');
      const result = await unlinkABHA(getSupabase(), body.patientId);
      return NextResponse.json(result);
    }

    // ---- PHR ADDRESS ----
    if (action === 'create_phr_address') {
      const { createPHRAddress } = await import('@/lib/abdm/abdm-client');
      const result = await createPHRAddress(getABDMConfig(), body.txnId, body.phrAddress);
      return NextResponse.json(result);
    }

    if (action === 'suggest_phr') {
      const { suggestPHRAddresses } = await import('@/lib/abdm/abdm-client');
      const suggestions = await suggestPHRAddresses(getABDMConfig(), body.txnId);
      return NextResponse.json({ suggestions });
    }

    // ---- HIU: Consent Request ----
    if (action === 'create_consent_request') {
      const { createConsentRequest } = await import('@/lib/abdm/hie-cm');
      const result = await createConsentRequest(getABDMConfig(), getSupabase(), body.request, body.staffId);
      return NextResponse.json(result);
    }

    // ---- HIE-CM CALLBACKS (from ABDM gateway) ----

    // Patient discovery callback
    if (action === 'on_discover' || req.headers.get('x-hiu-callback-action') === 'on-discover') {
      const { handlePatientDiscovery } = await import('@/lib/abdm/hie-cm');
      const { data: patients } = await getSupabase().from('hmis_patients')
        .select('*, encounters:hmis_encounters(id, encounter_type, created_at, doctor_name)')
        .or(`abha_number.not.is.null,abha_address.not.is.null`);
      const result = handlePatientDiscovery(body, patients || []);
      return NextResponse.json(result, { status: result.patient ? 200 : 404 });
    }

    // Link init callback
    if (action === 'on_link_init') {
      const { handleLinkInit } = await import('@/lib/abdm/hie-cm');
      const result = await handleLinkInit(getSupabase(), body, getABDMConfig());
      return NextResponse.json(result);
    }

    // Link confirm callback
    if (action === 'on_link_confirm') {
      const { handleLinkConfirm } = await import('@/lib/abdm/hie-cm');
      const result = await handleLinkConfirm(getSupabase(), body);
      return NextResponse.json(result);
    }

    // Consent notification
    if (action === 'on_consent_notify') {
      const { handleConsentNotification } = await import('@/lib/abdm/hie-cm');
      await handleConsentNotification(getSupabase(), body.notification);
      return NextResponse.json({ status: 'acknowledged' }, { status: 202 });
    }

    // Health data request (consent granted, transfer data)
    if (action === 'on_data_request') {
      const { buildHealthRecord } = await import('@/lib/abdm/hie-cm');
      const records = [];
      for (const cc of body.careContexts || []) {
        const recs = await buildHealthRecord(getSupabase(), cc.careContextReference, body.hiTypes || []);
        records.push(...recs);
      }
      return NextResponse.json({ records, status: 'TRANSFERRED' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[ABDM API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// GET — ABDM config status
// ============================================================
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuthOrApiKey(req);
  if (authError) return authError;

  const config = getABDMConfig();
  return NextResponse.json({
    status: 'ok',
    abdm: {
      configured: !!(config.clientId && config.clientSecret),
      environment: config.isProduction ? 'production' : 'sandbox',
      hipId: config.hipId || 'NOT SET',
      hipName: config.hipName,
      features: {
        abhaCreation: true,
        abhaVerification: true,
        abhaLinking: true,
        scanAndShare: true,
        hieCM: true,
        hipDiscovery: true,
        hiuConsentRequest: true,
      },
    },
  });
}
