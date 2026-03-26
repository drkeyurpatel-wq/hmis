// app/(dashboard)/pharmacy/page.tsx
// SP5: Pharmacy — decomposed into 5 tab components
'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Pill, Package, BookOpen, Shield, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDrugMaster, usePharmacyStock, useDispensingQueue, usePharmacyDashboard } from '@/lib/pharmacy/pharmacy-hooks';
import { usePharmacyReturns, useStockTransfers, useControlledSubstances } from '@/lib/pharmacy/pharmacy-v2-hooks';
import { sb } from '@/lib/supabase/browser';

import PharmacyStats from '@/components/pharmacy/pharmacy-stats';
import PharmacyDispensing from '@/components/pharmacy/pharmacy-dispensing';
import PharmacyInventory from '@/components/pharmacy/pharmacy-inventory';
import PharmacyDrugMaster from '@/components/pharmacy/pharmacy-drug-master';
import PharmacyControlled from '@/components/pharmacy/pharmacy-controlled';
import PharmacyReturns from '@/components/pharmacy/pharmacy-returns';

type Tab = 'dispensing' | 'inventory' | 'drug_master' | 'controlled' | 'more';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'dispensing', label: 'Dispensing', icon: <Pill className="w-3.5 h-3.5" /> },
  { key: 'inventory', label: 'Inventory', icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'drug_master', label: 'Drug Master', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'controlled', label: 'Controlled', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'more', label: 'Transfers & Returns', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
];

function PharmacyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const drugMaster = useDrugMaster();
  const stock = usePharmacyStock(centreId);
  const dispensing = useDispensingQueue(centreId);
  const dashboard = usePharmacyDashboard(centreId);
  const returns = usePharmacyReturns(centreId);
  const transfers = useStockTransfers(centreId);
  const controlled = useControlledSubstances(centreId);

  const [tab, setTab] = useState<Tab>('dispensing');
  const [toast, setToast] = useState('');
  const [centres, setCentres] = useState<any[]>([]);

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); }, []);

  useEffect(() => {
    if (!sb()) return;
    sb()!.from('hmis_centres').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: any) => setCentres(data || []));
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-navy text-white
          px-5 py-2.5 rounded-h1 shadow-h1-modal text-h1-body font-medium animate-h1-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-h1-teal" />
          <div>
            <h1 className="text-h1-title text-h1-navy">Pharmacy</h1>
            <p className="text-h1-small text-h1-text-secondary">Drug dispensing, stock management, procurement</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4">
        <PharmacyStats
          todayDispensed={dashboard.todayDispensed}
          todayRevenue={dashboard.todayRevenue}
          monthRevenue={dashboard.monthRevenue}
          pendingRx={dispensing.stats.pending}
          lowStockCount={stock.lowStock.length}
          expiringCount={stock.expiringSoon.length}
          stockValueCost={stock.totalValue}
          stockValueMRP={stock.totalMRPValue}
          totalDrugs={stock.aggregated.length}
          totalBatches={stock.stock.length}
          expiredCount={stock.expired.length}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 pb-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-h1-small font-medium whitespace-nowrap
              rounded-h1-sm transition-colors cursor-pointer
              ${tab === t.key
                ? 'bg-h1-navy text-white shadow-h1-card'
                : 'bg-h1-card text-h1-text-secondary border border-h1-border hover:bg-h1-navy/5'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dispensing' && (
        <PharmacyDispensing
          queue={dispensing.queue}
          stats={dispensing.stats}
          onFilterChange={s => dispensing.load(s)}
          onDispense={dispensing.dispense}
          drugSearch={drugMaster.search}
          staffId={staffId}
          onFlash={flash}
        />
      )}

      {tab === 'inventory' && (
        <PharmacyInventory
          stock={stock.stock}
          aggregated={stock.aggregated}
          lowStock={stock.lowStock}
          expiringSoon={stock.expiringSoon}
          expired={stock.expired}
          onLoad={stock.load}
          onAddStock={stock.addStock}
          drugSearch={drugMaster.search}
          onFlash={flash}
        />
      )}

      {tab === 'drug_master' && (
        <PharmacyDrugMaster
          drugs={drugMaster.drugs}
          onSearch={drugMaster.search}
          onAddDrug={drugMaster.addDrug}
          onFlash={flash}
        />
      )}

      {tab === 'controlled' && (
        <PharmacyControlled
          register={controlled.register}
          loading={controlled.loading}
          onAddEntry={controlled.addEntry}
          drugSearch={drugMaster.search}
          staffId={staffId}
          onFlash={flash}
        />
      )}

      {tab === 'more' && (
        <PharmacyReturns
          returns={returns.returns}
          returnsLoading={returns.loading}
          returnsStats={returns.stats}
          transfers={transfers.transfers}
          transfersLoading={transfers.loading}
          centres={centres}
          onProcessReturn={returns.processReturn}
          onCreateTransfer={transfers.createTransfer}
          drugSearch={drugMaster.search}
          staffId={staffId}
          onFlash={flash}
        />
      )}
    </div>
  );
}

export default function PharmacyPage() {
  return <RoleGuard module="pharmacy"><PharmacyInner /></RoleGuard>;
}
