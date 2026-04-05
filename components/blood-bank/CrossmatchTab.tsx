'use client';
import React from 'react';
import { FlaskConical } from 'lucide-react';

interface CrossmatchTabProps {
  matches: any[];
  complete: (xmatchId: string, result: string, immediateSpin: string, incubation: string, ictAgt: string, staffId: string) => Promise<void>;
  staffId: string;
  groupColor: (g: string) => string;
}

export default function CrossmatchTab({ matches, complete, staffId, groupColor }: CrossmatchTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Crossmatch / Compatibility Testing</h2>
      {matches.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border"><FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm font-medium text-gray-500">No crossmatch requests</p><p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Components must be prepared before crossmatching.</p></div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Patient</th><th className="p-2">Patient Grp</th><th className="p-2">Component</th><th className="p-2">IS</th><th className="p-2">37°C</th><th className="p-2">ICT/AGT</th><th className="p-2">Result</th><th className="p-2">Actions</th>
      </tr></thead><tbody>{matches.map((m: any) => (
        <tr key={m.id} className={`border-b ${m.result === 'incompatible' ? 'bg-red-50' : ''}`}>
          <td className="p-2">{m.patient?.first_name} {m.patient?.last_name} ({m.patient?.uhid})</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded ${groupColor(m.patient_abo + (m.patient_rh === 'positive' ? '+' : '-'))}`}>{m.patient_abo}{m.patient_rh === 'positive' ? '+' : '-'}</span></td>
          <td className="p-2 text-center">{m.component?.blood_group} {m.component?.component_type?.replace(/_/g, ' ')}</td>
          <td className="p-2 text-center">{m.immediate_spin === 'compatible' ? '✓' : m.immediate_spin === 'incompatible' ? '✗' : '—'}</td>
          <td className="p-2 text-center">{m.incubation_37c === 'compatible' ? '✓' : m.incubation_37c === 'incompatible' ? '✗' : '—'}</td>
          <td className="p-2 text-center">{m.ict_agt === 'compatible' ? '✓' : m.ict_agt === 'incompatible' ? '✗' : '—'}</td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.result === 'compatible' ? 'bg-green-100 text-green-700' : m.result === 'incompatible' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.result}</span></td>
          <td className="p-2 text-center">{m.result === 'pending' && <button onClick={() => complete(m.id, 'compatible', 'compatible', 'compatible', 'compatible', staffId)} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Compatible</button>}</td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}
