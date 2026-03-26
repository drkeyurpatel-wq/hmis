// components/lab/histopathology-panel.tsx
'use client';

import React, { useState } from 'react';
import { useHistoCase, useHistoCaseList } from '@/lib/lab/histo-hooks';
import type { LabOrder } from '@/lib/lab/lims-hooks';

interface Props { orders: LabOrder[]; staffId: string; onFlash: (m: string) => void; }

const SPECIAL_STAINS = ['PAS','PAS-D','Masson Trichrome','Reticulin','Congo Red','ZN','GMS','Mucicarmine','Iron (Perl)','Alcian Blue','Oil Red O','Giemsa','Gram'];
const IHC_MARKERS = ['CK (Pan)','CK7','CK20','EMA','Vimentin','S100','HMB45','Desmin','SMA','CD3','CD20','CD30','CD34','CD45','CD68','Ki67','ER','PR','HER2','p53','p63','TTF1','PSA','Chromogranin','Synaptophysin','GATA3','PAX8','WT1','Calretinin','D2-40','PDL1'];

const statusColor = (s: string) => s === 'accessioned' ? 'bg-h1-yellow/10 text-h1-yellow' : s === 'grossing' ? 'bg-h1-teal/10 text-h1-teal' : s === 'processing' ? 'bg-purple-50 text-purple-700' : s === 'reporting' ? 'bg-h1-yellow/10 text-h1-yellow' : s === 'verified' ? 'bg-h1-success/10 text-h1-success' : s === 'amended' ? 'bg-h1-red/10 text-h1-red' : 'bg-h1-navy/5 text-h1-text-secondary';

