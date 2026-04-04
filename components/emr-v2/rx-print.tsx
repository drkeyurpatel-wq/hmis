'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { HOSPITAL } from '@/lib/config/hospital';
import { LOGO_SVG } from '@/lib/config/logo';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RxPrintProps {
  patient: {
    name: string;
    age: string;
    gender: string;
    uhid: string;
  };
  prescriptions: Array<{
    drug: string;
    generic: string;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  diagnoses: Array<{
    code: string;
    name: string;
    type: string;
  }>;
  advice?: string;
  followUpDate?: string;
  doctorName: string;
  doctorRegistration?: string;
  doctorSpecialisation?: string;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  QR-like SVG identifier (no external library)                       */
/* ------------------------------------------------------------------ */

function RxIdentifierSvg({ text }: { text: string }) {
  // Generate a deterministic grid pattern from text hash
  const cells: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < 64; i++) {
    // Use a simple PRNG seeded by hash
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    cells.push(hash % 3 !== 0);
  }

  const gridSize = 8;
  const cellPx = 4;
  const size = gridSize * cellPx + 8; // +8 for quiet zone

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Prescription identifier for ${text}`}
    >
      <rect width={size} height={size} fill="#fff" />
      {/* Border / finder pattern */}
      <rect x={2} y={2} width={size - 4} height={size - 4} fill="none" stroke="#000" strokeWidth={1} />
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const row = Math.floor(idx / gridSize);
        const col = idx % gridSize;
        return (
          <rect
            key={idx}
            x={4 + col * cellPx}
            y={4 + row * cellPx}
            width={cellPx}
            height={cellPx}
            fill="#000"
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function RxPrint({
  patient,
  prescriptions,
  diagnoses,
  advice,
  followUpDate,
  doctorName,
  doctorRegistration,
  doctorSpecialisation,
  onClose,
}: RxPrintProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const printDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* Print handler */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* Identifier text for the QR-like graphic */
  const idText = `${patient.uhid}-${printDate}`;

  return (
    <>
      {/* ---------- Print-only styles ---------- */}
      <style>{`
        @media print {
          /* Hide everything except the Rx overlay */
          body > *:not(#rx-print-overlay) {
            display: none !important;
          }
          #rx-print-overlay {
            position: static !important;
            background: #fff !important;
          }
          .rx-no-print {
            display: none !important;
          }
          .rx-print-area {
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          @page {
            size: A4;
            margin: 12mm 10mm;
          }
        }
      `}</style>

      {/* ---------- Overlay ---------- */}
      <div
        id="rx-print-overlay"
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0"
        role="dialog"
        aria-modal="true"
        aria-label="Prescription print preview"
      >
        {/* Backdrop click to close */}
        <div
          className="rx-no-print absolute inset-0"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* ---------- Print area ---------- */}
        <div className="rx-print-area relative z-10 my-4 w-full max-w-[210mm] rounded-lg border border-gray-200 bg-white shadow-xl print:my-0 print:rounded-none print:border-0 print:shadow-none">

          {/* ---- Action bar (screen only) ---- */}
          <div className="rx-no-print sticky top-0 z-20 flex items-center justify-between rounded-t-lg border-b bg-gray-50 px-6 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Prescription Preview</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-md p-1.5 text-gray-500 transition-colors duration-200 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ---- Printable content ---- */}
          <div className="px-8 py-6 text-[11pt] leading-relaxed text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>

            {/* == Hospital header == */}
            <header className="mb-4 border-b-2 border-gray-800 pb-3">
              <div className="flex items-start gap-4">
                {/* Logo */}
                <img
                  src={LOGO_SVG}
                  alt={`${HOSPITAL.shortName} logo`}
                  className="h-14 w-auto object-contain"
                />
                <div className="flex-1 text-center">
                  <h1 className="text-lg font-bold tracking-wide text-gray-900">
                    {HOSPITAL.name}
                  </h1>
                  <p className="text-[9pt] text-gray-600">{HOSPITAL.tagline}</p>
                  <p className="mt-0.5 text-[8pt] text-gray-500">
                    {HOSPITAL.address}
                  </p>
                  <p className="text-[8pt] text-gray-500">
                    Tel: {HOSPITAL.phone} | {HOSPITAL.email} | {HOSPITAL.website}
                  </p>
                  {HOSPITAL.hfrId && (
                    <p className="text-[8pt] text-gray-500">
                      HFR ID: {HOSPITAL.hfrId}
                      {HOSPITAL.nabh ? ` | NABH: ${HOSPITAL.nabh}` : ''}
                    </p>
                  )}
                </div>
                {/* QR-like identifier */}
                <div className="flex flex-col items-center">
                  <RxIdentifierSvg text={idText} />
                  <span className="mt-0.5 text-[6pt] text-gray-400">{patient.uhid}</span>
                </div>
              </div>
            </header>

            {/* == Patient details == */}
            <section className="mb-4 rounded border border-gray-300 px-4 py-2">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10pt]">
                <div>
                  <span className="font-semibold">Patient: </span>
                  {patient.name}
                </div>
                <div>
                  <span className="font-semibold">Date: </span>
                  {printDate}
                </div>
                <div>
                  <span className="font-semibold">Age / Sex: </span>
                  {patient.age} / {patient.gender}
                </div>
                <div>
                  <span className="font-semibold">UHID: </span>
                  {patient.uhid}
                </div>
              </div>
            </section>

            {/* == Diagnoses == */}
            {diagnoses.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-1 text-[10pt] font-semibold">Diagnosis:</h3>
                <ul className="ml-4 list-disc text-[10pt]">
                  {diagnoses.map((d, i) => (
                    <li key={i}>
                      {d.name}
                      {d.code ? ` (${d.code})` : ''}
                      {d.type ? (
                        <span className="ml-1 text-[8pt] text-gray-500">[{d.type}]</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* == Rx symbol + Drug table == */}
            <section className="mb-4">
              <div className="mb-2 text-3xl font-bold" aria-label="Prescription">
                &#8478;
              </div>

              {prescriptions.length > 0 ? (
                <table className="w-full border-collapse text-[9pt]">
                  <thead>
                    <tr className="border-b-2 border-gray-700 text-left">
                      <th className="w-6 pb-1 pr-2 text-center font-semibold">#</th>
                      <th className="pb-1 pr-2 font-semibold">Drug Name</th>
                      <th className="pb-1 pr-2 font-semibold">Dose</th>
                      <th className="pb-1 pr-2 font-semibold">Route</th>
                      <th className="pb-1 pr-2 font-semibold">Frequency</th>
                      <th className="pb-1 pr-2 font-semibold">Duration</th>
                      <th className="pb-1 pr-2 font-semibold">Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-1.5 pr-2 text-center">{idx + 1}</td>
                        <td className="py-1.5 pr-2">
                          <span className="font-medium">{rx.drug}</span>
                          {rx.generic && (
                            <span className="block text-[8pt] text-gray-500">
                              ({rx.generic})
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">{rx.dose}</td>
                        <td className="py-1.5 pr-2">{rx.route}</td>
                        <td className="py-1.5 pr-2">{rx.frequency}</td>
                        <td className="py-1.5 pr-2">{rx.duration}</td>
                        <td className="py-1.5 pr-2 text-[8pt]">{rx.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[10pt] italic text-gray-500">
                  No medications prescribed.
                </p>
              )}
            </section>

            {/* == Advice == */}
            {advice && (
              <section className="mb-4">
                <h3 className="mb-1 text-[10pt] font-semibold">Advice:</h3>
                <p className="whitespace-pre-line text-[10pt]">{advice}</p>
              </section>
            )}

            {/* == Follow-up == */}
            {followUpDate && (
              <section className="mb-6">
                <h3 className="mb-1 text-[10pt] font-semibold">Follow-up:</h3>
                <p className="text-[10pt]">{followUpDate}</p>
              </section>
            )}

            {/* == Doctor / Signature footer == */}
            <footer className="mt-12 flex items-end justify-between border-t border-gray-300 pt-4">
              <div className="text-[8pt] text-gray-400">
                <p>Generated on {printDate}</p>
                <p>This is a computer-generated prescription.</p>
              </div>
              <div className="text-right">
                <div className="mb-8 border-b border-gray-400" style={{ width: '200px', marginLeft: 'auto' }} />
                <p className="text-[11pt] font-semibold">{doctorName}</p>
                {doctorSpecialisation && (
                  <p className="text-[9pt] text-gray-600">{doctorSpecialisation}</p>
                )}
                {doctorRegistration && (
                  <p className="text-[9pt] text-gray-500">
                    Reg. No.: {doctorRegistration}
                  </p>
                )}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
