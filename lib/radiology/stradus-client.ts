// lib/radiology/stradus-client.ts
// Server-side only — called from API routes
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

export interface StradusConfig {
  pacs_url: string;
  viewer_url: string;
  api_key?: string;
  dicom_ae_title?: string;
  dicom_ip?: string;
  dicom_port?: number;
  hl7_ip?: string;
  hl7_port?: number;
}

// ============================================================
// CONFIG
// ============================================================
export async function getStradusConfig(centreId: string): Promise<StradusConfig | null> {
  const db = adminDb();
  const { data } = await db.from('hmis_pacs_config')
    .select('*').eq('centre_id', centreId).eq('is_active', true).maybeSingle();
  return data;
}

// ============================================================
// VIEWER URL BUILDER
// ============================================================
export function buildViewerUrl(config: StradusConfig, params: {
  studyUid?: string; accession?: string; patientId?: string;
}): string | null {
  if (!config.viewer_url) return null;
  const base = config.viewer_url.replace(/\/$/, '');

  // Stradus web viewer accepts these URL params
  if (params.studyUid) return `${base}?StudyInstanceUID=${encodeURIComponent(params.studyUid)}`;
  if (params.accession) return `${base}?AccessionNumber=${encodeURIComponent(params.accession)}`;
  if (params.patientId) return `${base}?PatientID=${encodeURIComponent(params.patientId)}`;
  return null;
}

// ============================================================
// SEND ORDER TO STRADUS (outbound ORM)
// ============================================================
export async function sendOrderToStradus(centreId: string, order: {
  accession: string;
  patientUhid: string;
  patientName: string;
  patientDob?: string;
  patientGender?: string;
  modality: string;
  studyDescription: string;
  referringDoctor: string;
  scheduledDate?: string;
  scheduledTime?: string;
  urgency?: string;
  clinicalHistory?: string;
}): Promise<{ success: boolean; error?: string; stradusId?: string }> {
  const config = await getStradusConfig(centreId);
  if (!config) return { success: false, error: 'PACS not configured for this centre' };

  const db = adminDb();

  // Build HL7 ORM^O01 equivalent payload
  const payload = {
    messageType: 'ORM',
    accessionNumber: order.accession,
    patient: {
      id: order.patientUhid,
      name: order.patientName,
      dateOfBirth: order.patientDob,
      gender: order.patientGender,
    },
    order: {
      modality: order.modality,
      description: order.studyDescription,
      referringPhysician: order.referringDoctor,
      scheduledDate: order.scheduledDate,
      scheduledTime: order.scheduledTime,
      priority: order.urgency === 'stat' ? 'STAT' : order.urgency === 'urgent' ? 'URGENT' : 'ROUTINE',
      clinicalHistory: order.clinicalHistory,
    },
    facility: {
      centreId,
      sendingApplication: 'Health1-HMIS',
      sendingFacility: 'Health1',
    },
  };

  // Log outbound
  await db.from('hmis_stradus_sync_log').insert({
    direction: 'outbound', message_type: 'ORM_O01',
    accession_number: order.accession, patient_uhid: order.patientUhid,
    payload,
  });

  // If Stradus has an API endpoint, POST to it
  if (config.api_key && config.pacs_url) {
    try {
      const apiUrl = `${config.pacs_url.replace(/\/$/, '')}/api/orders`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
          'X-Sending-Facility': 'Health1-HMIS',
        },
        body: JSON.stringify(payload),
      });

      const respBody = await resp.text();
      await db.from('hmis_stradus_sync_log').update({
        response_code: resp.status, response_body: respBody, processed: resp.ok,
      }).eq('accession_number', order.accession).eq('direction', 'outbound').eq('message_type', 'ORM_O01');

      if (!resp.ok) return { success: false, error: `Stradus returned ${resp.status}: ${respBody.substring(0, 200)}` };

      let stradusId;
      try { const j = JSON.parse(respBody); stradusId = j.studyId || j.id; } catch {}
      return { success: true, stradusId };
    } catch (err: any) {
      await db.from('hmis_stradus_sync_log').update({
        error_message: err.message, processed: false,
      }).eq('accession_number', order.accession).eq('direction', 'outbound');
      return { success: false, error: 'Network error: ' + err.message };
    }
  }

  // If no API, order is logged for HL7 MLLP pickup (Stradus polls or listens)
  return { success: true };
}

