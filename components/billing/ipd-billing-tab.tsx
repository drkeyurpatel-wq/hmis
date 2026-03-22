'use client';
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import ServiceBillingEngine from './service-billing-engine';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

interface Props {
  centreId: string;
  staffId: string;
  bills: any[];
  onSelectBill: (id: string) => void;
  onReload: () => void;
  onFlash: (msg: string) => void;
}

export default function IPDBillingTab({ centreId, staffId, bills, onSelectBill, onReload, onFlash }: Props) {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [mode, setMode] = useState<'list' | 'bill'>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdmissions();
  }, [centreId]);

  const loadAdmissions = async () => {
    setLoading(true);
    const { data } = await sb()!.from('hmis_admissions')
      .select('id, admission_date, status, patient:hmis_patients!inner(id, first_name, last_name, uhid, phone_primary), doctor:hmis_staff!inner(full_name)')
      .eq('centre_id', centreId).eq('status', 'active')
      .order('admission_date', { ascending: false });
    setAdmissions(data || []);
    setLoading(false);
  };

  const ipdBills = bills.filter(b => b.bill_type === 'ipd' && b.status !== 'cancelled');
  const ipdActive = ipdBills.filter(b => b.status !== 'paid');
  const ipdRevenue = ipdBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0);
  const ipdOutstanding = ipdBills.filter(b => parseFloat(b.balance_amount) > 0).reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0);

  if (mode === 'bill' && selectedAdmission) {
    return (
      <div>
        <button onClick={() => { setMode('list'); setSelectedAdmission(null); }} className="mb-4 px-3 py-1.5 bg-gray-100 text-sm rounded-lg">← Back to IPD List</button>
        <ServiceBillingEngine
          centreId={centreId} staffId={staffId} mode="ipd"
          patientId={selectedAdmission.patient.id}
          patientName={`${selectedAdmission.patient.first_name} ${selectedAdmission.patient.last_name} (${selectedAdmission.patient.uhid})`}
          admissionId={selectedAdmission.id}
          payorType="self"
          onDone={() => { onReload(); setMode('list'); setSelectedAdmission(null); }}
          onFlash={onFlash}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Active Admissions</div><div className="text-xl font-bold text-blue-700">{admissions.length}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">IPD Bills</div><div className="text-xl font-bold">{ipdActive.length}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">IPD Revenue</div><div className="text-xl font-bold text-green-700">₹{fmt(ipdRevenue)}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Outstanding</div><div className="text-xl font-bold text-red-700">₹{fmt(ipdOutstanding)}</div></div>
      </div>

      {/* Active admissions — select to bill */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold">Active Admissions — Select to Create Bill</h3>
        </div>
        {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> :
        admissions.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">No active admissions</div> :
        <div className="divide-y">
          {admissions.map(a => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer" onClick={() => { setSelectedAdmission(a); setMode('bill'); }}>
              <div>
                <span className="font-medium text-sm">{a.patient.first_name} {a.patient.last_name}</span>
                <span className="ml-2 text-xs font-mono text-gray-400">{a.patient.uhid}</span>
                <div className="text-[10px] text-gray-500 mt-0.5">Dr. {a.doctor.full_name} • Admitted {new Date(a.admission_date).toLocaleDateString('en-IN')}</div>
              </div>
              <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">Create Bill →</button>
            </div>
          ))}
        </div>}
      </div>

      {/* Existing IPD bills */}
      {ipdActive.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b"><h3 className="text-sm font-bold">Running IPD Bills</h3></div>
          <div className="divide-y">
            {ipdActive.map(b => (
              <div key={b.id} onClick={() => onSelectBill(b.id)} className="px-4 py-3 hover:bg-blue-50/50 cursor-pointer flex justify-between">
                <div>
                  <span className="font-medium text-sm">{b.patient?.first_name} {b.patient?.last_name}</span>
                  <span className="ml-2 text-xs font-mono text-gray-400">{b.bill_number}</span>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{b.payor_type?.replace('_', ' ')}</span>
                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">{b.status?.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">₹{fmt(b.net_amount)}</div>
                  {parseFloat(b.balance_amount) > 0 && <div className="text-xs text-red-600 font-bold">Due: ₹{fmt(b.balance_amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
