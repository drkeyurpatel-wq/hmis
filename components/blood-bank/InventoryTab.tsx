'use client';
import React from 'react';
import { BLOOD_GROUPS } from '@/lib/lab/blood-bank-hooks';

interface InventoryTabProps {
  inventory: { bloodGroup: string; componentType: string; units: number }[];
  components: any[];
  groupColor: (g: string) => string;
}

const DISPLAY_COMPONENTS = ['whole_blood', 'prbc', 'ffp', 'platelet_concentrate', 'cryoprecipitate', 'sdp'] as const;

export default function InventoryTab({ inventory, components, groupColor }: InventoryTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Blood Inventory — Available Stock</h2>
      {/* Matrix: Groups × Components */}
      <div className="bg-white rounded-xl border overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="p-2.5 text-left font-medium text-gray-500">Blood Group</th>
            {DISPLAY_COMPONENTS.map(c =>
              <th key={c} className="p-2.5 font-medium text-gray-500 text-center">{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>
            )}
            <th className="p-2.5 font-medium text-gray-500 text-center">Total</th>
          </tr></thead>
          <tbody>{BLOOD_GROUPS.map(g => {
            const row = DISPLAY_COMPONENTS.map(c => {
              const match = inventory.find(i => i.bloodGroup === g && i.componentType === c);
              return match?.units || 0;
            });
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={g} className="border-b hover:bg-gray-50">
                <td className="p-2.5"><span className={`px-2 py-0.5 rounded font-bold text-xs ${groupColor(g)}`}>{g}</span></td>
                {row.map((v, i) => <td key={i} className={`p-2.5 text-center font-medium ${v > 0 ? '' : 'text-gray-300'}`}>{v}</td>)}
                <td className="p-2.5 text-center font-bold">{total}</td>
              </tr>
            );
          })}</tbody>
          <tfoot><tr className="bg-gray-50 font-bold">
            <td className="p-2.5">Total</td>
            {DISPLAY_COMPONENTS.map(c => {
              const total = inventory.filter(i => i.componentType === c).reduce((s, i) => s + i.units, 0);
              return <td key={c} className="p-2.5 text-center">{total}</td>;
            })}
            <td className="p-2.5 text-center text-red-700">{inventory.reduce((s, i) => s + i.units, 0)}</td>
          </tr></tfoot>
        </table>
      </div>

      {/* Expiring soon */}
      {(() => {
        const soon = components.filter(c => {
          const days = (new Date(c.expiry_date).getTime() - Date.now()) / 86400000;
          return days <= 3 && days >= 0 && c.status === 'available';
        });
        return soon.length > 0 && <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-4">
          <h3 className="text-sm font-medium text-orange-800 mb-2">Expiring within 3 days ({soon.length})</h3>
          {soon.map(c => <div key={c.id} className="text-xs flex items-center justify-between py-1 border-b border-orange-100 last:border-0">
            <span><span className={`px-1.5 py-0.5 rounded ${groupColor(c.blood_group)}`}>{c.blood_group}</span> {c.component_type.replace(/_/g, ' ')} — {c.component_number}</span>
            <span className="text-orange-600 font-medium">Exp: {c.expiry_date}</span>
          </div>)}
        </div>;
      })()}

      {/* All available */}
      <h3 className="text-xs font-medium text-gray-500 mb-2">Available Components ({components.filter(c => c.status === 'available').length})</h3>
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Component #</th><th className="p-2">Group</th><th className="p-2">Type</th><th className="p-2">Volume</th><th className="p-2">Expiry</th><th className="p-2">Status</th>
      </tr></thead><tbody>{components.slice(0, 30).map(c => (
        <tr key={c.id} className="border-b hover:bg-gray-50">
          <td className="p-2 font-mono text-[10px]">{c.component_number}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(c.blood_group)}`}>{c.blood_group}</span></td>
          <td className="p-2 text-center">{c.component_type.replace(/_/g, ' ')}</td>
          <td className="p-2 text-center">{c.volume_ml} ml</td>
          <td className="p-2 text-center">{c.expiry_date}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${c.status === 'available' ? 'bg-green-100 text-green-700' : c.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{c.status}</span></td>
        </tr>
      ))}</tbody></table></div>
    </div>
  );
}
