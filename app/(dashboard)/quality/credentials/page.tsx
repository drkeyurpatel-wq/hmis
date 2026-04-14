// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [cme, setCme] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => {
    Promise.all([
      fetch(`/api/quality/credentials?centre_id=${centreId}`).then(r => r.json()),
    ]).then(([c]) => { setCredentials(c); });
  }, []);
  const expiring = credentials.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date(Date.now() + 90*86400000));
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Staff Credentialing</h1>
      <p className="text-sm text-gray-500">HRM.11-13 — Medical, Nursing & Allied Health Credentialing</p>
      {expiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 text-sm">⚠️ Expiring within 90 days ({expiring.length})</h3>
          <div className="mt-2 space-y-1">{expiring.map((c:any) => (
            <div key={c.id} className="text-sm">{c.staff_name} — {c.credential_name} (expires {new Date(c.expiry_date).toLocaleDateString()})</div>
          ))}</div>
        </div>
      )}
      <div className="border rounded-lg divide-y">
        {credentials.length === 0 && <div className="p-8 text-center text-gray-500">No credentials recorded</div>}
        {credentials.map((c:any) => (
          <div key={c.id} className="p-3 flex items-center justify-between">
            <div><span className="font-medium text-sm">{c.staff_name}</span><div className="text-xs text-gray-500">{c.credential_type}: {c.credential_name}</div></div>
            <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : c.status === 'EXPIRING_SOON' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
