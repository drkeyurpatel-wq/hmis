'use client';
import React from 'react';

interface RatesTabProps {
  rates: any[];
}

export default function RatesTab({ rates }: RatesTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Homecare Service Rate Card</h2>
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="text-left p-2.5">Code</th><th className="text-left p-2.5">Service</th><th className="p-2.5">Category</th><th className="p-2.5 text-right">Rate (Rs.)</th><th className="p-2.5">Unit</th>
      </tr></thead><tbody>{rates.map((r: any) => (
        <tr key={r.id} className="border-b hover:bg-gray-50">
          <td className="p-2.5 font-mono text-[10px]">{r.service_code}</td>
          <td className="p-2.5 font-medium">{r.service_name}</td>
          <td className="p-2.5 text-center"><span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{r.category.replace(/_/g,' ')}</span></td>
          <td className="p-2.5 text-right font-medium">{parseFloat(r.rate).toLocaleString('en-IN')}</td>
          <td className="p-2.5 text-center text-gray-500">{r.unit.replace(/_/g,' ')}</td>
        </tr>
      ))}</tbody></table></div>
    </div>
  );
}
