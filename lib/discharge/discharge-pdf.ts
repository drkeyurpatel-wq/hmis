// lib/discharge/discharge-pdf.ts
// Generates a structured discharge summary PDF using jsPDF + jspdf-autotable
// Data comes from the discharge engine's state (admission, patient, ds form)

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TEAL = [13, 148, 136] as const;      // #0d9488
const BLUE = [30, 64, 175] as const;       // #1e40af
const DARK = [26, 26, 26] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_BLUE = [239, 246, 255] as const;
const RED = [220, 38, 38] as const;

interface DischargeMed {
  drug: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
}
interface FollowUp {
  department: string; doctor: string; date: string; instructions: string;
}
interface DischargeData {
  admissionDate: string; dischargeDate: string;
  admittingDiagnosis: string; finalDiagnosis: string; icdCodes?: string;
  hospitalCourse: string; proceduresDone: string; investigationSummary: string;
  conditionAtDischarge: string;
  dischargeMeds: DischargeMed[];
  dietAdvice: string[]; activityAdvice: string[]; woundCare: string[];
  warningSignsToWatch: string[];
  followUp: FollowUp[];
  specialInstructions: string;
  dischargeType: string;
}
interface PatientInfo {
  first_name: string; last_name?: string; uhid: string;
  age_years: number; gender: string; blood_group?: string;
  phone_primary?: string;
}
interface AdmissionInfo {
  ipd_number: string;
  department?: { name: string };
  doctor?: { full_name: string; specialisation?: string };
}

// Helper: add a section title
function sectionTitle(doc: jsPDF, y: number, title: string, pageW: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(title, 15, y);
  doc.setDrawColor(...BLUE);
  doc.line(15, y + 1, pageW - 15, y + 1);
  return y + 5;
}

// Helper: add wrapped body text
function bodyText(doc: jsPDF, y: number, text: string, pageW: number): number {
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  const maxW = pageW - 30;
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, 15, y);
    y += 3.5;
  }
  return y + 1;
}

