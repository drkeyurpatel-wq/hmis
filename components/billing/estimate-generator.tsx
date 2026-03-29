// components/billing/estimate-generator.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { HOSPITAL } from '@/lib/config/hospital';
import { printEstimate as printEstimatePDF } from '@/components/billing/bill-pdf';

interface Props {
  estimates: any[]; centreId: string; staffId: string;
  tariffs: { search: (q: string) => any[]; getRate: (id: string, payor: string) => number; tariffs: any[] };
  onCreate: (data: any, staffId: string) => Promise<void>;
  onFlash: (m: string) => void;
}

const PROCEDURE_TEMPLATES: { name: string; type: string; defaultLOS: number; defaultRoom: string; defaultItems: string[] }[] = [
  { name: 'PTCA with Single Stent', type: 'surgery', defaultLOS: 3, defaultRoom: 'ICU + Private', defaultItems: ['PROC-PTCA','CON-STENT-DES','PROF-SURG','ROOM-ICU','ROOM-PVT','NURS-ICU','NURS-GEN','MISC-DIET'] },
  { name: 'PTCA with Double Stent', type: 'surgery', defaultLOS: 4, defaultRoom: 'ICU + Private', defaultItems: ['PROC-PTCA2','CON-STENT-DES','CON-STENT-DES','PROF-SURG','ROOM-ICU','ROOM-PVT','NURS-ICU','NURS-GEN','MISC-DIET'] },
  { name: 'Coronary Angiography (Diagnostic)', type: 'surgery', defaultLOS: 1, defaultRoom: 'Semi-Private', defaultItems: ['PROC-CATH','PROF-SURG','ROOM-SEMI','NURS-GEN','MISC-DIET'] },
  { name: 'Total Knee Replacement (Unilateral)', type: 'surgery', defaultLOS: 7, defaultRoom: 'Private', defaultItems: ['PROC-TKR','CON-IMPLANT-TKR','OT-ROBOT','PROF-SURG','PROF-ANAES','PROF-ASSIST','ROOM-PVT','NURS-GEN','MISC-DIET'] },
  { name: 'Total Hip Replacement', type: 'surgery', defaultLOS: 7, defaultRoom: 'Private', defaultItems: ['PROC-THR','OT-MAJOR','PROF-SURG','PROF-ANAES','ROOM-PVT','NURS-GEN','MISC-DIET'] },
  { name: 'Laparoscopic Cholecystectomy', type: 'surgery', defaultLOS: 3, defaultRoom: 'Semi-Private', defaultItems: ['PROC-LAPCHOLE','OT-INTER','PROF-SURG','PROF-ANAES','ROOM-SEMI','NURS-GEN','MISC-DIET'] },
  { name: 'Robotic Cholecystectomy (SSI Mantra)', type: 'surgery', defaultLOS: 3, defaultRoom: 'Private', defaultItems: ['PROC-LAPCHOLE','OT-ROBOT','PROF-SURG','PROF-ANAES','ROOM-PVT','NURS-GEN','MISC-DIET'] },
  { name: 'Appendectomy (Laparoscopic)', type: 'surgery', defaultLOS: 2, defaultRoom: 'General', defaultItems: ['PROC-APPY','OT-MINOR','PROF-SURG','PROF-ANAES','ROOM-GEN','NURS-GEN','MISC-DIET'] },
  { name: 'Hernia Repair (Laparoscopic)', type: 'surgery', defaultLOS: 2, defaultRoom: 'Semi-Private', defaultItems: ['PROC-HERNIA','CON-MESH','OT-INTER','PROF-SURG','PROF-ANAES','ROOM-SEMI','NURS-GEN','MISC-DIET'] },
  { name: 'CABG (Single Bypass)', type: 'surgery', defaultLOS: 10, defaultRoom: 'ICU + Private', defaultItems: ['PROC-CABG','OT-SUPER','PROF-SURG','PROF-ANAES','PROF-ASSIST','ROOM-ICU','ROOM-PVT','NURS-ICU','NURS-GEN','ICU-VENT','ICU-MONITOR','MISC-DIET'] },
  { name: 'Spine Surgery — Discectomy', type: 'surgery', defaultLOS: 5, defaultRoom: 'Private', defaultItems: ['PROC-SPINE','OT-MAJOR','PROF-SURG','PROF-ANAES','ROOM-PVT','NURS-GEN','MISC-DIET'] },
  { name: 'Normal Delivery', type: 'daycare', defaultLOS: 3, defaultRoom: 'Private', defaultItems: ['ROOM-PVT','NURS-GEN','MISC-DIET','CONS-SPEC'] },
  { name: 'C-Section', type: 'surgery', defaultLOS: 5, defaultRoom: 'Private', defaultItems: ['OT-MAJOR','PROF-SURG','PROF-ANAES','ROOM-PVT','NURS-GEN','MISC-DIET'] },
];

