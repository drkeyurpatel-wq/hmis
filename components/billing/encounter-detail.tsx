'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Plus, IndianRupee, FileText, CreditCard, Clock,
  Shield, X, Check, Search, Trash2, AlertCircle,
} from 'lucide-react';
import { useLineItems, useEncounterPayments, useInvoices } from '@/lib/billing/encounter-hooks';
import { useServiceMasters, useRateCards } from '@/lib/billing/service-master-hooks';
import type { BillingEncounter, PaymentMode, ServiceMaster } from '@/lib/billing/types';
import { PAYMENT_MODES } from '@/lib/billing/types';
import { StatusBadge } from './billing-command-centre';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

interface Props {
  encounter: BillingEncounter;
  centreId: string;
  staffId: string;
  onBack: () => void;
  onFlash: (msg: string) => void;
}

export default function EncounterDetail({ encounter, centreId, staffId, onBack, onFlash }: Props) {
  const [tab, setTab] = useState<'charges' | 'payments' | 'invoices'>('charges');
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Data hooks
  const lineItems = useLineItems(encounter.id);
  const payments = useEncounterPayments(encounter.id);
  const invoices = useInvoices(encounter.id);
  const serviceMasters = useServiceMasters(centreId);
  const rateCards = useRateCards(centreId);

  // Add charge state
  const [serviceQuery, setServiceQuery] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceMaster | null>(null);
  const [chargeQty, setChargeQty] = useState('1');
  const [chargeRate, setChargeRate] = useState('');

  // Add payment state
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<string>('CASH');
  const [payRef, setPayRef] = useState('');

  const searchResults = useMemo(() => {
    if (!serviceQuery || serviceQuery.length < 2) return [];
    return serviceMasters.search(serviceQuery);
  }, [serviceQuery, serviceMasters]);

  const handleSelectService = (svc: ServiceMaster) => {
    setSelectedService(svc);
    setServiceQuery(svc.service_name);
    const rate = serviceMasters.getRateForPayor(svc.id, encounter.primary_payor_type, rateCards.rateCards);
    setChargeRate(String(rate || svc.base_rate));
  };

  const handleAddCharge = async () => {
    if (!selectedService || !chargeRate) return;
    await lineItems.add({
      centreId,
      serviceCode: selectedService.service_code,
      serviceName: selectedService.service_name,
      department: selectedService.department,
      serviceCategory: selectedService.service_category,
      quantity: Number(chargeQty) || 1,
      unitRate: Number(chargeRate),
      serviceMasterId: selectedService.id,
      staffId,
    });
    setSelectedService(null);
    setServiceQuery('');
    setChargeQty('1');
    setChargeRate('');
    setShowAddCharge(false);
    onFlash('Charge added');
  };

  const handleCancelCharge = async (lineItemId: string) => {
    await lineItems.cancel(lineItemId, 'Cancelled by billing staff', staffId);
    onFlash('Charge cancelled');
  };

  const handleAddPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    await payments.collect({
      centreId,
      patientId: encounter.patient_id,
      amount: Number(payAmount),
      paymentMode: payMode,
      paymentReference: payRef || undefined,
      staffId,
    });
    setPayAmount('');
    setPayRef('');
    setShowAddPayment(false);
    onFlash(`Payment ₹${fmt(Number(payAmount))} recorded`);
  };

  const TABS = [
    { key: 'charges' as const, label: 'Charges', icon: FileText, count: lineItems.summary.activeCount },
    { key: 'payments' as const, label: 'Payments', icon: IndianRupee, count: payments.payments.length },
    { key: 'invoices' as const, label: 'Invoices', icon: CreditCard, count: invoices.invoices.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">
                {encounter.patient?.first_name} {encounter.patient?.last_name}
              </h2>
              <span className="text-[10px] text-gray-400 font-mono">({encounter.patient?.uhid})</span>
              <StatusBadge status={encounter.status} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {encounter.encounter_number} · {encounter.encounter_type}
              {encounter.patient?.age_years ? ` · ${encounter.patient.age_years}y` : ''}
              {encounter.patient?.gender ? ` · ${encounter.patient.gender}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Payor</div>
            <div className="text-xs font-semibold text-gray-700">{encounter.primary_payor_type.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Charges</div>
            <div className="text-base font-bold text-gray-800 font-mono">₹{fmt(lineItems.summary.totalNet)}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Paid</div>
            <div className="text-base font-bold text-emerald-600 font-mono">₹{fmt(payments.totalPaid)}</div>
          </div>
          {encounter.primary_payor_type !== 'SELF_PAY' && (
            <div className="bg-blue-50 rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Insurance</div>
              <div className="text-base font-bold text-blue-600 font-mono">₹{fmt(Number(encounter.insurance_approved_amount))}</div>
            </div>
          )}
          <div className={`rounded-lg px-3 py-2.5 ${lineItems.summary.totalNet - payments.totalPaid > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Balance</div>
            <div className={`text-base font-bold font-mono ${lineItems.summary.totalNet - payments.totalPaid > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              ₹{fmt(Math.max(0, lineItems.summary.totalNet - payments.totalPaid))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 items-center">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              tab === key
                ? 'bg-[#0A2540] text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            <Icon size={13} />
            {label}
            {count > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'charges' && (
          <button
            onClick={() => setShowAddCharge(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#00B4D8] rounded-xl hover:bg-[#00B4D8]/90 cursor-pointer transition-colors"
          >
            <Plus size={13} /> Add Charge
          </button>
        )}
        {tab === 'payments' && (
          <button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 cursor-pointer transition-colors"
          >
            <Plus size={13} /> Record Payment
          </button>
        )}
      </div>

      {/* Add Charge Form */}
      {showAddCharge && (
        <div className="bg-white rounded-xl border border-[#00B4D8]/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700">Add Service Charge</h3>
            <button onClick={() => setShowAddCharge(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5 relative">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Service</label>
              <div className="relative mt-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={serviceQuery}
                  onChange={e => { setServiceQuery(e.target.value); setSelectedService(null); }}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                  placeholder="Search service..."
                  autoFocus
                />
              </div>
              {searchResults.length > 0 && !selectedService && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {searchResults.map(svc => (
                    <button
                      key={svc.id}
                      onClick={() => handleSelectService(svc)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer transition-colors"
                    >
                      <div className="font-medium">{svc.service_name}</div>
                      <div className="text-[10px] text-gray-400">{svc.service_code} · {svc.department} · ₹{fmt(Number(svc.base_rate))}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Dept</label>
              <input
                value={selectedService?.department || ''}
                readOnly
                className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Qty</label>
              <input
                type="number"
                value={chargeQty}
                onChange={e => setChargeQty(e.target.value)}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                min="1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rate</label>
              <input
                type="number"
                value={chargeRate}
                onChange={e => setChargeRate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                placeholder="₹"
              />
            </div>
            <div className="col-span-2">
              <button
                onClick={handleAddCharge}
                disabled={!selectedService || !chargeRate}
                className="w-full py-2 text-xs font-semibold text-white bg-[#0A2540] rounded-lg disabled:opacity-40 hover:bg-[#0A2540]/90 cursor-pointer transition-colors"
              >
                Add ₹{chargeRate ? fmt(Number(chargeQty || 1) * Number(chargeRate)) : '0'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Form */}
      {showAddPayment && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700">Record Payment</h3>
            <button onClick={() => setShowAddPayment(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-3">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                placeholder="₹"
                autoFocus
              />
            </div>
            <div className="col-span-4">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mode</label>
              <div className="flex gap-1 mt-1">
                {(['CASH', 'CARD', 'UPI', 'NEFT'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMode(m)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                      payMode === m ? 'bg-[#0A2540] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-3">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Reference</label>
              <input
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                placeholder="Txn ID / Cheque #"
              />
            </div>
            <div className="col-span-2">
              <button
                onClick={handleAddPayment}
                disabled={!payAmount || Number(payAmount) <= 0}
                className="w-full py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg disabled:opacity-40 hover:bg-emerald-700 cursor-pointer transition-colors"
              >
                Collect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Charges Tab */}
        {tab === 'charges' && (
          <div>
            {lineItems.loading ? (
              <div className="p-8 text-center text-gray-400 text-xs">Loading charges...</div>
            ) : lineItems.items.length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No charges yet. Click &ldquo;Add Charge&rdquo; to start billing.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Service</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Dept</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Qty</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Rate</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.items.map(item => (
                    <tr key={item.id} className={`border-b border-gray-50 last:border-0 ${item.status === 'CANCELLED' ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{item.service_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{item.service_code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.department}</td>
                      <td className="px-4 py-3 text-center font-mono">{Number(item.quantity)}</td>
                      <td className="px-4 py-3 text-right font-mono">₹{fmt(Number(item.unit_rate))}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono">₹{fmt(Number(item.net_amount))}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {item.service_date ? new Date(item.service_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'ACTIVE' && !encounter.billing_locked && (
                          <button
                            onClick={() => handleCancelCharge(item.id)}
                            className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors"
                            title="Cancel charge"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-800 font-mono">₹{fmt(lineItems.summary.totalNet)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {tab === 'payments' && (
          <div>
            {payments.payments.length === 0 ? (
              <div className="p-12 text-center">
                <IndianRupee size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No payments recorded. Click &ldquo;Record Payment&rdquo; to collect.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Receipt #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Mode</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Reference</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.payments.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{p.receipt_number}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-[10px]">{p.payment_reference || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">₹{fmt(Number(p.amount))}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Total Collected</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600 font-mono">₹{fmt(payments.totalPaid)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {tab === 'invoices' && (
          <div>
            {invoices.invoices.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No invoices generated yet.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Invoice #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Total</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Balance</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-500">{inv.invoice_type}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono">₹{fmt(Number(inv.grand_total))}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {Number(inv.balance_due) > 0
                          ? <span className="text-red-600 font-semibold">₹{fmt(Number(inv.balance_due))}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
