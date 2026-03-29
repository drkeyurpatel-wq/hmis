// lib/lab/report-templates.ts
// Per-department lab report printing with Hospital branding

import { openPrintWindow } from '@/components/ui/shared';

interface ReportData {
  patientName: string; uhid: string; age: string | number; gender: string;
  testName: string; testCode: string; barcode?: string;
  orderedBy: string; collectedAt?: string; reportedAt?: string; verifiedBy?: string;
  centreName?: string; centreAddress?: string;
  results: { parameterName: string; value: string; unit: string; refRange: string; flag: string }[];
}

interface CultureReportData extends ReportData {
  specimenType: string;
  gramStain?: string;
  isolates: {
    organism: string; quantity: string; isAlert: boolean;
    sensitivities: { antibiotic: string; abxClass: string; interpretation: string; isRestricted: boolean }[];
  }[];
  finalReport?: string;
}

interface HistoReportData {
  patientName: string; uhid: string; age: string | number; gender: string;
  caseNumber: string; specimenType: string; specimenSite?: string;
  clinicalHistory?: string; clinicalDiagnosis?: string; surgeonName?: string;
  grossDescription?: string; grossMeasurements?: string;
  microDescription?: string; diagnosis?: string;
  icdCode?: string; tumorGrade?: string; marginStatus?: string;
  lymphNodeStatus?: string; tnmStaging?: string;
  specialStains?: string[]; ihcMarkers?: string[];
  addendum?: string; addendumDate?: string;
  reportedAt?: string; verifiedBy?: string;
  centreName?: string; centreAddress?: string;
}

const HEADER = (centreName?: string, centreAddress?: string) => `
<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:12px">
  <div>
    <div style="font-size:18px;font-weight:700;color:#1e40af">${centreName || 'Health1 Super Speciality Hospitals'}</div>
    <div style="font-size:8px;color:#666">${centreAddress || 'Shilaj, Ahmedabad'} | NABL Accredited</div>
  </div>
  <div style="text-align:right;font-size:9px;color:#666">
    <div style="font-size:12px;font-weight:700;color:#1e40af">LABORATORY REPORT</div>
    Printed: ${new Date().toLocaleString('en-IN')}
  </div>
</div>`;

const PATIENT_INFO = (d: { patientName: string; uhid: string; age: string | number; gender: string; barcode?: string; orderedBy?: string; collectedAt?: string }) => `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:12px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
  <div><b>Patient:</b> ${d.patientName}</div><div><b>UHID:</b> ${d.uhid}</div>
  <div><b>Age/Sex:</b> ${d.age} / ${d.gender}</div><div><b>Barcode:</b> ${d.barcode || '—'}</div>
  <div><b>Referred by:</b> ${d.orderedBy ? 'Dr. ' + d.orderedBy : '—'}</div><div><b>Collected:</b> ${d.collectedAt || '—'}</div>
</div>`;

const SIGNATURE = (verifiedBy?: string, reportedAt?: string) => `
<div style="display:flex;justify-content:space-between;margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb">
  <div style="text-align:center;font-size:9px;color:#666"><div style="width:140px;border-bottom:1px solid #333;margin-bottom:4px"></div>Lab Technician</div>
  <div style="text-align:center;font-size:9px;color:#666"><div style="width:140px;border-bottom:1px solid #333;margin-bottom:4px"></div>${verifiedBy || 'Pathologist'}</div>
</div>
<div style="margin-top:12px;font-size:7px;color:#aaa;text-align:center">
  This is a computer-generated report. ${reportedAt ? 'Reported: ' + reportedAt : ''}<br/>Health1 Super Speciality Hospitals — Quality Healthcare for All
</div>`;

const flagStyle = (f: string) => f === 'CRITICAL' ? 'color:#dc2626;font-weight:900' : f === 'ABN' || f === 'HIGH' || f === 'LOW' ? 'color:#d97706;font-weight:700' : '';