const ROOM_TYPES = ['General Ward','Semi-Private','Private','Deluxe','ICU','ICU + Private','ICU + Semi-Private'];

export default function EstimateGenerator({ estimates, centreId, staffId, tariffs, onCreate, onFlash }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof PROCEDURE_TEMPLATES[0] | null>(null);
  const [form, setForm] = useState<any>({ patientId: '', procedureName: '', estimateType: 'surgery', payorType: 'self', roomCategory: 'Private', expectedLOS: 5, items: [] as any[], notes: '' });
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const selectTemplate = (t: typeof PROCEDURE_TEMPLATES[0]) => {
    setSelectedTemplate(t);
    const items = t.defaultItems.map(code => {
      const tariff = tariffs.tariffs.find((tr: any) => tr.service_code === code);
      if (!tariff) return null;
      const rate = tariffs.getRate(tariff.id, form.payorType);
      const isDaily = tariff.category === 'room_rent' || tariff.category === 'nursing' || tariff.category === 'icu_charges' || tariff.service_name.includes('per day') || tariff.service_name.includes('Diet');
      return { code, name: tariff.service_name, category: tariff.category, rate, quantity: isDaily ? t.defaultLOS : 1, total: rate * (isDaily ? t.defaultLOS : 1) };
    }).filter(Boolean);
    setForm((f: any) => ({ ...f, procedureName: t.name, estimateType: t.type, expectedLOS: t.defaultLOS, roomCategory: t.defaultRoom, items }));
  };

  const updatePayor = (payor: string) => {
    setForm((f: any) => {
      const items = f.items.map((item: any) => {
        const tariff = tariffs.tariffs.find((t: any) => t.service_code === item.code);
        if (!tariff) return item;
        const rate = tariffs.getRate(tariff.id, payor);
        return { ...item, rate, total: rate * item.quantity };
      });
      return { ...f, payorType: payor, items };
    });
  };

  const updateLOS = (los: number) => {
    setForm((f: any) => {
      const items = f.items.map((item: any) => {
        const isDaily = item.category === 'room_rent' || item.category === 'nursing' || item.category === 'icu_charges' || item.name.includes('per day') || item.name.includes('Diet');
        const qty = isDaily ? los : item.quantity;
        return { ...item, quantity: qty, total: item.rate * qty };
      });
      return { ...f, expectedLOS: los, items };
    });
  };

  const totalEstimate = form.items.reduce((s: number, i: any) => s + (i?.total || 0), 0);

  const printEstimate = () => {
    const est = { estimate_number: `EST-${Date.now().toString().slice(-6)}`, procedure_name: form.procedureName, room_category: form.roomCategory, expected_los_days: form.expectedLOS, total_estimated: totalEstimate, valid_until: '15 days' };
    const estItems = form.items.map((i: any) => ({ description: i.name, amount: i.total, quantity: 1, unit_rate: i.total, net_amount: i.total }));
    printEstimatePDF(est, estItems, null, HOSPITAL);
  };

  const stColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'converted' ? 'bg-h1-teal-light text-h1-teal' : 'bg-gray-100 text-gray-600';
  const fmt2 = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Cost Estimates / Proforma</h2>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-h1-navy text-white text-xs rounded-lg">{showNew ? 'Cancel' : '+ New Estimate'}</button>
      </div>

      {showNew && !selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="text-sm font-medium mb-3">Select Procedure Template</h3>
        <div className="grid grid-cols-2 gap-2">{PROCEDURE_TEMPLATES.map(t => (
          <button key={t.name} onClick={() => selectTemplate(t)} className="text-left p-3 rounded-lg border hover:border-h1-teal/40 hover:bg-h1-teal-light">
            <div className="font-medium text-sm">{t.name}</div>
            <div className="text-[10px] text-gray-400">{t.defaultLOS} days | {t.defaultRoom} | {t.defaultItems.length} items</div>
          </button>
        ))}</div>
      </div>}

      {showNew && selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        <div className="bg-h1-teal-light border border-h1-teal/20 rounded-lg p-3 flex justify-between items-center">
          <div><h3 className="font-semibold text-sm text-h1-navy">{selectedTemplate.name}</h3><div className="text-[10px] text-h1-teal">{selectedTemplate.defaultLOS} days default stay</div></div>
          <button onClick={() => setSelectedTemplate(null)} className="text-xs text-h1-teal">Change</button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Payor</label>
            <div className="flex gap-1 mt-1">{['self','insurance','govt_pmjay','govt_cghs','corporate'].map(p => (
              <button key={p} onClick={() => updatePayor(p)} className={`flex-1 py-1.5 rounded text-[10px] border ${form.payorType === p ? 'bg-h1-navy text-white' : 'bg-white'}`}>{p.replace('govt_','').replace('_',' ').toUpperCase()}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Room</label>
            <select value={form.roomCategory} onChange={e => setForm((f: any) => ({...f, roomCategory: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">{ROOM_TYPES.map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Expected LOS (days)</label>
            <input type="number" value={form.expectedLOS} onChange={e => updateLOS(parseInt(e.target.value) || 1)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" min="1" max="90" /></div>
        </div>

        {/* Items table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Item</th><th className="p-2">Category</th><th className="p-2 text-center">Qty/Days</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right font-bold">Amount</th>
          </tr></thead><tbody>{form.items.map((i: any, idx: number) => (
            <tr key={idx} className="border-b"><td className="p-2 font-medium">{i.name}</td><td className="p-2 text-center text-[10px] text-gray-500">{i.category?.replace('_',' ')}</td>
              <td className="p-2 text-center"><input type="number" value={i.quantity} onChange={e => { const items = [...form.items]; items[idx] = {...items[idx], quantity: parseInt(e.target.value)||1, total: items[idx].rate * (parseInt(e.target.value)||1)}; setForm((f: any) => ({...f, items})); }} className="w-12 text-center border rounded px-1 py-0.5" min="1" /></td>
              <td className="p-2 text-right">₹{fmt(i.rate)}</td><td className="p-2 text-right font-bold">₹{fmt(i.total)}</td></tr>
          ))}</tbody>
          <tfoot><tr className="bg-h1-teal-light"><td colSpan={4} className="p-2 text-right font-bold text-sm">Estimated Total</td><td className="p-2 text-right font-bold text-lg text-h1-teal">₹{fmt(totalEstimate)}</td></tr></tfoot>
          </table>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">Recommended advance deposit: <b>₹{fmt(totalEstimate * 0.5)}</b> (50% of estimate)</div>

        <div className="flex gap-2">
          <button onClick={printEstimate} className="px-4 py-2 bg-h1-navy text-white text-sm rounded-lg">Print Estimate</button>
          <button onClick={async () => { await onCreate({ patient_id: form.patientId || null, estimate_type: form.estimateType, procedure_name: form.procedureName, payor_type: form.payorType, room_category: form.roomCategory, expected_los_days: form.expectedLOS, items: form.items, total_estimated: totalEstimate, notes: form.notes, valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] }, staffId); setShowNew(false); setSelectedTemplate(null); onFlash('Estimate created'); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Estimate</button>
        </div>
      </div>}

      {/* Estimates list */}
      {estimates.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No estimates created yet</div> :
      <div className="space-y-2">{estimates.map((e: any) => (
        <div key={e.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="font-mono text-xs text-gray-400">{e.estimate_number}</span>
              <span className="font-medium text-sm">{e.patient?.first_name} {e.patient?.last_name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(e.status)}`}>{e.status}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{e.procedure_name} | {e.room_category} | {e.expected_los_days} days | {e.payor_type?.replace('_',' ')}</div>
          </div>
          <div className="text-right"><div className="text-sm font-bold text-h1-teal">₹{fmt2(e.total_estimated)}</div>
            {e.valid_until && <div className="text-[10px] text-gray-400">Valid: {e.valid_until}</div>}</div>
        </div>
      ))}</div>}
    </div>
  );
}
