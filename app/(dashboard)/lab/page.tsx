// app/(dashboard)/lab/page.tsx
// SP4: Lab/LIMS — decomposed into 12 tab components
// Replaces 535-line god page with thin orchestrator
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useLabWorklist, useSamples, useCriticalAlerts, useOutsourcedLab, type LabOrder } from '@/lib/lab/lims-hooks';

// Tab components
import LabStatsBar from '@/components/lab/lab-stats-bar';
import LabWorklist from '@/components/lab/lab-worklist';
import LabSampleCollect from '@/components/lab/lab-sample-collect';
import LabResultEntry from '@/components/lab/lab-result-entry';
import LabVerify from '@/components/lab/lab-verify';
import LabCriticalAlerts from '@/components/lab/lab-critical-alerts';
import MicrobiologyPanel from '@/components/lab/microbiology-panel';
import LabAntibiogram from '@/components/lab/lab-antibiogram';
import QCPanel from '@/components/lab/qc-panel';
import HistopathologyPanel from '@/components/lab/histopathology-panel';
import AuditPanel from '@/components/lab/audit-panel';
import LabOutsourced from '@/components/lab/lab-outsourced';
import LabTAT from '@/components/lab/lab-tat';
import { OutsourceModal, PhoneModal } from '@/components/lab/lab-modal';
import { sendLabReportWhatsApp } from '@/lib/lab/report-templates';

type LabTab = 'worklist' | 'collect' | 'results' | 'verify' | 'critical' | 'micro' | 'antibiogram' | 'qc' | 'histo' | 'nabl' | 'outsourced' | 'tat';

const TABS: { key: LabTab; label: string }[] = [
  { key: 'worklist', label: 'Worklist' },
  { key: 'collect', label: 'Samples' },
  { key: 'results', label: 'Results' },
  { key: 'verify', label: 'Verify' },
  { key: 'critical', label: 'Critical' },
  { key: 'micro', label: 'Microbiology' },
  { key: 'antibiogram', label: 'Antibiogram' },
  { key: 'qc', label: 'QC' },
  { key: 'histo', label: 'Histopath' },
  { key: 'nabl', label: 'NABL/Audit' },
  { key: 'outsourced', label: 'Outsourced' },
  { key: 'tat', label: 'TAT' },
];

function LabPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const { orders, loading, stats, load } = useLabWorklist(centreId);
  const samples = useSamples(centreId);
  const criticalAlerts = useCriticalAlerts(centreId);
  const outsourced = useOutsourcedLab();

  const [tab, setTab] = useState<LabTab>('worklist');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [toast, setToast] = useState('');
  const [outsourceTarget, setOutsourceTarget] = useState<LabOrder | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<LabOrder | null>(null);

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); }, []);
  const reload = useCallback(() => load(statusFilter, dateFilter), [load, statusFilter, dateFilter]);

  useEffect(() => { reload(); }, [reload]);

  const handleCollectFromWorklist = async (order: LabOrder) => {
    const r = await samples.collectSample(order.id, 'blood', staffId, order.testCode);
    if (r?.barcode) { flash('Sample collected: ' + r.barcode); reload(); }
  };

  const handleOutsource = async (labName: string, expectedReturn: string, cost?: number) => {
    if (!outsourceTarget) return;
    await outsourced.dispatch(outsourceTarget.id, labName, expectedReturn, cost);
    flash('Dispatched to ' + labName); reload();
  };

  const handleWhatsAppSend = (phone: string) => {
    if (!whatsappTarget) return;
    sendLabReportWhatsApp(phone, {
      patientName: whatsappTarget.patientName, uhid: whatsappTarget.patientUhid,
      testName: whatsappTarget.testName, resultSummary: 'Your lab report is ready for collection.',
    });
    flash('WhatsApp message sent');
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-navy text-white
          px-5 py-2.5 rounded-h1 shadow-h1-modal text-h1-body font-medium animate-h1-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-h1-teal" />
          <div>
            <h1 className="text-h1-title text-h1-navy">Laboratory (LIMS)</h1>
            <p className="text-h1-small text-h1-text-secondary">Sample management, result entry, validation</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="text-h1-small border border-h1-border rounded-h1-sm px-2 py-1.5
              focus:outline-none focus:ring-1 focus:ring-h1-teal" />
          <button onClick={reload}
            className="p-2 bg-h1-navy/5 rounded-h1-sm hover:bg-h1-navy/10 transition-colors cursor-pointer"
            title="Refresh">
            <RefreshCw className="w-4 h-4 text-h1-text-secondary" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <LabStatsBar stats={stats} onFilterClick={s => { setStatusFilter(s); setTab('worklist'); }} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 pb-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-h1-small font-medium whitespace-nowrap rounded-h1-sm transition-colors cursor-pointer
              ${tab === t.key
                ? 'bg-h1-teal text-white shadow-h1-card'
                : 'bg-h1-card text-h1-text-secondary border border-h1-border hover:bg-h1-navy/5'}`}>
            {t.label}
            {t.key === 'critical' && criticalAlerts.alerts.length > 0 && (
              <span className="ml-1.5 bg-h1-red text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {criticalAlerts.alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'worklist' && (
        <LabWorklist orders={orders} loading={loading}
          statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          onCollect={handleCollectFromWorklist}
          onResults={o => { setSelectedOrder(o); setTab('results'); }}
          onVerify={o => { setSelectedOrder(o); setTab('verify'); }}
          onPrint={o => { setSelectedOrder(o); setTab('verify'); }}
          onWhatsApp={o => setWhatsappTarget(o)}
          onOutsource={o => setOutsourceTarget(o)} />
      )}
      {tab === 'collect' && (
        <LabSampleCollect orders={orders}
          onCollect={async (orderId, sampleType) => {
            const r = await samples.collectSample(orderId, sampleType, staffId, '');
            reload(); return r;
          }}
          onReject={async (orderId, reason) => {
            await samples.rejectSample('', orderId, reason, staffId); reload();
          }}
          onFlash={flash} />
      )}
      {tab === 'results' && (
        <LabResultEntry
          orders={orders.filter(o => o.status === 'sample_collected' || o.status === 'processing')}
          selectedOrder={selectedOrder} onSelectOrder={setSelectedOrder}
          staffId={staffId} onFlash={flash} onDone={() => { setTab('worklist'); reload(); }} />
      )}
      {tab === 'verify' && (
        <LabVerify
          orders={orders.filter(o => o.status === 'processing')}
          selectedOrder={selectedOrder} onSelectOrder={setSelectedOrder}
          staffId={staffId} onFlash={flash} onDone={() => { setTab('worklist'); reload(); }} />
      )}
      {tab === 'critical' && (
        <LabCriticalAlerts alerts={criticalAlerts.alerts}
          onNotify={criticalAlerts.notify} onAcknowledge={criticalAlerts.acknowledge}
          staffId={staffId} onFlash={flash} />
      )}
      {tab === 'micro' && <MicrobiologyPanel orders={orders} staffId={staffId} onFlash={flash} />}
      {tab === 'antibiogram' && <LabAntibiogram centreId={centreId} onFlash={flash} />}
      {tab === 'qc' && <QCPanel centreId={centreId} staffId={staffId} onFlash={flash} />}
      {tab === 'histo' && <HistopathologyPanel orders={orders} staffId={staffId} onFlash={flash} />}
      {tab === 'nabl' && <AuditPanel centreId={centreId} staffId={staffId} onFlash={flash} />}
      {tab === 'outsourced' && (
        <LabOutsourced outsourced={outsourced.outsourced}
          onUpdateStatus={async (id, status) => { await outsourced.updateStatus(id, status); }}
          onFlash={flash} />
      )}
      {tab === 'tat' && <LabTAT orders={orders} stats={stats} />}

      {/* Global modals */}
      <OutsourceModal open={!!outsourceTarget} onClose={() => setOutsourceTarget(null)}
        onConfirm={handleOutsource} testName={outsourceTarget?.testName} />
      <PhoneModal open={!!whatsappTarget} onClose={() => setWhatsappTarget(null)}
        onConfirm={handleWhatsAppSend} patientName={whatsappTarget?.patientName} />
    </div>
  );
}

export default function LabPage() {
  return <RoleGuard module="lab"><LabPageInner /></RoleGuard>;
}
