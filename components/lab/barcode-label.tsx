// components/lab/barcode-label.tsx
'use client';

import React, { useRef, useEffect } from 'react';

interface LabelData {
  barcode: string;
  patientName: string;
  uhid: string;
  age: string | number;
  gender: string;
  testName: string;
  testCode: string;
  sampleType: string;
  collectedAt: string;
  priority: string;
}

// Generate Code128B barcode SVG
function generateBarcodeSVG(text: string, width: number = 200, height: number = 40): string {
  // Code 128B encoding
  const CODE128B: Record<string, number[]> = {};
  const START_B = [2,1,1,2,1,2];
  const STOP = [2,3,3,1,1,1,2];
  const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
  const patterns = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
    [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
    [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
    [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
    [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
    [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
    [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
    [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
    [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
    [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
    [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
    [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],
  ];
  for (let i = 0; i < chars.length; i++) CODE128B[chars[i]] = patterns[i];

  // Encode
  let encoded = [...START_B];
  let checksum = 104; // START_B value
  for (let i = 0; i < text.length; i++) {
    const charVal = text.charCodeAt(i) - 32;
    if (charVal >= 0 && charVal < patterns.length) {
      encoded.push(...patterns[charVal]);
      checksum += charVal * (i + 1);
    }
  }
  checksum = checksum % 103;
  encoded.push(...patterns[checksum]);
  encoded.push(...STOP);

  // Render SVG bars
  const totalUnits = encoded.reduce((a, b) => a + b, 0);
  const unitW = width / totalUnits;
  let x = 0;
  let bars = '';
  for (let i = 0; i < encoded.length; i++) {
    const w = encoded[i] * unitW;
    if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="black"/>`;
    x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
}

export function printBarcodeLabel(data: LabelData) {
  const barcodeSVG = generateBarcodeSVG(data.barcode, 180, 35);
  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(`<!DOCTYPE html><html><head><title>Lab Label</title>
<style>
  @page { size: 50mm 25mm; margin: 1mm; }
  @media print { body { margin: 0; padding: 0; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 50mm; font-family: Arial, sans-serif; }
  .label { width: 48mm; padding: 1mm; border: 0.3mm solid #000; page-break-after: always; }
  .row { display: flex; justify-content: space-between; }
  .name { font-size: 8px; font-weight: 700; }
  .info { font-size: 6px; color: #333; }
  .test { font-size: 7px; font-weight: 700; color: #000; }
  .barcode-wrap { text-align: center; margin: 1mm 0; }
  .barcode-text { font-size: 7px; font-family: monospace; letter-spacing: 1px; }
  .priority { font-size: 6px; font-weight: 900; color: red; }
</style></head><body>
<div class="label">
  <div class="row"><span class="name">${data.patientName}</span><span class="info">${data.age}/${data.gender?.charAt(0).toUpperCase()}</span></div>
  <div class="row"><span class="info">${data.uhid}</span><span class="info">${data.sampleType}</span></div>
  <div class="row"><span class="test">${data.testCode} — ${data.testName}</span>${data.priority === 'stat' ? '<span class="priority">STAT</span>' : ''}</div>
  <div class="barcode-wrap">${barcodeSVG}</div>
  <div class="row"><span class="barcode-text">${data.barcode}</span><span class="info">${data.collectedAt}</span></div>
</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 200);
}

export function printMultipleLabels(labels: LabelData[]) {
  const w = window.open('', '_blank');
  if (!w) return;

  const labelsHtml = labels.map(data => {
    const barcodeSVG = generateBarcodeSVG(data.barcode, 180, 35);
    return `<div class="label">
      <div class="row"><span class="name">${data.patientName}</span><span class="info">${data.age}/${data.gender?.charAt(0).toUpperCase()}</span></div>
      <div class="row"><span class="info">${data.uhid}</span><span class="info">${data.sampleType}</span></div>
      <div class="row"><span class="test">${data.testCode} — ${data.testName}</span>${data.priority === 'stat' ? '<span class="priority">STAT</span>' : ''}</div>
      <div class="barcode-wrap">${barcodeSVG}</div>
      <div class="row"><span class="barcode-text">${data.barcode}</span><span class="info">${data.collectedAt}</span></div>
    </div>`;
  }).join('\n');

  w.document.write(`<!DOCTYPE html><html><head><title>Lab Labels</title>
<style>
  @page { size: 50mm 25mm; margin: 1mm; }
  @media print { body { margin: 0; padding: 0; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 50mm; font-family: Arial, sans-serif; }
  .label { width: 48mm; padding: 1mm; border: 0.3mm solid #000; page-break-after: always; }
  .row { display: flex; justify-content: space-between; }
  .name { font-size: 8px; font-weight: 700; }
  .info { font-size: 6px; color: #333; }
  .test { font-size: 7px; font-weight: 700; }
  .barcode-wrap { text-align: center; margin: 1mm 0; }
  .barcode-text { font-size: 7px; font-family: monospace; letter-spacing: 1px; }
  .priority { font-size: 6px; font-weight: 900; color: red; }
</style></head><body>${labelsHtml}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 200);
}
