// lib/radiology/stradus-client.ts
// Stradus PACS/RIS Integration Client
// Handles: URL building, HL7 ORU parsing, report ingestion, study linking

export interface StradusConfig {
  pacsUrl: string;          // e.g., https://pacs.health1hospitals.com
  viewerUrl: string;        // e.g., https://pacs.health1hospitals.com/viewer
  risUrl?: string;          // e.g., https://pacs.health1hospitals.com/ris
  dicomAeTitle: string;     // e.g., HEALTH1_HMIS
  dicomIp: string;
  dicomPort: number;
  hl7Ip?: string;
  hl7Port?: number;
  apiKey?: string;
  webhookSecret?: string;   // HMAC secret for verifying Stradus callbacks
}

export interface StradusStudy {
  studyInstanceUid: string;
  accessionNumber: string;
  patientId: string;        // UHID
  patientName: string;
  studyDate: string;        // YYYYMMDD
  modality: string;
  studyDescription: string;
  seriesCount: number;
  imageCount: number;
  referringPhysician: string;
  performingPhysician: string;
  institutionName: string;
  stationName: string;
  viewerUrl: string;        // Direct link to open in Stradus viewer
}

export interface StradusReport {
  accessionNumber: string;
  studyInstanceUid: string;
  patientId: string;
  modality: string;
  studyDescription: string;
  reportStatus: 'preliminary' | 'final' | 'corrected' | 'addendum';
  reportDateTime: string;
  reportingRadiologist: string;
  verifyingRadiologist?: string;
  technique?: string;
  clinicalHistory?: string;
  comparison?: string;
  findings: string;
  impression: string;
  isCritical: boolean;
  rawHl7?: string;
}

// ============================================================
// URL BUILDERS — for opening studies in Stradus web viewer
// ============================================================

/**
 * Build a Stradus viewer URL from a Study Instance UID.
 * This is the primary way to open images — most reliable.
 */
export function buildViewerUrlByStudyUid(config: StradusConfig, studyUid: string): string {
  const base = config.viewerUrl.replace(/\/$/, '');
  return `${base}?StudyInstanceUID=${encodeURIComponent(studyUid)}`;
}

/**
 * Build a Stradus viewer URL from an accession number.
 * Fallback when Study UID is not yet available (images not acquired).
 */
export function buildViewerUrlByAccession(config: StradusConfig, accession: string): string {
  const base = config.viewerUrl.replace(/\/$/, '');
  return `${base}?AccessionNumber=${encodeURIComponent(accession)}`;
}

/**
 * Build a Stradus viewer URL from patient ID (UHID) — shows all studies for patient.
 */
export function buildViewerUrlByPatient(config: StradusConfig, patientId: string): string {
  const base = config.viewerUrl.replace(/\/$/, '');
  return `${base}?PatientID=${encodeURIComponent(patientId)}`;
}

/**
 * Build a Stradus viewer URL with multiple parameters for precise study lookup.
 */
export function buildViewerUrl(config: StradusConfig, params: {
  studyUid?: string; accession?: string; patientId?: string;
}): string | null {
  if (!config.viewerUrl) return null;
  if (params.studyUid) return buildViewerUrlByStudyUid(config, params.studyUid);
  if (params.accession) return buildViewerUrlByAccession(config, params.accession);
  if (params.patientId) return buildViewerUrlByPatient(config, params.patientId);
  return null;
}

/**
 * Build a complete Stradus link object for storage in patient file.
 * This is what gets saved to hmis_radiology_orders.stradus_link
 */
export function buildStudyLink(config: StradusConfig, study: {
  studyUid?: string;
  accession?: string;
  modality?: string;
  description?: string;
  date?: string;
}): { url: string; label: string; studyUid?: string; accession?: string } | null {
  const url = buildViewerUrl(config, { studyUid: study.studyUid, accession: study.accession });
  if (!url) return null;
  const label = [study.modality, study.description, study.date].filter(Boolean).join(' — ');
  return { url, label, studyUid: study.studyUid, accession: study.accession };
}

// ============================================================
// HL7 ORU PARSER — parse Stradus report messages
// ============================================================

/**
 * Parse HL7 v2.x ORU^R01 message from Stradus into structured report.
 * Stradus sends HL7 ORU messages when a radiologist finalizes a report.
 * 
 * HL7 ORU^R01 segments we care about:
 * MSH — message header
 * PID — patient identification (PID.3 = UHID)
 * OBR — observation request (OBR.3 = accession, OBR.4 = test, OBR.25 = status)
 * OBX — observation result (OBX.3 = field type, OBX.5 = value)
 */