export function generateDischargePDF(
  ds: DischargeData,
  patient: PatientInfo,
  admission: AdmissionInfo,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  // ========== HEADER ==========
  // Teal accent bar
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 3, 'F');

  // Hospital name
  y = 14;
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.text('Health1 Super Speciality Hospital', 15, y);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Shilaj, Ahmedabad  |  NABH Accredited  |  HFR: IN2410013685', 15, y + 5);

  // Title
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('DISCHARGE SUMMARY', pageW - 15, y, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), pageW - 15, y + 5, { align: 'right' });

  y += 10;
  doc.setDrawColor(...TEAL);
  doc.line(15, y, pageW - 15, y);
  y += 4;

  // ========== PATIENT INFO BOX ==========
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(15, y, pageW - 30, 22, 2, 2, 'F');

  const col1 = 18; const col2 = pageW / 2 + 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  const infoY = y + 4;

  const info = (x: number, ly: number, label: string, val: string) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, x, ly);
    doc.setFont('helvetica', 'normal'); doc.text(val, x + doc.getTextWidth(label) + 1, ly);
  };

  info(col1, infoY, 'Patient: ', `${patient.first_name} ${patient.last_name || ''}`);
  info(col2, infoY, 'UHID: ', patient.uhid);
  info(col1, infoY + 4.5, 'Age/Sex: ', `${patient.age_years}yr / ${patient.gender}`);
  info(col2, infoY + 4.5, 'IPD No: ', admission.ipd_number);
  info(col1, infoY + 9, 'Admitted: ', ds.admissionDate);
  info(col2, infoY + 9, 'Discharged: ', ds.dischargeDate);
  info(col1, infoY + 13.5, 'Department: ', admission.department?.name || '');
  info(col2, infoY + 13.5, 'Consultant: ', `Dr. ${admission.doctor?.full_name || ''}`);

  y += 26;

  // ========== DIAGNOSIS ==========
  if (ds.admittingDiagnosis) {
    y = sectionTitle(doc, y, 'ADMITTING DIAGNOSIS', pageW);
    y = bodyText(doc, y, ds.admittingDiagnosis, pageW);
  }
  if (ds.finalDiagnosis) {
    y = sectionTitle(doc, y, 'FINAL DIAGNOSIS', pageW);
    y = bodyText(doc, y, ds.finalDiagnosis + (ds.icdCodes ? `  (ICD-10: ${ds.icdCodes})` : ''), pageW);
  }

  // ========== HOSPITAL COURSE ==========
  if (ds.hospitalCourse) {
    y = sectionTitle(doc, y, 'HOSPITAL COURSE', pageW);
    y = bodyText(doc, y, ds.hospitalCourse, pageW);
  }

  // ========== PROCEDURES ==========
  if (ds.proceduresDone && ds.proceduresDone !== 'No procedures performed during this admission.') {
    y = sectionTitle(doc, y, 'PROCEDURES PERFORMED', pageW);
    y = bodyText(doc, y, ds.proceduresDone, pageW);
  }

  // ========== INVESTIGATIONS ==========
  if (ds.investigationSummary) {
    y = sectionTitle(doc, y, 'INVESTIGATION SUMMARY', pageW);
    y = bodyText(doc, y, ds.investigationSummary, pageW);
  }

  // ========== CONDITION AT DISCHARGE ==========
  y = sectionTitle(doc, y, 'CONDITION AT DISCHARGE', pageW);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(ds.conditionAtDischarge, 15, y); y += 5;

  // ========== DISCHARGE MEDICATIONS TABLE ==========
  if (ds.dischargeMeds.length > 0) {
    y = sectionTitle(doc, y, 'DISCHARGE MEDICATIONS', pageW);
    if (y > 240) { doc.addPage(); y = 20; }

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [['#', 'Medication', 'Dose', 'Route', 'Frequency', 'Duration', 'Instructions']],
      body: ds.dischargeMeds.map((m, i) => [
        String(i + 1), m.drug, m.dose, m.route, m.frequency, m.duration, m.instructions || '',
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [...LIGHT_BLUE] as any, textColor: [...BLUE] as any, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40, fontStyle: 'bold' },
        6: { cellWidth: 30, fontSize: 6.5 },
      },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY + 4 || y + 20;
  }

  // ========== DIET / ACTIVITY / WOUND ==========
  if (ds.dietAdvice.length > 0) {
    y = sectionTitle(doc, y, 'DIET ADVICE', pageW);
    y = bodyText(doc, y, ds.dietAdvice.join(', '), pageW);
  }
  if (ds.activityAdvice.length > 0) {
    y = sectionTitle(doc, y, 'ACTIVITY ADVICE', pageW);
    y = bodyText(doc, y, ds.activityAdvice.join(', '), pageW);
  }
  if (ds.woundCare.length > 0) {
    y = sectionTitle(doc, y, 'WOUND CARE', pageW);
    y = bodyText(doc, y, ds.woundCare.join(', '), pageW);
  }

  // ========== WARNING SIGNS (red box) ==========
  if (ds.warningSignsToWatch.length > 0) {
    if (y > 245) { doc.addPage(); y = 20; }
    y = y + 1;
    const boxH = 6 + ds.warningSignsToWatch.length * 3.5;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(...RED);
    doc.roundedRect(15, y - 2, pageW - 30, boxH, 2, 2, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text('WARNING SIGNS \u2014 RETURN TO HOSPITAL IF:', 18, y + 2);
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    for (const w of ds.warningSignsToWatch) {
      doc.text(`\u2022  ${w}`, 20, y);
      y += 3.5;
    }
    y += 3;
  }

  // ========== SPECIAL INSTRUCTIONS ==========
  if (ds.specialInstructions) {
    y = sectionTitle(doc, y, 'SPECIAL INSTRUCTIONS', pageW);
    y = bodyText(doc, y, ds.specialInstructions, pageW);
  }

  // ========== FOLLOW-UP TABLE ==========
  if (ds.followUp.length > 0) {
    y = sectionTitle(doc, y, 'FOLLOW-UP', pageW);
    if (y > 255) { doc.addPage(); y = 20; }

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [['Department', 'Doctor', 'Date', 'Instructions']],
      body: ds.followUp.map(f => [f.department, f.doctor, f.date, f.instructions || '']),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [...LIGHT_BLUE] as any, textColor: [...BLUE] as any, fontStyle: 'bold', fontSize: 7 },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY + 4 || y + 15;
  }

  // ========== SIGNATURES ==========
  if (y > 245) { doc.addPage(); y = 20; }
  y += 10;
  doc.setDrawColor(180, 180, 180);

  // Resident Doctor
  const sigW = 50;
  const sig1X = 35; const sig2X = pageW - 35 - sigW;
  doc.line(sig1X, y, sig1X + sigW, y);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Resident Doctor', sig1X + sigW / 2, y + 4, { align: 'center' });

  // Consultant
  doc.line(sig2X, y, sig2X + sigW, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`Dr. ${admission.doctor?.full_name || ''}`, sig2X + sigW / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(admission.department?.name || '', sig2X + sigW / 2, y + 7.5, { align: 'center' });

  // ========== PAGE NUMBERS + FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 170, 170);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pH - 6, { align: 'center' });
    doc.text('Generated by Health1 HMIS', 15, pH - 6);
    doc.text(`Printed: ${new Date().toLocaleString('en-IN')}`, pageW - 15, pH - 6, { align: 'right' });
    // Bottom teal line
    doc.setDrawColor(...TEAL);
    doc.line(15, pH - 10, pageW - 15, pH - 10);
  }

  return doc;
}

// Download the PDF
export function downloadDischargePDF(ds: DischargeData, patient: PatientInfo, admission: AdmissionInfo) {
  const doc = generateDischargePDF(ds, patient, admission);
  doc.save(`Discharge_Summary_${patient.uhid}_${admission.ipd_number}.pdf`);
}

// Open in print-friendly window
export function printDischargePDF(ds: DischargeData, patient: PatientInfo, admission: AdmissionInfo) {
  const doc = generateDischargePDF(ds, patient, admission);
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const w = window.open(url, '_blank');
  if (w) {
    w.addEventListener('load', () => { w.print(); });
  }
}
