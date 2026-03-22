// app/(dashboard)/radiology/page.tsx
// Complete Radiology Information System — Stradus PACS integration
'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useRadiologyTests, useRadiologyWorklist, usePACSConfig, type RadiologyOrder } from '@/lib/radiology/radiology-hooks';
import RadiologyWorklist from '@/components/radiology/worklist';
import RadiologyOrderForm from '@/components/radiology/order-form';
import ReportViewer from '@/components/radiology/report-viewer';
import PACSLinkManager from '@/components/radiology/pacs-link-manager';
import TATAnalytics from '@/components/radiology/tat-analytics';
import ModalityRooms from '@/components/radiology/modality-rooms';

type Tab = 'worklist' | 'new_order' | 'tat' | 'equipment' | 'webhook';

function RadiologyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const testMaster = useRadiologyTests();
  const worklist = useRadiologyWorklist(centreId);
  const pacs = usePACSConfig(centreId);

  const [tab, setTab] = useState<Tab>('worklist');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<RadiologyOrder | null>(null);
  const [linkOrder, setLinkOrder] = useState<RadiologyOrder | null>(null);

  const tabs: [Tab, string][] = [
    ['worklist', `Worklist (${worklist.stats.total})`],
    ['new_order', 'New Order'],
    ['tat', 'TAT Analytics'],
    ['equipment', 'Equipment & PACS'],
    ['webhook', 'Stradus Webhook'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Report viewer modal */}
      {selectedOrder && <ReportViewer order={selectedOrder} staffId={staffId} pacsConfig={pacs.config} onFlash={flash} onClose={() => setSelectedOrder(null)} />}

      {/* PACS link modal */}
      {linkOrder && <PACSLinkManager order={linkOrder} centreId={centreId} pacsConfig={pacs.config} onClose={() => setLinkOrder(null)} onFlash={flash} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Radiology</h1>
          <p className="text-xs text-gray-500">
            {testMaster.tests.length} tests | {testMaster.modalities.length} modalities
            {pacs.config && <> | <span className="text-green-600">Stradus PACS connected</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          {pacs.config && <a href={pacs.config.viewer_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Open Stradus</a>}
          <button onClick={() => setTab('new_order')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">+ New Order</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-9 gap-2">
        {[
          ['Ordered', worklist.stats.ordered, 'text-gray-700', 'bg-gray-50'],
          ['Scheduled', worklist.stats.scheduled, 'text-amber-700', 'bg-amber-50'],
          ['In Progress', worklist.stats.inProgress, 'text-purple-700', 'bg-purple-50'],
          ['Reported', worklist.stats.reported, 'text-teal-700', 'bg-blue-50'],
          ['Verified', worklist.stats.verified, 'text-green-700', 'bg-green-50'],
          ['STAT', worklist.stats.stat, worklist.stats.stat > 0 ? 'text-red-700' : 'text-gray-400', worklist.stats.stat > 0 ? 'bg-red-50' : 'bg-white'],
          ['Critical', worklist.stats.critical, worklist.stats.critical > 0 ? 'text-red-700' : 'text-gray-400', worklist.stats.critical > 0 ? 'bg-red-50' : 'bg-white'],
          ['Contrast', worklist.stats.contrast, 'text-amber-700', 'bg-amber-50'],
          ['Avg TAT', worklist.stats.avgTatMinutes > 0 ? `${Math.floor(worklist.stats.avgTatMinutes / 60)}h` : '—', 'text-gray-700', 'bg-white'],
        ].map(([l, v, tc, bg], i) => (
          <div key={i} className={'rounded-xl border p-2 text-center ' + bg}><div className="text-[9px] text-gray-500 uppercase">{l as string}</div><div className={'text-lg font-bold ' + tc}>{v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-xl ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{l}</button>)}
      </div>

      {tab === 'worklist' && <RadiologyWorklist centreId={centreId} modalities={testMaster.modalities} pacsConfig={pacs.config}
        staffId={staffId} onSelectOrder={o => setSelectedOrder(o)} onLinkStudy={o => setLinkOrder(o)} onFlash={flash} />}

      {tab === 'new_order' && <RadiologyOrderForm centreId={centreId} staffId={staffId}
        onComplete={(acc) => { setTab('worklist'); }} onFlash={flash} />}

      {tab === 'tat' && <TATAnalytics orders={worklist.orders} stats={worklist.stats} />}

      {tab === 'equipment' && <ModalityRooms centreId={centreId} />}

      {tab === 'webhook' && <div className="space-y-4">
        <h2 className="font-bold text-sm">Stradus → HMIS Report Webhook</h2>
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-xs font-bold text-teal-700 mb-2">Webhook Endpoint</div>
            <div className="font-mono text-sm bg-white rounded-lg px-4 py-2 border">POST {typeof window !== 'undefined' ? window.location.origin : 'https://hmis-brown.vercel.app'}/api/radiology/stradus-webhook</div>
          </div>

          <div className="text-xs text-gray-600 space-y-2">
            <h3 className="font-bold text-sm text-gray-800">How it works:</h3>
            <p>1. <span className="font-medium">Order placed in HMIS</span> — accession number generated (e.g., RAD-260318-0042)</p>
            <p>2. <span className="font-medium">Images acquired in Stradus</span> — modality sends DICOM to Stradus PACS</p>
            <p>3. <span className="font-medium">Link images</span> — paste Stradus viewer URL in HMIS (saved to patient file permanently)</p>
            <p>4. <span className="font-medium">Report finalized in Stradus RIS</span> — radiologist completes report in Stradus</p>
            <p>5. <span className="font-medium">Stradus sends report to HMIS</span> — via this webhook endpoint (HL7 ORU or JSON)</p>
            <p>6. <span className="font-medium">Report appears in patient file</span> — doctor clicks study in EMR, sees report + "View Images" button</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-700 mb-2">Configure in Stradus RIS:</div>
            <div className="text-xs font-mono space-y-1 text-gray-600">
              <div>URL: <span className="text-teal-600">{typeof window !== 'undefined' ? window.location.origin : 'https://hmis-brown.vercel.app'}/api/radiology/stradus-webhook</span></div>
              <div>Method: POST</div>
              <div>Content-Type: application/json (preferred) or application/hl7-v2</div>
              <div>Events: report.finalized, report.amended, report.addendum</div>
              <div>Headers (optional): X-Stradus-Signature: sha256=&lt;hmac&gt;</div>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs font-bold text-green-700 mb-2">Accepted Formats</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium mb-1">JSON (recommended)</div>
                <pre className="bg-white p-2 rounded text-[10px] font-mono overflow-x-auto">{`{
  "accession_number": "RAD-260318-0042",
  "study_instance_uid": "1.2.840...",
  "patient_id": "H1-001234",
  "modality": "CT",
  "report_status": "F",
  "findings": "...",
  "impression": "...",
  "reporting_radiologist": "Dr. Patel",
  "is_critical": false
}`}</pre>
              </div>
              <div>
                <div className="font-medium mb-1">HL7 ORU^R01</div>
                <pre className="bg-white p-2 rounded text-[10px] font-mono overflow-x-auto">{`MSH|^~\\&|STRADUS|...|HMIS|...|
PID|||H1-001234||...
OBR|1|RAD-260318-0042||...
OBX|1|TX|FIND||findings text...
OBX|2|TX|IMP||impression text...`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-xs font-bold text-amber-700 mb-2">Matching Logic</div>
            <div className="text-xs text-amber-800 space-y-1">
              <div>1. First tries to match by <span className="font-mono">accession_number</span> (most reliable)</div>
              <div>2. Falls back to <span className="font-mono">pacs_study_uid</span> (Study Instance UID)</div>
              <div>3. Last resort: matches by <span className="font-mono">patient_id</span> (UHID) + takes most recent open order</div>
              <div>4. If no match found: stores as orphan report for manual linking</div>
            </div>
          </div>

          {process.env.NEXT_PUBLIC_STRADUS_WEBHOOK_SECRET && <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-700 mb-1">Signature Verification</div>
            <div className="text-xs text-gray-600">HMAC-SHA256 signature verification is enabled. Stradus must include <span className="font-mono">X-Stradus-Signature: sha256=&lt;hmac&gt;</span> header.</div>
          </div>}
        </div>
      </div>}
    </div>
  );
}

export default function RadiologyPage() { return <RoleGuard module="radiology"><RadiologyInner /></RoleGuard>; }
