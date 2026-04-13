'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Edit2, Check, ChevronDown } from 'lucide-react';
import { useServiceMasters, useRateCards } from '@/lib/billing/service-master-hooks';
import type { ServiceMaster, PayorType } from '@/lib/billing/types';
import { SERVICE_CATEGORIES, DEPARTMENTS, PAYOR_TYPES } from '@/lib/billing/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

interface Props {
  centreId: string;
  onFlash: (msg: string) => void;
}

export default function ServiceMasterManager({ centreId, onFlash }: Props) {
  const sm = useServiceMasters(centreId);
  const rc = useRateCards(centreId);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showRateCard, setShowRateCard] = useState<string | null>(null);

  // Add form
  const [form, setForm] = useState({
    serviceCode: '', serviceName: '', department: 'GENERAL',
    serviceCategory: 'Other', baseRate: '', gstApplicable: false,
    gstPercentage: '0', hsnSacCode: '', isPayableToDoctor: true,
  });

  // Rate card form
  const [rcForm, setRcForm] = useState({ payorType: 'PMJAY' as PayorType, rate: '' });

  const filtered = useMemo(() => {
    let result = sm.services;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.service_name.toLowerCase().includes(q) || s.service_code.toLowerCase().includes(q)
      );
    }
    if (catFilter) result = result.filter(s => s.service_category === catFilter);
    if (deptFilter) result = result.filter(s => s.department === deptFilter);
    return result;
  }, [sm.services, search, catFilter, deptFilter]);

  const handleAdd = async () => {
    if (!form.serviceCode || !form.serviceName || !form.baseRate) return;
    await sm.create({
      serviceCode: form.serviceCode,
      serviceName: form.serviceName,
      department: form.department,
      serviceCategory: form.serviceCategory,
      baseRate: Number(form.baseRate),
      gstApplicable: form.gstApplicable,
      gstPercentage: Number(form.gstPercentage),
      hsnSacCode: form.hsnSacCode || undefined,
      isPayableToDoctor: form.isPayableToDoctor,
    });
    setForm({ serviceCode: '', serviceName: '', department: 'GENERAL', serviceCategory: 'Other', baseRate: '', gstApplicable: false, gstPercentage: '0', hsnSacCode: '', isPayableToDoctor: true });
    setShowAdd(false);
    onFlash('Service added');
  };

  const handleAddRateCard = async () => {
    if (!showRateCard || !rcForm.rate) return;
    await rc.create({
      payorType: rcForm.payorType,
      serviceMasterId: showRateCard,
      rate: Number(rcForm.rate),
    });
    setRcForm({ payorType: 'PMJAY', rate: '' });
    setShowRateCard(null);
    onFlash('Rate card added');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Service Master & Rate Cards</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">{sm.services.length} services configured</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0A2540] text-white text-xs font-semibold rounded-xl hover:bg-[#0A2540]/90 cursor-pointer transition-colors"
        >
          {showAdd ? <X size={13} /> : <Plus size={13} />}
          {showAdd ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#00B4D8]/30 p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-700">New Service</h3>
          <div className="grid grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Code *</label>
              <input value={form.serviceCode} onChange={e => setForm(f => ({ ...f, serviceCode: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                placeholder="CONS-GEN" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Name *</label>
              <input value={form.serviceName} onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                placeholder="General Consultation" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Department</label>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 cursor-pointer">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Category</label>
              <select value={form.serviceCategory} onChange={e => setForm(f => ({ ...f, serviceCategory: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 cursor-pointer">
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Base Rate *</label>
              <input type="number" value={form.baseRate} onChange={e => setForm(f => ({ ...f, baseRate: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                placeholder="₹" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.gstApplicable} onChange={e => setForm(f => ({ ...f, gstApplicable: e.target.checked }))} className="rounded cursor-pointer" />
              GST Applicable
            </label>
            {form.gstApplicable && (
              <input type="number" value={form.gstPercentage} onChange={e => setForm(f => ({ ...f, gstPercentage: e.target.value }))}
                className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg text-right" placeholder="GST %" />
            )}
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.isPayableToDoctor} onChange={e => setForm(f => ({ ...f, isPayableToDoctor: e.target.checked }))} className="rounded cursor-pointer" />
              Doctor Payout
            </label>
            <div className="flex-1" />
            <button onClick={handleAdd} disabled={!form.serviceCode || !form.serviceName || !form.baseRate}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0A2540] rounded-lg disabled:opacity-40 hover:bg-[#0A2540]/90 cursor-pointer transition-colors">
              Save Service
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] bg-gray-50/50"
            placeholder="Search services..." />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 text-[10px] border border-gray-200 rounded-lg bg-gray-50 cursor-pointer">
          <option value="">All Departments</option>
          {sm.departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 text-[10px] border border-gray-200 rounded-lg bg-gray-50 cursor-pointer">
          <option value="">All Categories</option>
          {sm.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[10px] text-gray-400 ml-auto">{filtered.length} services</span>
      </div>

      {/* Rate Card Modal */}
      {showRateCard && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700">Add Rate Card Override</h3>
            <button onClick={() => setShowRateCard(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Payor Type</label>
              <select value={rcForm.payorType} onChange={e => setRcForm(f => ({ ...f, payorType: e.target.value as PayorType }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg cursor-pointer">
                {PAYOR_TYPES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Override Rate</label>
              <input type="number" value={rcForm.rate} onChange={e => setRcForm(f => ({ ...f, rate: e.target.value }))}
                className="w-full mt-1 px-2 py-2 text-xs border border-gray-200 rounded-lg text-right font-mono" placeholder="₹" />
            </div>
            <button onClick={handleAddRateCard} disabled={!rcForm.rate}
              className="py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg disabled:opacity-40 hover:bg-blue-700 cursor-pointer transition-colors">
              Add Rate Card
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {sm.loading ? (
          <div className="p-8 text-center text-gray-400 text-xs">Loading services...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Service Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Dept</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Category</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Base Rate</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">GST</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Dr Pay</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(svc => (
                <tr key={svc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{svc.service_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{svc.service_name}</td>
                  <td className="px-4 py-3 text-gray-500">{svc.department}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      {svc.service_category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold font-mono">₹{fmt(Number(svc.base_rate))}</td>
                  <td className="px-4 py-3 text-center">
                    {svc.gst_applicable ? (
                      <span className="text-[10px] text-amber-600 font-semibold">{Number(svc.gst_percentage)}%</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {svc.is_payable_to_doctor ? (
                      <Check size={12} className="text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setShowRateCard(svc.id)}
                      className="text-[10px] text-blue-600 font-semibold hover:text-blue-700 cursor-pointer transition-colors"
                    >
                      + Rate Card
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 text-xs">
                    {search ? `No services matching "${search}"` : 'No services configured. Click "Add Service" to start.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