export default function HistopathologyPanel({ orders, staffId, onFlash }: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const histo = useHistoCase(selectedOrderId);
  const caseList = useHistoCaseList(null);
  const [view, setView] = useState<'orders' | 'cases'>('orders');

  // Forms
  const [accForm, setAccForm] = useState({ specimenType: 'biopsy', specimenSite: '', laterality: 'na', clinicalHistory: '', clinicalDiagnosis: '', surgeonName: '' });
  const [grossForm, setGrossForm] = useState({ grossDescription: '', grossMeasurements: '', grossWeight: '', blocksCount: 1, slidesCount: 1 });
  const [microText, setMicroText] = useState('');
  const [dxForm, setDxForm] = useState({ diagnosis: '', icdCode: '', tumorGrade: '', marginStatus: 'not_applicable', lymphNodeStatus: '', tnmStaging: '', specialStains: [] as string[], ihcMarkers: [] as string[] });
  const [addendumText, setAddendumText] = useState('');

  const histoOrders = orders.filter(o => o.category === 'Histopathology' || o.category === 'Cytology' || o.testCode?.startsWith('HISTO') || o.testCode?.startsWith('FNAC') || o.testCode?.startsWith('PAP'));

  const toggleArray = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2 mb-2">
        <button onClick={() => setView('orders')} className={`px-3 py-1.5 text-xs rounded-h1-sm ${view === 'orders' ? 'bg-purple-600 text-white' : 'bg-h1-navy/5'}`}>Pending Orders ({histoOrders.length})</button>
        <button onClick={() => { setView('cases'); caseList.load(); }} className={`px-3 py-1.5 text-xs rounded-h1-sm ${view === 'cases' ? 'bg-purple-600 text-white' : 'bg-h1-navy/5'}`}>All Cases ({caseList.cases.length})</button>
      </div>

      <div className="flex gap-4">
        {/* Left: order/case list */}
        <div className="w-1/4 space-y-1.5">
          {view === 'orders' ? (
            histoOrders.length === 0 ? <div className="text-xs text-h1-text-muted text-center py-4">No histopath orders</div> :
            histoOrders.map(o => (
              <button key={o.id} onClick={() => setSelectedOrderId(o.id)}
                className={`w-full text-left p-2 rounded-h1-sm border text-xs ${selectedOrderId === o.id ? 'border-purple-500 bg-purple-50' : 'hover:bg-h1-navy/[0.03]'}`}>
                <div className="font-medium">{o.patientName}</div>
                <div className="text-[10px] text-h1-text-muted">{o.testName}</div>
              </button>
            ))
          ) : (
            caseList.cases.length === 0 ? <div className="text-xs text-h1-text-muted text-center py-4">No cases yet</div> :
            caseList.cases.map((c: any) => (
              <button key={c.id} onClick={() => setSelectedOrderId(c.order_id)}
                className={`w-full text-left p-2 rounded-h1-sm border text-xs ${selectedOrderId === c.order_id ? 'border-purple-500 bg-purple-50' : 'hover:bg-h1-navy/[0.03]'}`}>
                <div className="font-medium font-mono">{c.case_number}</div>
                <div className="text-[10px] text-h1-text-muted">{c.order?.patient?.first_name} {c.order?.patient?.last_name}</div>
                <span className={`text-[10px] px-1 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
              </button>
            ))
          )}
        </div>

        {/* Right: workspace */}
        <div className="flex-1">
          {!selectedOrderId ? (
            <div className="text-center py-12 bg-h1-card rounded-h1 border text-h1-text-muted text-sm">Select an order or case from the left</div>
          ) : histo.loading ? (
            <div className="text-center py-12 text-h1-text-muted">Loading...</div>
          ) : !histo.histoCase ? (
            /* ACCESSIONING */
            <div className="bg-h1-card rounded-h1 border p-5">
              <h3 className="font-semibold mb-3">Accession New Case</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs text-h1-text-secondary">Specimen type *</label>
                    <select value={accForm.specimenType} onChange={e => setAccForm(f => ({...f, specimenType: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                      {['biopsy','resection','excision','curettings','polyp','lymph_node','bone_marrow','skin','breast','thyroid','prostate','cervix','endometrium','liver','kidney','lung','gi','other'].map(t =>
                        <option key={t}>{t.replace('_',' ')}</option>)}</select></div>
                  <div><label className="text-xs text-h1-text-secondary">Site</label>
                    <input type="text" value={accForm.specimenSite} onChange={e => setAccForm(f => ({...f, specimenSite: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="e.g., Right breast, Upper lobe lung..." /></div>
                  <div><label className="text-xs text-h1-text-secondary">Laterality</label>
                    <select value={accForm.laterality} onChange={e => setAccForm(f => ({...f, laterality: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                      {['na','left','right','bilateral','midline'].map(l => <option key={l}>{l}</option>)}</select></div>
                </div>
                <div><label className="text-xs text-h1-text-secondary">Clinical history</label>
                  <textarea value={accForm.clinicalHistory} onChange={e => setAccForm(f => ({...f, clinicalHistory: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-h1-text-secondary">Clinical diagnosis</label>
                    <input type="text" value={accForm.clinicalDiagnosis} onChange={e => setAccForm(f => ({...f, clinicalDiagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
                  <div><label className="text-xs text-h1-text-secondary">Surgeon</label>
                    <input type="text" value={accForm.surgeonName} onChange={e => setAccForm(f => ({...f, surgeonName: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
                </div>
                <button onClick={async () => { await histo.createCase(accForm, staffId); onFlash('Case accessioned'); }} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-h1-sm">Accession Case</button>
              </div>
            </div>
          ) : (
            /* CASE WORKFLOW */
            <div className="space-y-4">
              {/* Case header */}
              <div className="bg-h1-card rounded-h1 border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-purple-700">{histo.histoCase.case_number}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusColor(histo.histoCase.status)}`}>{histo.histoCase.status}</span>
                  </div>
                  <div className="text-xs text-h1-text-muted">
                    {histo.histoCase.specimen_type} | {histo.histoCase.specimen_site || '—'} | Received: {new Date(histo.histoCase.received_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                {histo.histoCase.clinical_history && <div className="text-xs text-h1-text-secondary mt-1"><span className="font-medium">History:</span> {histo.histoCase.clinical_history}</div>}
                {histo.histoCase.clinical_diagnosis && <div className="text-xs text-h1-text-secondary"><span className="font-medium">Clinical Dx:</span> {histo.histoCase.clinical_diagnosis}</div>}
              </div>

              {/* GROSSING */}
              <div className="bg-h1-card rounded-h1 border p-4">
                <h4 className="text-sm font-medium mb-2">Gross Description</h4>
                {histo.histoCase.gross_description ? (
                  <div className="text-sm space-y-1">
                    <div>{histo.histoCase.gross_description}</div>
                    {histo.histoCase.gross_measurements && <div className="text-xs text-h1-text-secondary">Measurements: {histo.histoCase.gross_measurements}</div>}
                    <div className="text-xs text-h1-text-muted">Blocks: {histo.histoCase.blocks_count} | Slides: {histo.histoCase.slides_count}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea value={grossForm.grossDescription} onChange={e => setGrossForm(f => ({...f, grossDescription: e.target.value}))} rows={4}
                      className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="Received in formalin labeled with patient name, a specimen of..." />
                    <div className="grid grid-cols-4 gap-2">
                      <div><label className="text-[10px] text-h1-text-secondary">Measurements</label>
                        <input type="text" value={grossForm.grossMeasurements} onChange={e => setGrossForm(f => ({...f, grossMeasurements: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="3x2x1 cm" /></div>
                      <div><label className="text-[10px] text-h1-text-secondary">Weight</label>
                        <input type="text" value={grossForm.grossWeight} onChange={e => setGrossForm(f => ({...f, grossWeight: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="15 gm" /></div>
                      <div><label className="text-[10px] text-h1-text-secondary">Blocks</label>
                        <input type="number" value={grossForm.blocksCount} onChange={e => setGrossForm(f => ({...f, blocksCount: parseInt(e.target.value)||1}))} className="w-full px-2 py-1.5 border rounded text-sm" min="1" /></div>
                      <div><label className="text-[10px] text-h1-text-secondary">Slides</label>
                        <input type="number" value={grossForm.slidesCount} onChange={e => setGrossForm(f => ({...f, slidesCount: parseInt(e.target.value)||1}))} className="w-full px-2 py-1.5 border rounded text-sm" min="1" /></div>
                    </div>
                    <button onClick={async () => { await histo.updateGrossing(grossForm, staffId); onFlash('Grossing saved'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-h1-sm">Save Grossing</button>
                  </div>
                )}
              </div>

              {/* MICROSCOPY */}
              {histo.histoCase.gross_description && (
                <div className="bg-h1-card rounded-h1 border p-4">
                  <h4 className="text-sm font-medium mb-2">Microscopic Description</h4>
                  {histo.histoCase.micro_description ? (
                    <div className="text-sm">{histo.histoCase.micro_description}</div>
                  ) : (
                    <div className="space-y-2">
                      <textarea value={microText} onChange={e => setMicroText(e.target.value)} rows={5}
                        className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="Sections show..." />
                      <button onClick={async () => { await histo.updateMicroscopy(microText); onFlash('Microscopy saved'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-h1-sm">Save Microscopy</button>
                    </div>
                  )}
                </div>
              )}

              {/* DIAGNOSIS & SPECIAL STAINS / IHC */}
              {histo.histoCase.micro_description && !histo.histoCase.histo_diagnosis && (
                <div className="bg-h1-card rounded-h1 border p-4 space-y-3">
                  <h4 className="text-sm font-medium">Diagnosis & Report</h4>
                  <div><label className="text-xs text-h1-text-secondary">Histopathological diagnosis *</label>
                    <textarea value={dxForm.diagnosis} onChange={e => setDxForm(f => ({...f, diagnosis: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-xs text-h1-text-secondary">ICD-O Code</label>
                      <input type="text" value={dxForm.icdCode} onChange={e => setDxForm(f => ({...f, icdCode: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="M8140/3" /></div>
                    <div><label className="text-xs text-h1-text-secondary">Tumor grade</label>
                      <select value={dxForm.tumorGrade} onChange={e => setDxForm(f => ({...f, tumorGrade: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                        <option value="">N/A</option>{['Grade 1 (Well differentiated)','Grade 2 (Moderately differentiated)','Grade 3 (Poorly differentiated)','Grade 4 (Undifferentiated)'].map(g => <option key={g}>{g}</option>)}</select></div>
                    <div><label className="text-xs text-h1-text-secondary">Margin status</label>
                      <select value={dxForm.marginStatus} onChange={e => setDxForm(f => ({...f, marginStatus: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                        {['not_applicable','clear','involved','close'].map(m => <option key={m}>{m.replace('_',' ')}</option>)}</select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-h1-text-secondary">Lymph node status</label>
                      <input type="text" value={dxForm.lymphNodeStatus} onChange={e => setDxForm(f => ({...f, lymphNodeStatus: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="e.g., 0/12 positive" /></div>
                    <div><label className="text-xs text-h1-text-secondary">TNM Staging</label>
                      <input type="text" value={dxForm.tnmStaging} onChange={e => setDxForm(f => ({...f, tnmStaging: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="e.g., pT2N0M0" /></div>
                  </div>
                  {/* Special stains */}
                  <div><label className="text-xs text-h1-text-secondary mb-1 block">Special stains performed</label>
                    <div className="flex flex-wrap gap-1">{SPECIAL_STAINS.map(s => (
                      <button key={s} onClick={() => setDxForm(f => ({...f, specialStains: toggleArray(f.specialStains, s)}))}
                        className={`px-2 py-1 text-[10px] rounded border ${dxForm.specialStains.includes(s) ? 'bg-h1-teal/10 text-h1-teal border-h1-teal/30' : 'bg-h1-card border-h1-border text-h1-text-secondary'}`}>{s}</button>
                    ))}</div></div>
                  {/* IHC */}
                  <div><label className="text-xs text-h1-text-secondary mb-1 block">IHC markers</label>
                    <div className="flex flex-wrap gap-1">{IHC_MARKERS.map(m => (
                      <button key={m} onClick={() => setDxForm(f => ({...f, ihcMarkers: toggleArray(f.ihcMarkers, m)}))}
                        className={`px-2 py-1 text-[10px] rounded border ${dxForm.ihcMarkers.includes(m) ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-h1-card border-h1-border text-h1-text-secondary'}`}>{m}</button>
                    ))}</div></div>
                  <button onClick={async () => { await histo.reportDiagnosis(dxForm, staffId); onFlash('Diagnosis reported'); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-h1-sm">Sign Out & Report</button>
                </div>
              )}

              {/* FINAL REPORT VIEW */}
              {histo.histoCase.histo_diagnosis && (
                <div className="bg-h1-card rounded-h1 border p-4 space-y-2">
                  <h4 className="text-sm font-medium text-h1-success">Final Diagnosis</h4>
                  <div className="text-sm font-medium">{histo.histoCase.histo_diagnosis}</div>
                  {histo.histoCase.icd_code && <div className="text-xs text-h1-text-secondary">ICD-O: {histo.histoCase.icd_code}</div>}
                  {histo.histoCase.tumor_grade && <div className="text-xs text-h1-text-secondary">Grade: {histo.histoCase.tumor_grade}</div>}
                  {histo.histoCase.margin_status !== 'not_applicable' && <div className="text-xs text-h1-text-secondary">Margins: {histo.histoCase.margin_status}</div>}
                  {histo.histoCase.tnm_staging && <div className="text-xs text-h1-text-secondary">TNM: {histo.histoCase.tnm_staging}</div>}
                  {histo.histoCase.special_stains?.length > 0 && <div className="text-xs text-h1-text-secondary">Stains: {histo.histoCase.special_stains.join(', ')}</div>}
                  {histo.histoCase.ihc_markers?.length > 0 && <div className="text-xs text-h1-text-secondary">IHC: {histo.histoCase.ihc_markers.join(', ')}</div>}
                  <div className="text-xs text-h1-text-muted mt-2">Reported: {histo.histoCase.reported_at ? new Date(histo.histoCase.reported_at).toLocaleString('en-IN') : '—'}</div>

                  {/* Addendum */}
                  {histo.histoCase.addendum && <div className="bg-h1-yellow/[0.05] border border-yellow-200 rounded-h1-sm p-3 mt-2">
                    <div className="text-xs font-medium text-h1-yellow">ADDENDUM ({new Date(histo.histoCase.addendum_date).toLocaleDateString('en-IN')})</div>
                    <div className="text-sm">{histo.histoCase.addendum}</div>
                  </div>}

                  {!histo.histoCase.addendum && (
                    <div className="mt-3 flex gap-2 items-end">
                      <div className="flex-1"><label className="text-[10px] text-h1-text-secondary">Add addendum/amendment</label>
                        <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
                      <button onClick={async () => { if (addendumText) { await histo.addAddendum(addendumText, staffId); onFlash('Addendum added'); } }}
                        className="px-3 py-2 bg-yellow-600 text-white text-sm rounded-h1-sm whitespace-nowrap">Add Addendum</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
