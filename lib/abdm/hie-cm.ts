// lib/abdm/hie-cm.ts
// Health Information Exchange — Consent Manager (HIE-CM)
// Implements HIP (Health Information Provider) and HIU (Health Information User) roles
// Spec: https://sandbox.abdm.gov.in/docs/hip_overview

import type { ABDMConfig } from './abdm-client';

const HIE_CM_SANDBOX = 'https://dev.abdm.gov.in/cm';
const HIE_CM_PRODUCTION = 'https://live.ndhm.gov.in/cm';
const GATEWAY_SANDBOX = 'https://dev.abdm.gov.in/gateway';
const GATEWAY_PRODUCTION = 'https://live.ndhm.gov.in/gateway';

// ============================================================
// TYPES
// ============================================================

export type ConsentPurpose = 'CAREMGT' | 'BTG' | 'PUBHLTH' | 'HPAYMT' | 'DSRCH' | 'PATRQT';
export type HIType = 'Prescription' | 'DiagnosticReport' | 'OPConsultation' | 'DischargeSummary' | 'ImmunizationRecord' | 'HealthDocumentRecord' | 'WellnessRecord';
export type ConsentStatus = 'REQUESTED' | 'GRANTED' | 'DENIED' | 'EXPIRED' | 'REVOKED';
export type DataTransferStatus = 'REQUESTED' | 'ACKNOWLEDGED' | 'TRANSFERRED' | 'FAILED';