// ============================================================
// PROCESS INBOUND REPORT FROM STRADUS
// ============================================================
export async function processStradusReport(payload: {
  accessionNumber: string;
  studyInstanceUID?: string;
  patientId?: string;
  modality?: string;
  studyDescription?: string;
  studyDate?: string;
  seriesCount?: number;
  imageCount?: number;
  viewerUrl?: string;
  report?: {
    findings: string;
    impression: string;
    technique?: string;
    clinicalHistory?: string;
    comparison?: string;
    isCritical?: boolean;
    criticalValue?: string;
    reportedBy?: string;
    reportedAt?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    status?: string;
    stradusReportId?: string;
    rawText?: string;
  };
}): Promise<{ success: boolean; error?: string; studyId?: string; reportId?: string }> {
  const db = adminDb();

  // Log inbound
  await db.from('hmis_stradus_sync_log').insert({
    direction: 'inbound',
    message_type: payload.report ? 'ORU_R01' : 'STUDY_UPDATE',
    accession_number: payload.accessionNumber,
    study_uid: payload.studyInstanceUID,
    patient_uhid: payload.patientId,
    payload,
  });

  // Find or create imaging study
  let study: any = null;

  // Try accession first
  const { data: existingByAccession } = await db.from('hmis_imaging_studies')
    .select('*').eq('accession_number', payload.accessionNumber).maybeSingle();

  if (existingByAccession) {
    study = existingByAccession;
  } else if (payload.studyInstanceUID) {
    const { data: existingByUid } = await db.from('hmis_imaging_studies')
      .select('*').eq('study_instance_uid', payload.studyInstanceUID).maybeSingle();
    study = existingByUid;
  }

  // If study doesn't exist, try to create from order
  if (!study) {
    // Look up the original order by accession
    const { data: order } = await db.from('hmis_radiology_orders')
      .select('*, patient:hmis_patients!inner(id, uhid)')
      .eq('accession_number', payload.accessionNumber).maybeSingle();

    if (order) {
      const { data: newStudy, error: createErr } = await db.from('hmis_imaging_studies').insert({
        centre_id: order.centre_id,
        patient_id: order.patient_id,
        order_id: order.id,
        admission_id: order.admission_id,
        accession_number: payload.accessionNumber,
        study_instance_uid: payload.studyInstanceUID,
        modality: payload.modality || order.modality,
        study_description: payload.studyDescription || order.test?.test_name || 'Unknown',
        body_part: order.body_part,
        is_contrast: order.is_contrast,
        series_count: payload.seriesCount || 0,
        image_count: payload.imageCount || 0,
        pacs_study_id: payload.studyInstanceUID,
        stradus_study_url: payload.viewerUrl,
        study_date: payload.studyDate || new Date().toISOString().split('T')[0],
        acquired_at: new Date().toISOString(),
        referring_doctor_id: order.ordered_by,
        status: 'acquired',
      }).select().single();

      if (createErr) return { success: false, error: 'Failed to create study: ' + createErr.message };
      study = newStudy;

      // Update order status
      await db.from('hmis_radiology_orders').update({
        status: 'in_progress', pacs_study_uid: payload.studyInstanceUID,
        started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', order.id);
    } else if (payload.patientId) {
      // No order found, try patient UHID match (walk-in or external referral)
      const { data: patient } = await db.from('hmis_patients')
        .select('id').eq('uhid', payload.patientId).maybeSingle();

      if (!patient) return { success: false, error: 'No matching order or patient for accession ' + payload.accessionNumber };

      // Find centre from PACS config (assume first active)
      const { data: pacsConfig } = await db.from('hmis_pacs_config')
        .select('centre_id').eq('is_active', true).limit(1).maybeSingle();

      const { data: newStudy, error: createErr } = await db.from('hmis_imaging_studies').insert({
        centre_id: pacsConfig?.centre_id,
        patient_id: patient.id,
        accession_number: payload.accessionNumber,
        study_instance_uid: payload.studyInstanceUID,
        modality: payload.modality || 'Unknown',
        study_description: payload.studyDescription || 'Unknown Study',
        series_count: payload.seriesCount || 0,
        image_count: payload.imageCount || 0,
        stradus_study_url: payload.viewerUrl,
        study_date: payload.studyDate || new Date().toISOString().split('T')[0],
        acquired_at: new Date().toISOString(),
        status: 'acquired',
      }).select().single();

      if (createErr) return { success: false, error: 'Failed to create study: ' + createErr.message };
      study = newStudy;
    } else {
      return { success: false, error: 'Cannot link study: no order or patient ID for accession ' + payload.accessionNumber };
    }
  }

  // Update study fields if we have new data
  const studyUpdates: any = { updated_at: new Date().toISOString() };
  if (payload.studyInstanceUID && !study.study_instance_uid) studyUpdates.study_instance_uid = payload.studyInstanceUID;
  if (payload.viewerUrl) studyUpdates.stradus_study_url = payload.viewerUrl;
  if (payload.seriesCount) studyUpdates.series_count = payload.seriesCount;
  if (payload.imageCount) studyUpdates.image_count = payload.imageCount;
  if (payload.viewerUrl) studyUpdates.pacs_viewer_url = payload.viewerUrl;

  // Process report if included
  let reportId: string | undefined;
  if (payload.report) {
    const reportStatus = payload.report.verifiedBy ? 'verified' : payload.report.status === 'final' ? 'final' : 'preliminary';

    const { data: newReport, error: rErr } = await db.from('hmis_imaging_reports').insert({
      study_id: study.id,
      centre_id: study.centre_id,
      report_status: reportStatus,
      technique: payload.report.technique,
      clinical_history: payload.report.clinicalHistory,
      comparison: payload.report.comparison,
      findings: payload.report.findings,
      impression: payload.report.impression,
      is_critical: payload.report.isCritical || false,
      critical_value: payload.report.criticalValue,
      reported_by_name: payload.report.reportedBy,
      reported_at: payload.report.reportedAt || new Date().toISOString(),
      verified_by_name: payload.report.verifiedBy,
      verified_at: payload.report.verifiedAt,
      source: 'stradus',
      stradus_report_id: payload.report.stradusReportId,
      raw_report_text: payload.report.rawText,
      tat_minutes: study.created_at ? Math.round((Date.now() - new Date(study.created_at).getTime()) / 60000) : null,
    }).select().single();

    if (!rErr && newReport) {
      reportId = newReport.id;
      studyUpdates.status = reportStatus === 'verified' ? 'verified' : 'reported';

      // Update order status
      if (study.order_id) {
        await db.from('hmis_radiology_orders').update({
          status: reportStatus === 'verified' ? 'verified' : 'reported',
          reported_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', study.order_id);
      }

      // Critical finding workflow
      if (payload.report.isCritical) {
        await db.from('hmis_critical_findings').insert({
          report_id: newReport.id,
          study_id: study.id,
          patient_id: study.patient_id,
          centre_id: study.centre_id,
          finding_text: payload.report.criticalValue || payload.report.impression,
          severity: 'critical',
        });
      }
    }
  }

  await db.from('hmis_imaging_studies').update(studyUpdates).eq('id', study.id);

  // Mark sync log as processed
  await db.from('hmis_stradus_sync_log').update({ processed: true })
    .eq('accession_number', payload.accessionNumber).eq('direction', 'inbound');

  return { success: true, studyId: study.id, reportId };
}

// ============================================================
// MANUAL STUDY LINK — for linking a Stradus URL to a patient
// ============================================================
export async function linkStudyManually(data: {
  centreId: string;
  patientId: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  studyDate: string;
  stradusUrl: string;
  studyInstanceUid?: string;
  orderId?: string;
  admissionId?: string;
  referringDoctorId?: string;
}): Promise<{ success: boolean; error?: string; studyId?: string }> {
  const db = adminDb();

  // Check duplicate accession
  const { data: existing } = await db.from('hmis_imaging_studies')
    .select('id').eq('accession_number', data.accessionNumber).maybeSingle();
  if (existing) return { success: false, error: 'Study with this accession number already exists' };

  const { data: study, error } = await db.from('hmis_imaging_studies').insert({
    centre_id: data.centreId,
    patient_id: data.patientId,
    order_id: data.orderId || null,
    admission_id: data.admissionId || null,
    accession_number: data.accessionNumber,
    study_instance_uid: data.studyInstanceUid,
    modality: data.modality,
    study_description: data.studyDescription,
    stradus_study_url: data.stradusUrl,
    pacs_viewer_url: data.stradusUrl,
    study_date: data.studyDate,
    acquired_at: new Date().toISOString(),
    referring_doctor_id: data.referringDoctorId,
    status: 'acquired',
  }).select().single();

  if (error) return { success: false, error: error.message };
  return { success: true, studyId: study.id };
}
