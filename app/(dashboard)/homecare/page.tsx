'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEnrollments, useVisits, useWoundCare, useRates, useHCBilling, useNurseSchedule } from '@/lib/homecare/homecare-hooks';
import DashboardTab from '@/components/homecare/DashboardTab';
import EnrollmentsTab from '@/components/homecare/EnrollmentsTab';
import ScheduleTab from '@/components/homecare/ScheduleTab';
import VisitsTab from '@/components/homecare/VisitsTab';
import WoundCareTab from '@/components/homecare/WoundCareTab';
import BillingTab from '@/components/homecare/BillingTab';
import RatesTab from '@/components/homecare/RatesTab';

type HCTab = 'dashboard' | 'enrollments' | 'schedule' | 'visits' | 'wound' | 'billing' | 'rates';

const progColor = (p: string) => p === 'post_discharge' ? 'bg-blue-100 text-blue-700' : p === 'palliative' ? 'bg-purple-100 text-purple-700' : p === 'wound_care' ? 'bg-orange-100 text-orange-700' : p === 'iv_therapy' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
const stColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'paused' ? 'bg-yellow-100 text-yellow-700' : s === 'completed' || s === 'discharged' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700';
const visitStColor = (s: string) => s === 'scheduled' ? 'bg-yellow-100 text-yellow-700' : s === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' : s === 'completed' ? 'bg-green-100 text-green-700' : s === 'missed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
const condColor = (c: string) => c === 'improving' ? 'text-green-600' : c === 'stable' ? 'text-blue-600' : c === 'deteriorating' ? 'text-red-600' : c === 'critical' ? 'text-red-700 font-bold' : 'text-gray-500';

function HomecarePage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const enrollments = useEnrollments(centreId);
  const nurseSchedule = useNurseSchedule(staffId, centreId);
  const rates = useRates();

  const [tab, setTab] = useState<HCTab>('dashboard');
  const [selectedEnrollId, setSelectedEnrollId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [visitFormInit, setVisitFormInit] = useState<{ visitId?: string } | undefined>(undefined);
  const [visitShowFormInit, setVisitShowFormInit] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const visits = useVisits(selectedEnrollId);
  const wounds = useWoundCare(selectedEnrollId);
  const billing = useHCBilling(selectedEnrollId);

  const handleDocumentVisit = (enrollmentId: string, visitId: string) => {
    setSelectedEnrollId(enrollmentId);
    setVisitFormInit({ visitId });
    setVisitShowFormInit(true);
    setTab('visits');
  };

  const tabs: [HCTab, string][] = [['dashboard','Dashboard'],['enrollments','Patients'],['schedule','My Schedule'],['visits','Visit Log'],['wound','Wound Care'],['billing','Billing'],['rates','Rate Card']];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Homecare</h1><p className="text-sm text-gray-500">Home visit management, remote monitoring, patient care</p></div>
      </div>

      <div className="flex gap-1 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setVisitShowFormInit(false); setVisitFormInit(undefined); }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>)}
      </div>

      {tab === 'dashboard' && <DashboardTab stats={enrollments.stats} todayVisits={nurseSchedule.todayVisits} visitStColor={visitStColor} checkin={visits.checkin} onDocumentVisit={handleDocumentVisit} flash={flash} reloadSchedule={nurseSchedule.load} />}
      {tab === 'enrollments' && <EnrollmentsTab enrollments={enrollments.enrollments} enroll={enrollments.enroll} updateStatus={enrollments.updateStatus} staffId={staffId} selectedEnrollId={selectedEnrollId} setSelectedEnrollId={setSelectedEnrollId} progColor={progColor} stColor={stColor} flash={flash} />}
      {tab === 'schedule' && <ScheduleTab todayVisits={nurseSchedule.todayVisits} visitStColor={visitStColor} checkin={visits.checkin} onDocumentVisit={handleDocumentVisit} flash={flash} reloadSchedule={nurseSchedule.load} />}
      {tab === 'visits' && <VisitsTab selectedEnrollId={selectedEnrollId} enrollmentNumber={enrollments.enrollments.find(e => e.id === selectedEnrollId)?.enrollment_number || ''} visits={visits.visits} schedule={visits.schedule} checkin={visits.checkin} checkout={visits.checkout} saveVitals={visits.saveVitals} staffId={staffId} visitStColor={visitStColor} condColor={condColor} flash={flash} initialVisitForm={visitFormInit} initialShowForm={visitShowFormInit} />}
      {tab === 'wound' && <WoundCareTab selectedEnrollId={selectedEnrollId} records={wounds.records} />}
      {tab === 'billing' && <BillingTab selectedEnrollId={selectedEnrollId} bills={billing.bills} />}
      {tab === 'rates' && <RatesTab rates={rates.rates} />}
    </div>
  );
}

export default function HomecareRoute() { return <RoleGuard module="homecare"><HomecarePage /></RoleGuard>; }
