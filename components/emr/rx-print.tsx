// components/emr/rx-print.tsx
// @media print layout for A4 pre-printed letterheads
// Only prints clinical content — letterhead (logo, hospital, doctor) is pre-printed on paper
'use client';
import React, { useRef } from 'react';
import { DEFAULT_RX_PAD_CONFIG, FONT_SIZE_MAP, mm, type RxPadConfig } from '@/lib/emr/rx-pad-config';

interface RxEntry {
  drug: string; generic: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
  isSOS: boolean; category: string;
}

interface DiagnosisEntry {
  code: string; name: string; type: 'primary' | 'secondary' | 'differential'; notes: string;
}

interface RxPrintProps {
  patient: { name: string; uhid: string; age: string; gender: string; phone: string };
  prescriptions: RxEntry[];
  diagnoses: DiagnosisEntry[];
  advice: string;
  followUpDate: string;
  doctorName: string;
  doctorSpeciality: string;
  config?: Partial<RxPadConfig>;
}

export default function RxPrint({
  patient,
  prescriptions,
  diagnoses,
  advice,
  followUpDate,
  doctorName,
  doctorSpeciality,
  config: configOverrides,
}: RxPrintProps) {
  const config = { ...DEFAULT_RX_PAD_CONFIG, ...configOverrides };
  const printRef = useRef<HTMLDivElement>(null);
  const fontSize = FONT_SIZE_MAP[config.fontSize];

  // Split prescriptions into pages
  const pages: RxEntry[][] = [];
  for (let i = 0; i < prescriptions.length; i += config.maxRxPerPage) {
    pages.push(prescriptions.slice(i, i + config.maxRxPerPage));
  }
  if (pages.length === 0) pages.push([]); // At least one page for info

  const dxLine = config.showDiagnosis
    ? diagnoses.map(d => `${d.name} (${d.code})`).join(', ')
    : '';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow || !printRef.current) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<title>Rx-${patient.uhid}</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Noto Sans', Arial, sans-serif;
    font-size: ${fontSize};
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rx-page {
    width: 210mm;
    min-height: 297mm;
    padding-top: ${mm(config.topMarginMm)};
    padding-bottom: ${mm(config.bottomMarginMm)};
    padding-left: ${mm(config.leftMarginMm)};
    padding-right: ${mm(config.rightMarginMm)};
    page-break-after: always;
    position: relative;
  }
  .rx-page:last-child { page-break-after: auto; }
  .patient-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 12px;
    padding: 6px 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    margin-bottom: 10px;
    font-size: 0.9em;
  }
  .patient-info b { color: #374151; }
  .dx-line {
    padding: 4px 8px;
    background: #eff6ff;
    border-radius: 3px;
    margin-bottom: 10px;
    font-size: 0.9em;
  }
  .rx-symbol {
    font-size: 14pt;
    font-weight: 700;
    color: #dc2626;
    margin-bottom: 6px;
    display: block;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th {
    background: #f1f5f9;
    padding: 4px 6px;
    border: 1px solid #d1d5db;
    font-size: 0.85em;
    text-align: left;
    font-weight: 600;
    color: #374151;
  }
  td {
    padding: 5px 6px;
    border: 1px solid #d1d5db;
    vertical-align: top;
  }
  td.center { text-align: center; }
  td.drug-cell b { display: block; color: #1e293b; }
  td.drug-cell .generic { font-size: 0.85em; color: #64748b; }
  td.drug-cell .dose { font-size: 0.9em; color: #374151; margin-top: 1px; }
  .sos-badge {
    display: inline-block;
    padding: 0 4px;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 3px;
    font-size: 0.75em;
    font-weight: 600;
    margin-left: 4px;
  }
  .instructions { font-size: 0.85em; color: #64748b; font-style: italic; }
  .advice-box {
    padding: 6px 8px;
    background: #fffbeb;
    border: 1px solid #fbbf24;
    border-radius: 4px;
    margin-bottom: 8px;
    font-size: 0.9em;
  }
  .advice-box b { color: #92400e; }
  .followup { font-size: 0.9em; margin-bottom: 8px; }
  .followup b { color: #374151; }
  .signature-block {
    position: absolute;
    bottom: ${mm(config.bottomMarginMm)};
    right: ${mm(config.rightMarginMm)};
    text-align: right;
    font-size: 0.9em;
  }
  .signature-block .line {
    border-top: 1px solid #000;
    display: inline-block;
    padding-top: 4px;
    min-width: 180px;
  }
  .signature-block .doctor-name { font-weight: 600; }
  .signature-block .speciality { color: #64748b; font-size: 0.85em; }
  .page-num { position: absolute; bottom: ${mm(config.bottomMarginMm - 5)}; left: 50%; transform: translateX(-50%); font-size: 8pt; color: #94a3b8; }
</style>
</head><body>
${pages.map((pageRx, pageIdx) => `
<div class="rx-page">
  ${pageIdx === 0 ? `
  <div class="patient-info">
    <div><b>Patient:</b> ${patient.name}</div>
    <div><b>UHID:</b> ${patient.uhid}</div>
    <div><b>Age/Sex:</b> ${patient.age}/${patient.gender}</div>
    <div><b>Date:</b> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    ${config.showPatientPhone && patient.phone ? `<div><b>Phone:</b> ${patient.phone}</div>` : ''}
  </div>
  ${dxLine ? `<div class="dx-line"><b>Dx:</b> ${dxLine}</div>` : ''}
  ` : ''}

  <span class="rx-symbol">℞</span>

  ${pageRx.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Medication</th>
        <th style="width:60px">Route</th>
        <th style="width:80px">Frequency</th>
        <th style="width:60px">Duration</th>
      </tr>
    </thead>
    <tbody>
      ${pageRx.map((rx, i) => {
        const globalIdx = pageIdx * config.maxRxPerPage + i + 1;
        return `
      <tr>
        <td class="center">${globalIdx}</td>
        <td class="drug-cell">
          <b>${rx.drug}${rx.isSOS ? '<span class="sos-badge">SOS</span>' : ''}</b>
          <span class="generic">${rx.generic}</span>
          <span class="dose">${rx.dose}</span>
          ${rx.instructions ? `<div class="instructions">${rx.instructions}</div>` : ''}
        </td>
        <td class="center">${rx.route}</td>
        <td class="center">${rx.frequency.split(' (')[0]}</td>
        <td class="center">${rx.duration}</td>
      </tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : '<div style="color:#94a3b8;font-style:italic;margin:10px 0">No medications prescribed</div>'}

  ${pageIdx === pages.length - 1 ? `
    ${advice ? `<div class="advice-box"><b>Advice:</b> ${advice.replace(/\n/g, '<br/>')}</div>` : ''}
    ${followUpDate ? `<div class="followup"><b>Follow-up:</b> ${new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</div>` : ''}
  ` : ''}

  <div class="signature-block">
    <div class="line">
      <div class="doctor-name">Dr. ${doctorName}</div>
      <div class="speciality">${doctorSpeciality}</div>
    </div>
  </div>
  ${pages.length > 1 ? `<div class="page-num">Page ${pageIdx + 1} of ${pages.length}</div>` : ''}
</div>`).join('')}
</body></html>`);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  // Expose the print function via ref pattern — parent calls it
  React.useEffect(() => {
    (window as any).__h1PrintRx = handlePrint;
    return () => { delete (window as any).__h1PrintRx; };
  });

  return null; // No visible DOM — print is triggered via window.__h1PrintRx()
}

/** Trigger Rx print from anywhere */
export function triggerRxPrint() {
  if (typeof window !== 'undefined' && (window as any).__h1PrintRx) {
    (window as any).__h1PrintRx();
  }
}
