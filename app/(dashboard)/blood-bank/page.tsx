'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDonors, useDonations, useInventory, useCrossmatch, useBloodRequests, useTransfusions } from '@/lib/lab/blood-bank-hooks';
import InventoryTab from '@/components/blood-bank/InventoryTab';
import DonorsTab from '@/components/blood-bank/DonorsTab';
import DonationsTab from '@/components/blood-bank/DonationsTab';
import RequestsTab from '@/components/blood-bank/RequestsTab';
import CrossmatchTab from '@/components/blood-bank/CrossmatchTab';
import TransfusionTab from '@/components/blood-bank/TransfusionTab';
import ReactionsTab from '@/components/blood-bank/ReactionsTab';

type BBTab = 'inventory' | 'donors' | 'donations' | 'requests' | 'crossmatch' | 'transfusion' | 'reactions';

const groupColor = (g: string) => g.includes('+') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

function BloodBankInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const donors = useDonors(centreId);
  const donations = useDonations(centreId);
  const inv = useInventory(centreId);
  const xmatch = useCrossmatch(centreId);
  const requests = useBloodRequests(centreId);
  const transfusions = useTransfusions(centreId);

  const [tab, setTab] = useState<BBTab>('inventory');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const tabs: [BBTab, string][] = [['inventory','Inventory'],['donors','Donors'],['donations','Donations'],['requests','Requests'],['crossmatch','Crossmatch'],['transfusion','Transfusions'],['reactions','Reactions']];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Blood Bank</h1><p className="text-sm text-gray-500">Blood storage, compatibility testing, transfusion management</p></div>
      </div>

      <div className="flex gap-1 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>)}
      </div>

      {tab === 'inventory' && <InventoryTab inventory={inv.inventory} components={inv.components} groupColor={groupColor} />}
      {tab === 'donors' && <DonorsTab donors={donors.donors} register={donors.register} groupColor={groupColor} flash={flash} />}
      {tab === 'donations' && <DonationsTab donations={donations.donations} donors={donors.donors} collect={donations.collect} updateTTI={donations.updateTTI} separate={inv.separate} staffId={staffId} groupColor={groupColor} flash={flash} />}
      {tab === 'requests' && <RequestsTab requests={requests.requests} create={requests.create} updateStatus={requests.updateStatus} staffId={staffId} groupColor={groupColor} flash={flash} />}
      {tab === 'crossmatch' && <CrossmatchTab matches={xmatch.matches} complete={xmatch.complete} staffId={staffId} groupColor={groupColor} />}
      {tab === 'transfusion' && <TransfusionTab transfusions={transfusions.transfusions} startTransfusion={transfusions.startTransfusion} completeTransfusion={transfusions.completeTransfusion} reportReaction={transfusions.reportReaction} staffId={staffId} groupColor={groupColor} />}
      {tab === 'reactions' && <ReactionsTab transfusions={transfusions.transfusions} groupColor={groupColor} />}
    </div>
  );
}

export default function BloodBankPage() { return <RoleGuard module="blood_bank"><BloodBankInner /></RoleGuard>; }