// ============================================================
// BIOCHEMISTRY / HEMATOLOGY REPORT
// ============================================================
export function printBiochemReport(data: ReportData) {
  const rows = data.results.map(r => `<tr>
    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${r.parameterName}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px;${flagStyle(r.flag)}">${r.value}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9px;color:#666">${r.unit}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9px;color:#888">${r.refRange}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9px;${flagStyle(r.flag)}">${r.flag || ''}</td>
  </tr>`).join('');

  openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
    ${HEADER(data.centreName, data.centreAddress)}
    ${PATIENT_INFO(data)}
    <div style="font-size:13px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:4px;margin-bottom:8px">${data.testName} (${data.testCode})</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#eff6ff">
        <th style="padding:5px 8px;text-align:left;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Parameter</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Result</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Unit</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Reference Range</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Flag</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>
    <div style="font-size:7px;color:#888;margin-top:8px"><b>Flags:</b> CRITICAL = Immediate attention | ABN = Outside reference range</div>
    ${SIGNATURE(data.verifiedBy, data.reportedAt)}
  </div>`, `Lab Report — ${data.uhid} — ${data.testCode}`);
}

// ============================================================
// CULTURE & SENSITIVITY REPORT
// ============================================================
export function printCultureReport(data: CultureReportData) {
  const isolateHtml = data.isolates.map((iso, idx) => {
    const sensRows = iso.sensitivities.map(s => {
      const color = s.interpretation === 'S' ? 'color:#16a34a;font-weight:700' : s.interpretation === 'R' ? 'color:#dc2626;font-weight:700' : 'color:#d97706';
      return `<tr>
        <td style="padding:3px 8px;border-bottom:1px solid #e5e7eb;font-size:9px">${s.antibiotic}${s.isRestricted ? ' <span style="color:#d97706;font-size:7px">R</span>' : ''}</td>
        <td style="padding:3px 8px;border-bottom:1px solid #e5e7eb;font-size:9px;color:#888">${s.abxClass}</td>
        <td style="padding:3px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px;${color}">${s.interpretation}</td>
      </tr>`;
    }).join('');

    return `
    <div style="margin-top:12px;padding:8px;border:1px solid #e2e8f0;border-radius:6px;${iso.isAlert ? 'border-color:#fca5a5;background:#fef2f2' : ''}">
      <div style="font-size:11px;font-weight:700;margin-bottom:6px">
        Isolate #${idx + 1}: ${iso.organism}
        ${iso.isAlert ? '<span style="background:#dc2626;color:white;font-size:8px;padding:1px 6px;border-radius:3px;margin-left:6px">ALERT ORGANISM</span>' : ''}
        <span style="font-weight:400;font-size:9px;color:#666;margin-left:8px">${iso.quantity} growth</span>
      </div>
      ${sensRows ? `<table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f0fdf4"><th style="padding:3px 8px;text-align:left;font-size:9px;color:#166534">Antibiotic</th>
        <th style="padding:3px 8px;text-align:left;font-size:9px;color:#166534">Class</th>
        <th style="padding:3px 8px;text-align:center;font-size:9px;color:#166534">S/I/R</th></tr></thead>
        <tbody>${sensRows}</tbody></table>` : ''}
    </div>`;
  }).join('');

  openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
    ${HEADER(data.centreName, data.centreAddress)}
    ${PATIENT_INFO(data)}
    <div style="font-size:13px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:4px;margin-bottom:8px">CULTURE & SENSITIVITY REPORT</div>
    <div style="font-size:10px;margin-bottom:8px"><b>Specimen:</b> ${data.specimenType} | <b>Test:</b> ${data.testName}</div>
    ${data.gramStain ? `<div style="padding:6px 8px;background:#f0f9ff;border-radius:4px;font-size:10px;margin-bottom:8px"><b>Gram Stain:</b> ${data.gramStain}</div>` : ''}
    ${data.isolates.length === 0 ? '<div style="padding:12px;background:#f0fdf4;border-radius:6px;font-size:12px;font-weight:700;color:#166534;text-align:center">No bacterial growth after 48 hours of incubation</div>' : isolateHtml}
    ${data.finalReport ? `<div style="margin-top:12px;padding:8px;background:#eff6ff;border-radius:6px;font-size:10px"><b>Interpretation:</b> ${data.finalReport}</div>` : ''}
    <div style="font-size:7px;color:#888;margin-top:8px"><b>S</b> = Sensitive | <b>I</b> = Intermediate | <b>R</b> = Resistant | <b>R</b>(orange) = Restricted antibiotic</div>
    ${SIGNATURE(data.verifiedBy, data.reportedAt)}
  </div>`, `Culture Report — ${data.uhid}`);
}