export interface ConsentRequest {
  id?: string;
  patientAbhaAddress: string;
  hipId: string;
  hipName: string;
  hiuId: string;
  hiuName: string;
  purpose: ConsentPurpose;
  hiTypes: HIType[];
  dateRange: { from: string; to: string };
  expiryDate: string;
  frequency: { unit: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'; value: number; repeats: number };
  status: ConsentStatus;
  consentId?: string;
  consentArtefactId?: string;
  createdAt: string;
}

export interface HealthRecord {
  careContextReference: string;
  careContextDisplay: string;
  hiType: HIType;
  data: any;          // FHIR Bundle
  patientId: string;
  encounterId?: string;
}

// ============================================================
// HIP — Health Information Provider (our hospital)
// ============================================================

/** Handle patient discovery from HIE-CM (on /v0.5/care-contexts/discover) */
export function handlePatientDiscovery(
  request: { patient: { id: string; name: string; gender: string; yearOfBirth: number; verifiedIdentifiers: { type: string; value: string }[]; unverifiedIdentifiers: { type: string; value: string }[] } },
  patients: any[]
): { patient: { referenceNumber: string; display: string; careContexts: { referenceNumber: string; display: string }[] } | null; matchedBy: string[] } {
  const { patient } = request;
  const abhaId = patient.verifiedIdentifiers?.find(i => i.type === 'HEALTH_ID' || i.type === 'NDHM_HEALTH_NUMBER')?.value;
  const mobile = patient.unverifiedIdentifiers?.find(i => i.type === 'MOBILE')?.value;

  // Match by ABHA number first, then by demographics
  let matched = null;
  const matchedBy: string[] = [];

  if (abhaId) {
    matched = patients.find(p =>
      p.abha_number?.replace(/-/g, '') === abhaId.replace(/-/g, '') ||
      p.abha_address === abhaId
    );
    if (matched) matchedBy.push('ABHA');
  }

  if (!matched && patient.name && patient.yearOfBirth) {
    matched = patients.find(p => {
      const nameMatch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(patient.name.toLowerCase());
      const genderMatch = p.gender?.toLowerCase() === patient.gender?.toLowerCase();
      const yobMatch = p.date_of_birth ? new Date(p.date_of_birth).getFullYear() === patient.yearOfBirth : false;
      const mobileMatch = mobile ? p.phone_primary === mobile : true;
      return nameMatch && genderMatch && yobMatch && mobileMatch;
    });
    if (matched) matchedBy.push('DEMOGRAPHICS');
  }

  if (!matched) return { patient: null, matchedBy };

  // Build care contexts from patient's encounters
  const careContexts = (matched.encounters || []).map((enc: any) => ({
    referenceNumber: enc.id,
    display: `${enc.encounter_type} — ${new Date(enc.created_at).toLocaleDateString('en-IN')}${enc.doctor_name ? ` — Dr. ${enc.doctor_name}` : ''}`,
  }));

  return {
    patient: {
      referenceNumber: matched.id,
      display: `${matched.first_name} ${matched.last_name} (${matched.uhid})`,
      careContexts,
    },
    matchedBy,
  };
}

/** Handle care context linking from HIE-CM (on /v0.5/links/link/init) */
export async function handleLinkInit(
  supabase: any,
  request: { transactionId: string; patient: { id: string; referenceNumber: string; careContexts: { referenceNumber: string }[] } },
  config: ABDMConfig
): Promise<{ link: { referenceNumber: string; authenticationType: string; meta: { communicationMedium: string; communicationHint: string; communicationExpiry: string } } }> {
  const patientId = request.patient.referenceNumber;

  // Get patient mobile for OTP
  const { data: patient } = await supabase.from('hmis_patients').select('phone_primary').eq('id', patientId).single();

  // Store link request
  await supabase.from('hmis_abdm_link_requests').insert({
    transaction_id: request.transactionId,
    patient_id: patientId,
    care_context_ids: request.patient.careContexts.map((c: any) => c.referenceNumber),
    status: 'initiated',
    otp_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const maskedMobile = patient?.phone_primary
    ? `${patient.phone_primary.slice(0, 2)}XXXXXX${patient.phone_primary.slice(-2)}`
    : 'XXXXXXXX';

  return {
    link: {
      referenceNumber: patientId,
      authenticationType: 'DIRECT',
      meta: {
        communicationMedium: 'MOBILE',
        communicationHint: maskedMobile,
        communicationExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    },
  };
}

/** Handle link confirmation with OTP (on /v0.5/links/link/confirm) */
export async function handleLinkConfirm(
  supabase: any,
  request: { confirmation: { linkRefNumber: string; token: string } }
): Promise<{ patient: { referenceNumber: string; display: string; careContexts: { referenceNumber: string; display: string }[] } }> {
  const patientId = request.confirmation.linkRefNumber;

  // Verify OTP (in production, validate the token)
  const { data: patient } = await supabase.from('hmis_patients')
    .select('id, first_name, last_name, uhid')
    .eq('id', patientId).single();

  // Get care contexts from link request
  const { data: linkReq } = await supabase.from('hmis_abdm_link_requests')
    .select('care_context_ids')
    .eq('patient_id', patientId)
    .eq('status', 'initiated')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const careContextIds = linkReq?.care_context_ids || [];

  // Fetch encounter details
  const { data: encounters } = await supabase.from('hmis_encounters')
    .select('id, encounter_type, created_at')
    .in('id', careContextIds);

  // Mark as linked
  await supabase.from('hmis_abdm_link_requests')
    .update({ status: 'linked', linked_at: new Date().toISOString() })
    .eq('patient_id', patientId)
    .eq('status', 'initiated');

  return {
    patient: {
      referenceNumber: patient.id,
      display: `${patient.first_name} ${patient.last_name} (${patient.uhid})`,
      careContexts: (encounters || []).map((e: any) => ({
        referenceNumber: e.id,
        display: `${e.encounter_type} — ${new Date(e.created_at).toLocaleDateString('en-IN')}`,
      })),
    },
  };
}

// ============================================================
// HIP — Health Data Transfer (on consent grant)
// ============================================================

/** Build FHIR health record for a care context (encounter) */
export async function buildHealthRecord(
  supabase: any,
  encounterId: string,
  hiTypes: HIType[]
): Promise<HealthRecord[]> {
  const records: HealthRecord[] = [];

  // Load encounter with all related data
  const { data: encounter } = await supabase.from('hmis_encounters')
    .select(`
      *, patient:hmis_patients(*),
      prescriptions:hmis_prescriptions(*, items:hmis_prescription_items(*)),
      lab_orders:hmis_lab_orders(*, results:hmis_lab_results(*)),
      vitals:hmis_vitals(*)
    `)
    .eq('id', encounterId).single();

  if (!encounter) return records;

  const patient = encounter.patient;
  const patientResource = {
    resourceType: 'Patient',
    id: patient.id,
    identifier: [
      { system: 'https://hospital.com/uhid', value: patient.uhid },
      ...(patient.abha_number ? [{ system: 'https://healthid.ndhm.gov.in', value: patient.abha_number }] : []),
    ],
    name: [{ text: `${patient.first_name} ${patient.last_name}` }],
    gender: patient.gender,
  };

  // OPConsultation
  if (hiTypes.includes('OPConsultation') && encounter.encounter_type === 'opd') {
    records.push({
      careContextReference: encounterId,
      careContextDisplay: `OPD Visit — ${new Date(encounter.created_at).toLocaleDateString('en-IN')}`,
      hiType: 'OPConsultation',
      data: {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          { resource: patientResource },
          {
            resource: {
              resourceType: 'Encounter',
              id: encounter.id,
              status: encounter.status,
              class: { code: 'AMB', display: 'ambulatory' },
              period: { start: encounter.created_at },
              reasonCode: encounter.chief_complaint ? [{ text: encounter.chief_complaint }] : [],
            },
          },
          ...(encounter.examination ? [{
            resource: {
              resourceType: 'Observation',
              code: { text: 'Clinical Examination' },
              valueString: encounter.examination,
            },
          }] : []),
          ...(encounter.assessment ? [{
            resource: {
              resourceType: 'Condition',
              code: { text: encounter.assessment },
              clinicalStatus: { coding: [{ code: 'active' }] },
            },
          }] : []),
        ],
      },
      patientId: patient.id,
      encounterId,
    });
  }

  // Prescription
  if (hiTypes.includes('Prescription') && encounter.prescriptions?.length > 0) {
    for (const rx of encounter.prescriptions) {
      records.push({
        careContextReference: encounterId,
        careContextDisplay: `Prescription — ${new Date(rx.created_at).toLocaleDateString('en-IN')}`,
        hiType: 'Prescription',
        data: {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            { resource: patientResource },
            ...(rx.items || []).map((item: any) => ({
              resource: {
                resourceType: 'MedicationRequest',
                status: 'active',
                medicationCodeableConcept: { text: item.drug_name },
                dosageInstruction: [{
                  text: `${item.dose || ''} ${item.frequency || ''} for ${item.duration || ''} days`,
                  route: item.route ? { text: item.route } : undefined,
                }],
              },
            })),
          ],
        },
        patientId: patient.id,
        encounterId,
      });
    }
  }

  // DiagnosticReport
  if (hiTypes.includes('DiagnosticReport') && encounter.lab_orders?.length > 0) {
    for (const order of encounter.lab_orders) {
      if (!order.results?.length) continue;
      records.push({
        careContextReference: encounterId,
        careContextDisplay: `Lab Report — ${new Date(order.created_at).toLocaleDateString('en-IN')}`,
        hiType: 'DiagnosticReport',
        data: {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            { resource: patientResource },
            {
              resource: {
                resourceType: 'DiagnosticReport',
                status: 'final',
                code: { text: order.test_name || 'Laboratory Test' },
                result: order.results.map((r: any) => ({
                  reference: `#obs-${r.id}`,
                })),
                contained: order.results.map((r: any) => ({
                  resourceType: 'Observation',
                  id: `obs-${r.id}`,
                  code: { text: r.parameter_name },
                  valueQuantity: r.value ? { value: parseFloat(r.value), unit: r.unit || '' } : undefined,
                  valueString: r.value,
                  referenceRange: r.reference_range ? [{ text: r.reference_range }] : undefined,
                  interpretation: r.is_abnormal ? [{ coding: [{ code: 'A', display: 'Abnormal' }] }] : undefined,
                })),
              },
            },
          ],
        },
        patientId: patient.id,
        encounterId,
      });
    }
  }

  return records;
}

// ============================================================
// HIU — Request Health Information (from other facilities)
// ============================================================

/** Create consent request as HIU */
export async function createConsentRequest(
  config: ABDMConfig,
  supabase: any,
  request: {
    patientAbhaAddress: string;
    purpose: ConsentPurpose;
    hiTypes: HIType[];
    dateRange: { from: string; to: string };
    expiryDate: string;
    hipId?: string;
    hipName?: string;
  },
  staffId: string
): Promise<{ consentRequestId: string; status: string }> {
  const gatewayUrl = config.isProduction ? GATEWAY_PRODUCTION : GATEWAY_SANDBOX;
  const token = await (await import('./abdm-client')).getABDMToken(config);
  if (!token) throw new Error('ABDM authentication failed');

  const requestId = crypto.randomUUID();
  const consentRequestId = crypto.randomUUID();

  // Submit to ABDM gateway
  const res = await fetch(`${gatewayUrl}/v0.5/consent-requests/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CM-ID': config.isProduction ? 'sbx' : 'sbx', // consent manager ID
    },
    body: JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      consent: {
        purpose: { text: purposeText(request.purpose), code: request.purpose, refUri: 'http://terminology.hl7.org/ValueSet/v3-PurposeOfUse' },
        patient: { id: request.patientAbhaAddress },
        hiu: { id: config.hipId },
        requester: { name: config.hipName, identifier: { type: 'REGNO', value: config.hipId, system: 'https://facility.abdm.gov.in' } },
        hiTypes: request.hiTypes,
        permission: {
          accessMode: 'VIEW',
          dateRange: request.dateRange,
          dataEraseAt: request.expiryDate,
          frequency: { unit: 'HOUR', value: 1, repeats: 0 },
        },
        ...(request.hipId ? { hip: { id: request.hipId } } : {}),
      },
    }),
  });

  const data = await res.json();

  // Store consent request locally
  await supabase.from('hmis_abdm_consent_requests').insert({
    consent_request_id: consentRequestId,
    gateway_request_id: requestId,
    patient_abha_address: request.patientAbhaAddress,
    hip_id: request.hipId,
    hip_name: request.hipName,
    purpose: request.purpose,
    hi_types: request.hiTypes,
    date_range_from: request.dateRange.from,
    date_range_to: request.dateRange.to,
    expiry_date: request.expiryDate,
    status: 'REQUESTED',
    requested_by: staffId,
  });

  return { consentRequestId, status: 'REQUESTED' };
}

/** Handle consent notification callback (on /v0.5/consents/hiu/notify) */
export async function handleConsentNotification(
  supabase: any,
  notification: {
    consentRequestId: string;
    status: ConsentStatus;
    consentArtefacts?: { id: string }[];
  }
): Promise<void> {
  await supabase.from('hmis_abdm_consent_requests').update({
    status: notification.status,
    consent_artefact_ids: notification.consentArtefacts?.map(a => a.id),
    updated_at: new Date().toISOString(),
  }).eq('consent_request_id', notification.consentRequestId);
}

// ============================================================
// HELPERS
// ============================================================

function purposeText(code: ConsentPurpose): string {
  const map: Record<ConsentPurpose, string> = {
    CAREMGT: 'Care Management',
    BTG: 'Break the Glass',
    PUBHLTH: 'Public Health',
    HPAYMT: 'Healthcare Payment',
    DSRCH: 'Disease Specific Healthcare Research',
    PATRQT: 'Self Requested',
  };
  return map[code] || code;
}
