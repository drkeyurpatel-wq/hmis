'use client';
import React from 'react';

interface BillingTabProps {
  selectedEnrollId: string | null;
  bills: any[];
}

export default function BillingTab({ selectedEnrollId, bills }: BillingTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Homecare Billing</h2>
      {!selectedEnrollId ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select a patient from Patients tab first</div> :
      bills.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No bills generated</div> :
      <div className="space-y-2">{bills.map((b: any) => (
        <div key={b.id} className="bg-white rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{b.bill_date} — Rs.{parseFloat(b.total).toLocaleString('en-IN')}</span>
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
              {b.status !== 'paid' && <span className="text-xs text-red-600">Balance: Rs.{parseFloat(b.balance).toLocaleString('en-IN')}</span>}
            </div>
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
