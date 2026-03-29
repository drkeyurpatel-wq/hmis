// components/emr-mobile/order-quick.tsx
// Quick order entry for mobile — lab, radiology, medication
'use client';
import React, { useState, useMemo } from 'react';

const COMMON_LABS = ['CBC', 'RFT', 'LFT', 'Blood Sugar', 'HbA1c', 'Electrolytes', 'PT/INR', 'Troponin', 'ABG', 'D-Dimer', 'CRP', 'Blood Culture', 'Urine Routine', 'Lipid Profile'];
const COMMON_RAD = ['X-Ray Chest PA', 'CT Brain', 'USG Abdomen', 'HRCT Chest', 'MRI LS Spine', '2D Echo', 'CT Abdomen'];
const COMMON_MEDS = [
  { drug: 'Paracetamol 650mg', dose: '650mg', route: 'Oral', frequency: 'TDS' },
  { drug: 'Pantoprazole 40mg', dose: '40mg', route: 'IV', frequency: 'OD' },
  { drug: 'Ondansetron 4mg', dose: '4mg', route: 'IV', frequency: 'SOS' },
  { drug: 'Tramadol 50mg', dose: '50mg', route: 'IV', frequency: 'SOS' },
  { drug: 'Amoxicillin 500mg', dose: '500mg', route: 'Oral', frequency: 'TDS' },
  { drug: 'Enoxaparin 40mg', dose: '40mg', route: 'SC', frequency: 'OD' },
];

interface Props {
  onPlaceOrder: (order: { orderType: string; orderText: string; details: any; priority: string }) => Promise<void>;
  recentOrders: any[];
  activeMeds: any[];
  onFlash: (msg: string) => void;
}

export default function OrderQuick({ onPlaceOrder, recentOrders, activeMeds, onFlash }: Props) {
  const [orderType, setOrderType] = useState<'lab' | 'radiology' | 'medication'>('lab');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('routine');

  const placeQuick = async (text: string, details: any = {}) => {
    await onPlaceOrder({ orderType, orderText: text, details, priority });
    onFlash(`Order placed: ${text}`);
  };

  const items = orderType === 'lab' ? COMMON_LABS : orderType === 'radiology' ? COMMON_RAD : [];
  const filtered = search ? items.filter(i => i.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {(['lab', 'radiology', 'medication'] as const).map(t => (
          <button key={t} onClick={() => { setOrderType(t); setSearch(''); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg ${orderType === t ? 'bg-white shadow text-teal-700' : 'text-gray-500'}`}>
            {t === 'lab' ? ' Lab' : t === 'radiology' ? '📷 Radiology' : ' Meds'}
          </button>
        ))}
      </div>

      {/* Priority */}
      <div className="flex gap-1">
        {['routine', 'urgent', 'stat'].map(p => (
          <button key={p} onClick={() => setPriority(p)}
            className={`flex-1 py-1.5 text-xs rounded-lg border ${priority === p ? (p === 'stat' ? 'bg-red-600 text-white border-red-600' : p === 'urgent' ? 'bg-amber-500 text-white border-amber-500' : 'bg-teal-600 text-white border-teal-600') : 'bg-white'}`}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Lab / Radiology quick buttons */}
      {orderType !== 'medication' && <>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder={`Search ${orderType}...`} />
        <div className="flex flex-wrap gap-1.5">
          {filtered.map(item => (
            <button key={item} onClick={() => placeQuick(item, orderType === 'lab' ? { tests: [item] } : { modality: item.split(' ')[0], bodyPart: item })}
              className="px-3 py-2 bg-white border rounded-xl text-sm active:bg-teal-50 active:border-teal-300">{item}</button>
          ))}
        </div>
      </>}

      {/* Medication quick buttons */}
      {orderType === 'medication' && <div className="space-y-1.5">
        {COMMON_MEDS.map(m => (
          <button key={m.drug} onClick={() => placeQuick(m.drug, { drug: m.drug, dose: m.dose, route: m.route, frequency: m.frequency })}
            className="w-full text-left bg-white border rounded-xl p-3 active:bg-teal-50 flex justify-between items-center">
            <span className="text-sm font-medium">{m.drug}</span>
            <span className="text-xs text-gray-400">{m.route} {m.frequency}</span>
          </button>
        ))}
      </div>}

      {/* Recent Orders */}
      {recentOrders.length > 0 && <div className="bg-white rounded-xl border p-3">
        <h4 className="text-xs font-bold text-gray-500 mb-2">Recent Orders</h4>
        {recentOrders.slice(0, 5).map((o: any, i: number) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
            <div><span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${o.orderType === 'lab' ? 'bg-blue-100 text-blue-700' : o.orderType === 'radiology' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{o.orderType}</span>{o.orderText}</div>
            <span className={`text-[9px] ${o.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{o.status}</span>
          </div>
        ))}
      </div>}

      {/* Active Medications */}
      {activeMeds.length > 0 && <div className="bg-white rounded-xl border p-3">
        <h4 className="text-xs font-bold text-gray-500 mb-2">Active Medications ({activeMeds.length})</h4>
        {activeMeds.map((m: any, i: number) => (
          <div key={i} className="text-xs py-1 border-b last:border-0">
            <span className="font-medium">{m.drug_name}</span> <span className="text-gray-400">{m.dose} {m.route} {m.frequency}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}