export function parseHl7OruMessage(raw: string): StradusReport | null {
  try {
    const segments = raw.split(/\r?\n|\r/).filter(s => s.length > 0);
    const getSegment = (type: string) => segments.filter(s => s.startsWith(type + '|'));
    const getField = (segment: string, index: number): string => {
      const fields = segment.split('|');
      return (fields[index] || '').trim();
    };
    const getComponent = (field: string, index: number): string => {
      const parts = field.split('^');
      return (parts[index] || '').trim();
    };

    const msh = getSegment('MSH')[0];
    if (!msh) return null;

    const pid = getSegment('PID')[0];
    const obr = getSegment('OBR')[0];
    const obxList = getSegment('OBX');

    if (!pid || !obr) return null;

    // Patient ID from PID.3 (first component)
    const patientId = getComponent(getField(pid, 3), 0);

    // Accession from OBR.3 or OBR.18
    const accession = getField(obr, 3) || getField(obr, 18);

    // Study Instance UID from OBR.21 (custom) or OBX with tag
    const studyUid = getField(obr, 21) || '';

    // Test description from OBR.4
    const testField = getField(obr, 4);
    const studyDescription = getComponent(testField, 1) || getComponent(testField, 0);
    const modality = getComponent(testField, 3) || '';

    // Report status from OBR.25: F=final, P=preliminary, C=corrected, A=addendum
    const statusCode = getField(obr, 25).toUpperCase();
    const reportStatus: StradusReport['reportStatus'] =
      statusCode === 'F' ? 'final' : statusCode === 'C' ? 'corrected' :
      statusCode === 'A' ? 'addendum' : 'preliminary';

    // Reporting radiologist from OBR.32
    const radField = getField(obr, 32);
    const reportingRadiologist = [getComponent(radField, 1), getComponent(radField, 2)].filter(Boolean).join(' ') || getComponent(radField, 0);

    // Verifying radiologist from OBR.35
    const verField = getField(obr, 35);
    const verifyingRadiologist = [getComponent(verField, 1), getComponent(verField, 2)].filter(Boolean).join(' ') || undefined;

    // Report date from OBR.22
    const reportDateTime = getField(obr, 22);

    // Extract report sections from OBX segments
    // Common OBX.3 identifiers:
    // "TECH" or "11529-5" = Technique
    // "HX" or "29299-5" = Clinical History
    // "COMP" = Comparison
    // "FIND" or "18782-3" = Findings
    // "IMP" or "19005-8" = Impression
    // "CRIT" = Critical flag
    // Generic text in OBX.5

    let technique = '';
    let clinicalHistory = '';
    let comparison = '';
    let findings = '';
    let impression = '';
    let isCritical = false;

    const allText: string[] = [];

    obxList.forEach(obx => {
      const obxId = getField(obx, 3).toUpperCase();
      const obxIdCode = getComponent(obxId, 0).toUpperCase();
      const value = getField(obx, 5).replace(/\\.br\\/g, '\n').replace(/\\R\\/g, '\n');

      if (obxIdCode.includes('TECH') || obxIdCode === '11529-5') {
        technique += (technique ? '\n' : '') + value;
      } else if (obxIdCode.includes('HX') || obxIdCode === '29299-5' || obxIdCode.includes('CLINICAL')) {
        clinicalHistory += (clinicalHistory ? '\n' : '') + value;
      } else if (obxIdCode.includes('COMP') || obxIdCode.includes('COMPARISON')) {
        comparison += (comparison ? '\n' : '') + value;
      } else if (obxIdCode.includes('FIND') || obxIdCode === '18782-3') {
        findings += (findings ? '\n' : '') + value;
      } else if (obxIdCode.includes('IMP') || obxIdCode === '19005-8' || obxIdCode.includes('CONCLUSION')) {
        impression += (impression ? '\n' : '') + value;
      } else if (obxIdCode.includes('CRIT')) {
        isCritical = value.toUpperCase() === 'Y' || value === '1' || value.toUpperCase() === 'TRUE';
      } else {
        allText.push(value);
      }
    });

    // If structured sections weren't found, try to split generic text
    if (!findings && !impression && allText.length > 0) {
      const fullText = allText.join('\n');
      // Try to find "Impression:" or "Conclusion:" delimiter
      const impMatch = fullText.match(/(?:impression|conclusion|summary)\s*[:]\s*([\s\S]*)/i);
      if (impMatch) {
        impression = impMatch[1].trim();
        findings = fullText.substring(0, fullText.indexOf(impMatch[0])).trim();
      } else {
        findings = fullText;
        impression = '(See findings)';
      }
    }

    return {
      accessionNumber: accession,
      studyInstanceUid: studyUid,
      patientId,
      modality,
      studyDescription,
      reportStatus,
      reportDateTime,
      reportingRadiologist,
      verifyingRadiologist,
      technique,
      clinicalHistory,
      comparison,
      findings,
      impression,
      isCritical,
      rawHl7: raw,
    };
  } catch (err) {
    console.error('HL7 ORU parse error:', err);
    return null;
  }
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

/**
 * Verify HMAC-SHA256 signature from Stradus webhook.
 * Stradus signs payloads with a shared secret.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === signature.replace(/^sha256=/, '');
  } catch {
    return false;
  }
}

// ============================================================
// HL7 ORM BUILDER — send order to Stradus
// ============================================================

/**
 * Build HL7 ORM^O01 message for sending an order to Stradus.
 * Stradus creates a worklist entry from this message.
 */
export function buildHl7OrmMessage(order: {
  accessionNumber: string;
  patientId: string;
  patientName: string;  // "LAST^FIRST"
  dob: string;          // YYYYMMDD
  gender: string;       // M/F/O
  testCode: string;
  testName: string;
  modality: string;
  urgency: string;      // R/S/A (routine/stat/asap)
  referringDoctor: string;
  scheduledDate?: string; // YYYYMMDDHHMMSS
  clinicalIndication?: string;
}): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const msgId = `HMIS-${ts}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

  const urgencyCode = order.urgency === 'stat' ? 'S' : order.urgency === 'urgent' ? 'A' : 'R';
  const gender = order.gender?.toUpperCase() === 'MALE' ? 'M' : order.gender?.toUpperCase() === 'FEMALE' ? 'F' : 'O';

  const segments = [
    `MSH|^~\\&|HEALTH1_HMIS|HEALTH1|STRADUS_PACS|STRADUS|${ts}||ORM^O01|${msgId}|P|2.3.1`,
    `PID|||${order.patientId}||${order.patientName}||${order.dob}|${gender}`,
    `PV1|||||||${order.referringDoctor}`,
    `ORC|NW|${order.accessionNumber}|||IP||1^^^${order.scheduledDate || ts}||${ts}|||${order.referringDoctor}`,
    `OBR|1|${order.accessionNumber}||${order.testCode}^${order.testName}^L|||${order.scheduledDate || ts}||||${order.clinicalIndication || ''}||||||||||||||${urgencyCode}||||||${order.modality}`,
  ];

  return segments.join('\r');
}

// ============================================================
// JSON REPORT PARSER (alternative to HL7)
// ============================================================

/**
 * Parse a JSON report payload from Stradus REST API callback.
 * Some Stradus configurations send JSON instead of HL7.
 */
export function parseJsonReport(json: any): StradusReport | null {
  try {
    return {
      accessionNumber: json.accession_number || json.accessionNumber || '',
      studyInstanceUid: json.study_instance_uid || json.studyInstanceUid || json.study_uid || '',
      patientId: json.patient_id || json.patientId || json.mrn || '',
      modality: json.modality || '',
      studyDescription: json.study_description || json.studyDescription || json.procedure_name || '',
      reportStatus: json.report_status === 'F' ? 'final' : json.report_status === 'P' ? 'preliminary' :
                    json.report_status === 'C' ? 'corrected' : json.report_status || 'final',
      reportDateTime: json.report_datetime || json.reportDateTime || json.finalized_at || new Date().toISOString(),
      reportingRadiologist: json.reporting_radiologist || json.reportingRadiologist || json.radiologist || '',
      verifyingRadiologist: json.verifying_radiologist || json.verifyingRadiologist || undefined,
      technique: json.technique || '',
      clinicalHistory: json.clinical_history || json.clinicalHistory || '',
      comparison: json.comparison || '',
      findings: json.findings || '',
      impression: json.impression || json.conclusion || '',
      isCritical: json.is_critical === true || json.isCritical === true || json.critical === true,
      rawHl7: undefined,
    };
  } catch {
    return null;
  }
}

export default {
  buildViewerUrl, buildViewerUrlByStudyUid, buildViewerUrlByAccession, buildViewerUrlByPatient,
  buildStudyLink, parseHl7OruMessage, parseJsonReport, verifyWebhookSignature, buildHl7OrmMessage,
};
