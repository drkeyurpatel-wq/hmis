'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import {
  CreditCard, FileText, Shield, IndianRupee, Settings2,
  LayoutDashboard, Stethoscope, Building2, Wrench,
} from 'lucide-react';

// New Billing Revolution components
import BillingCommandCentre from '@/components/billing/billing-command-centre';
import NewEncounterForm from '@/components/billing/new-encounter-form';
import EncounterDetail from '@/components/billing/encounter-detail';
import ServiceMasterManager from '@/components/billing/service-master-manager';
import InsuranceDesk from '@/components/billing/insurance-desk';

// Encounter hooks
import { useEncounters } from '@/lib/billing/encounter-hooks';
import type { BillingEncounter, EncounterType, PayorType } from '@/lib/billing/types';

// Legacy imports for backward compatibility
import RevenueDashboard from '@/components/billing/revenue-dashboard';
import IPDBillingTab from '@/components/billing/ipd-billing-tab';
import InsuranceCashless from '@/components/billing/insurance-cashless';
import { useCashlessWorkflow } from '@/lib/billing/revenue-cycle-hooks';
import { useTariffs } from '@/lib/billing/billing-hooks';
import { sb } from '@/lib/supabase/browser';

type MainTab = 'command_centre' | 'ipd' | 'insurance' | 'service_master' | 'legacy';

const MAIN_TABS: { key: MainTab; label: string; icon: React.ElementType }[] = [
  { key: 'command_centre', label: 'Billing Centre', icon: LayoutDashboard },
  { key: 'ipd', label: 'IPD Billing', icon: Building2 },
  { key: 'insurance', label: 'Insurance Desk', icon: Shield },
  { key: 'service_master', label: 'Service Master', icon: Settings2 },
  { key: 'legacy', label: 'Classic View', icon: Wrench },
];

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<MainTab>('command_centre');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // New encounter-based billing state
  const encounters = useEncounters(centreId || null);
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<BillingEncounter | null>(null);

  // Legacy billing state (for backward compat)
  const cashless = useCashlessWorkflow(centreId || null);
  const tariffs = useTariffs(centreId || null);
  const [legacyBills, setLegacyBills] = useState<any[]>([]);

  const loadLegacyBills = useCallback(async () => {
    if (!centreId) return;
    const { data } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_type, bill_date, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    setLegacyBills(data || []);
  }, [centreId]);

  useEffect(() => { if (tab === 'legacy') loadLegacyBills(); }, [tab, loadLegacyBills]);

  // Create new encounter
  const handleCreateEncounter = async (data: {
    patientId: string;
    encounterType: EncounterType;
    payorType: PayorType;
    consultingDoctorId?: string;
  }) => {
    const enc = await encounters.create({
      ...data,
      staffId,
    });
    if (enc) {
      setShowNewEncounter(false);
      setSelectedEncounter(enc);
      flash(`${data.encounterType} encounter created`);
    } else {
      flash('Failed to create encounter');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0A2540] text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Main Tab Bar */}
      {!selectedEncounter && !showNewEncounter && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {MAIN_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all duration-150 cursor-pointer ${
                tab === key
                  ? 'bg-[#0A2540] text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ═══ TAB CONTENT ═══ */}

      {/* New Encounter Form */}
      {showNewEncounter && (
        <NewEncounterForm
          centreId={centreId}
          onSubmit={handleCreateEncounter}
          onCancel={() => setShowNewEncounter(false)}
        />
      )}

      {/* Encounter Detail (Running Bill / Quick Bill) */}
      {selectedEncounter && (
        <EncounterDetail
          encounter={selectedEncounter}
          centreId={centreId}
          staffId={staffId}
          onBack={() => { setSelectedEncounter(null); encounters.load(); }}
          onFlash={flash}
        />
      )}

      {/* Command Centre (Default View) */}
      {tab === 'command_centre' && !selectedEncounter && !showNewEncounter && (
        <BillingCommandCentre
          encounters={encounters.encounters}
          stats={encounters.stats}
          loading={encounters.loading}
          onNewBill={() => setShowNewEncounter(true)}
          onSelectEncounter={(enc) => setSelectedEncounter(enc)}
          onFilterChange={(filters) => encounters.load(filters)}
        />
      )}

      {/* IPD Billing */}
      {tab === 'ipd' && !selectedEncounter && !showNewEncounter && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">IPD Billing</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Admitted patients with running bills</p>
            </div>
          </div>
          <IPDBillingTab
            centreId={centreId}
            staffId={staffId}
            bills={legacyBills}
            onSelectBill={(id) => {
              // Find encounter for this IPD bill if exists
              const enc = encounters.encounters.find(e => e.encounter_type === 'IPD');
              if (enc) setSelectedEncounter(enc);
            }}
            onReload={() => { encounters.load(); loadLegacyBills(); }}
            onFlash={flash}
          />
        </div>
      )}

      {/* Insurance Desk */}
      {tab === 'insurance' && !selectedEncounter && !showNewEncounter && (
        <InsuranceDesk
          centreId={centreId}
          staffId={staffId}
          onFlash={flash}
        />
      )}

      {/* Service Master & Rate Cards */}
      {tab === 'service_master' && !selectedEncounter && !showNewEncounter && (
        <ServiceMasterManager
          centreId={centreId}
          onFlash={flash}
        />
      )}

      {/* Legacy Classic View */}
      {tab === 'legacy' && !selectedEncounter && !showNewEncounter && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            Classic billing view — uses legacy hmis_bills tables. New encounters use the Billing Centre tab.
          </div>
          <InsuranceCashless
            claims={cashless.claims}
            loading={cashless.loading}
            stats={cashless.stats}
            centreId={centreId}
            staffId={staffId}
            onInitPreAuth={cashless.submitPreAuth}
            onUpdateStatus={async (claimId: string, status: string, data?: any) => {
              await cashless.updateClaim(claimId, { status, ...data });
            }}
            onLoad={cashless.loadClaims}
            onFlash={flash}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return <RoleGuard module="billing"><BillingInner /></RoleGuard>;
}