// ============================================================
// HISTOPATHOLOGY REPORT
// ============================================================
export function printHistoReport(data: HistoReportData) {
  openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
    ${HEADER(data.centreName, data.centreAddress)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:12px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
      <div><b>Patient:</b> ${data.patientName}</div><div><b>UHID:</b> ${data.uhid}</div>
      <div><b>Age/Sex:</b> ${data.age} / ${data.gender}</div><div><b>Case No:</b> ${data.caseNumber}</div>
      <div><b>Surgeon:</b> ${data.surgeonName || '—'}</div><div><b>Specimen:</b> ${data.specimenType}</div>
    </div>

    <div style="font-size:13px;font-weight:700;color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:4px;margin-bottom:12px">HISTOPATHOLOGY REPORT</div>

    ${data.clinicalHistory ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:2px">CLINICAL HISTORY</div><div style="font-size:10px">${data.clinicalHistory}</div></div>` : ''}
    ${data.clinicalDiagnosis ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:2px">CLINICAL DIAGNOSIS</div><div style="font-size:10px">${data.clinicalDiagnosis}</div></div>` : ''}

    ${data.grossDescription ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:2px">GROSS DESCRIPTION</div>
      <div style="font-size:10px">${data.grossDescription}</div>
      ${data.grossMeasurements ? `<div style="font-size:9px;color:#666;margin-top:2px">Measurements: ${data.grossMeasurements}</div>` : ''}
    </div>` : ''}

    ${data.microDescription ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:2px">MICROSCOPIC DESCRIPTION</div><div style="font-size:10px">${data.microDescription}</div></div>` : ''}

    ${data.diagnosis ? `<div style="margin-bottom:10px;padding:10px;background:#f5f3ff;border:1px solid #c4b5fd;border-radius:6px">
      <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:4px">DIAGNOSIS</div>
      <div style="font-size:12px;font-weight:700">${data.diagnosis}</div>
      ${data.icdCode ? `<div style="font-size:9px;color:#666;margin-top:4px">ICD-O: ${data.icdCode}</div>` : ''}
      ${data.tumorGrade ? `<div style="font-size:9px;color:#666">Grade: ${data.tumorGrade}</div>` : ''}
      ${data.marginStatus && data.marginStatus !== 'not_applicable' ? `<div style="font-size:9px;color:${data.marginStatus === 'involved' ? '#dc2626' : '#666'}">Margins: ${data.marginStatus}${data.marginStatus === 'involved' ? ' ⚠️' : ''}</div>` : ''}
      ${data.lymphNodeStatus ? `<div style="font-size:9px;color:#666">Lymph Nodes: ${data.lymphNodeStatus}</div>` : ''}
      ${data.tnmStaging ? `<div style="font-size:9px;color:#666">TNM: ${data.tnmStaging}</div>` : ''}
    </div>` : ''}

    ${data.specialStains?.length ? `<div style="font-size:9px;color:#666;margin-bottom:4px"><b>Special Stains:</b> ${data.specialStains.join(', ')}</div>` : ''}
    ${data.ihcMarkers?.length ? `<div style="font-size:9px;color:#666;margin-bottom:4px"><b>IHC Markers:</b> ${data.ihcMarkers.join(', ')}</div>` : ''}

    ${data.addendum ? `<div style="margin-top:10px;padding:8px;background:#fefce8;border:1px solid #fde68a;border-radius:6px">
      <div style="font-size:10px;font-weight:700;color:#a16207">ADDENDUM${data.addendumDate ? ' — ' + data.addendumDate : ''}</div>
      <div style="font-size:10px">${data.addendum}</div>
    </div>` : ''}

    ${SIGNATURE(data.verifiedBy, data.reportedAt)}
  </div>`, `Histo Report — ${data.uhid} — ${data.caseNumber}`);
}

// ============================================================
// WHATSAPP REPORT DELIVERY
// ============================================================
export function sendLabReportWhatsApp(phone: string, data: {
  patientName: string; uhid: string; testName: string;
  resultSummary: string; reportUrl?: string;
}) {
  // Using WhatsApp API template (wa.me deep link for now, replace with API in production)
  const message = encodeURIComponent(
    `*Health1 — Lab Report*\n\n` +
    `Patient: *${data.patientName}*\n` +
    `UHID: ${data.uhid}\n` +
    `Test: *${data.testName}*\n\n` +
    `${data.resultSummary}\n\n` +
    `${data.reportUrl ? '📄 Report: ' + data.reportUrl + '\n\n' : ''}` +
    `_Please collect your original report from Health1 Hospital._\n` +
    `_For queries, call Health1 Lab: +91 79 4890 1234_`
  );
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
  window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
}

// Generate result summary text for WhatsApp
export function generateResultSummary(results: { parameterName: string; value: string; unit: string; flag: string }[]): string {
  const abnormal = results.filter(r => r.flag);
  if (abnormal.length === 0) return '✅ All parameters within normal limits.';
  const lines = abnormal.map(r => {
    const icon = r.flag === 'CRITICAL' ? '🔴' : '🟡';
    return `${icon} ${r.parameterName}: *${r.value}* ${r.unit} (${r.flag})`;
  });
  const normal = results.length - abnormal.length;
  return lines.join('\n') + (normal > 0 ? `\n✅ ${normal} other parameter(s) normal` : '');
}
