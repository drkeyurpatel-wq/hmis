// components/ipd/cpoe-panel.tsx
// Computerized Physician Order Entry — embedded in IPD clinical page
'use client';
import React, { useState } from 'react';
import { useCPOE, ORDER_TEMPLATES, type CPOEOrder, type OrderTemplate } from '@/lib/cpoe/cpoe-hooks';
import { useAuthStore } from '@/lib/store/auth';

const TYPE_ICONS: Record<string, string> = {
  medication: '', lab: '', radiology: '🩻', diet: '🍽️',
  nursing: '', activity: '🚶', consult: '👨‍⚕️', procedure: '🔪',
};
const PRIORITY_COLORS: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-600', urgent: 'bg-amber-100 text-amber-700',
  stat: 'bg-red-100 text-red-700', asap: 'bg-orange-100 text-orange-700',
};
const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-blue-100 text-blue-700', verified: 'bg-green-100 text-green-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700', held: 'bg-amber-100 text-amber-700',
};

interface Props { admissionId: string; patientId: string; onFlash: (m: string) => void; }

export default function CPOEPanel({ admissionId, patientId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const cpoe = useCPOE(admissionId);

  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [form, setForm] = useState({ orderType: 'medication' as string, orderText: '', priority: 'routine', isVerbal: false, notes: '' });
  const [filter, setFilter] = useState('all');

  const handlePlace = async () => {
    if (!form.orderText.trim()) return;
    const result = await cpoe.placeOrder({
      patientId, orderType: form.orderType, orderText: form.orderText,
      priority: form.priority, isVerbal: form.isVerbal, notes: form.notes, staffId,
    });
    if (result.success) {
      onFlash(`${form.isVerbal ? 'Verbal order' : 'Order'} placed: ${form.orderText}`);
      setForm({ orderType: 'medication', orderText: '', priority: 'routine', isVerbal: false, notes: '' });
      setShowNew(false);
    }
  };

  const handleApplyTemplate = async (template: OrderTemplate) => {
    const result = await cpoe.applyTemplate(template, patientId, staffId);
    if (result.success) {
      onFlash(`Template applied: ${template.name} (${result.count} orders)`);
      setShowTemplates(false);
    }
  };

  const filtered = filter === 'all' ? cpoe.orders :
    filter === 'active' ? cpoe.orders.filter(o => ['ordered', 'verified', 'in_progress'].includes(o.status)) :
    cpoe.orders.filter(o => o.orderType === filter);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Orders (CPOE) — {cpoe.stats.active} active</h2>
        <div className="flex gap-1">
          <button onClick={() => setShowTemplates(!showTemplates)} className={`px-2 py-1 text-[10px] rounded border ${showTemplates ? 'bg-purple-600 text-white' : 'bg-white text-purple-700'}`}>Order Sets</button>
          <button onClick={() => setShowNew(!showNew)} className={`px-3 py-1 text-[10px] rounded-lg ${showNew ? 'bg-gray-200' : 'bg-blue-600 text-white'}`}>{showNew ? 'Cancel' : '+ New Order'}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2">
        {cpoe.stats.pendingVerify > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded">{cpoe.stats.pendingVerify} pending verification</span>}
        {cpoe.stats.verbal > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded">{cpoe.stats.verbal} verbal — needs cosign</span>}
        {Object.entries(cpoe.stats.byType).map(([type, count]) => (
          <span key={type} className="text-[10px] bg-gray-100 px-2 py-1 rounded">{TYPE_ICONS[type]} {count}</span>
        ))}
      </div>

      {/* Order templates */}
      {showTemplates && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <h3 className="text-xs font-bold text-purple-700 mb-2">Order Set Templates</h3>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => handleApplyTemplate(t)}
                className="text-left bg-white rounded-lg border p-3 hover:border-purple-300">
                <div className="font-bold text-xs">{t.name}</div>
                <div className="text-[10px] text-gray-500">{t.description}</div>
                <div className="text-[9px] text-purple-600 mt-1">{t.orders.length} orders</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New order form */}
      {showNew && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[9px] text-gray-500">Order Type</label>
              <select value={form.orderType} onChange={e => setForm(f => ({ ...f, orderType: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {['medication', 'lab', 'radiology', 'diet', 'nursing', 'activity', 'consult', 'procedure'].map(t =>
                  <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                )}
              </select></div>
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Order Text *</label>
              <input type="text" value={form.orderText} onChange={e => setForm(f => ({ ...f, orderText: e.target.value }))}
                className="w-full px-2 py-1.5 border rounded text-xs" placeholder="e.g., Inj. Ceftriaxone 1g IV BD × 7 days" /></div>
            <div><label className="text-[9px] text-gray-500">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {['routine', 'urgent', 'stat', 'asap'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select></div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form.isVerbal} onChange={e => setForm(f => ({ ...f, isVerbal: e.target.checked }))} className="rounded" /><span>Verbal Order (needs cosign within 24h)</span></label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" placeholder="Notes (optional)" />
            <button onClick={handlePlace} disabled={!form.orderText.trim()} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-40">Place Order</button>
          </div>
          {/* Quick order buttons */}
          <div className="flex flex-wrap gap-1">
            {[
              [' NS 500ml IV', 'medication', 'NS 0.9% 500ml IV over 4hr'],
              [' Paracetamol 1g IV', 'medication', 'Inj. Paracetamol 1g IV Q8H'],
              [' CBC + RBS', 'lab', 'CBC, RBS — routine'],
              [' ABG', 'lab', 'Arterial blood gas — stat'],
              ['🩻 CXR', 'radiology', 'Chest X-ray PA view'],
              [' Vitals Q4H', 'nursing', 'Vitals monitoring Q4H'],
              [' Strict I/O', 'nursing', 'Strict intake/output charting'],
              ['🍽️ NPO', 'diet', 'Nil per oral'],
              ['🍽️ Liquid diet', 'diet', 'Clear liquid diet'],
            ].map(([label, type, text]) => (
              <button key={label} onClick={() => { setForm(f => ({ ...f, orderType: type as string, orderText: text as string })); }}
                className="px-2 py-1 bg-gray-50 border rounded text-[9px] hover:bg-blue-50">{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1">
        {['all', 'active', 'medication', 'lab', 'radiology', 'nursing', 'diet'].map(f =>
          <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 text-[10px] rounded border ${filter === f ? 'bg-blue-600 text-white' : 'bg-white'}`}>
            {f === 'all' ? `All (${cpoe.orders.length})` : f === 'active' ? `Active (${cpoe.stats.active})` : `${TYPE_ICONS[f] || ''} ${f}`}
          </button>
        )}
      </div>

      {/* Orders list */}
      {cpoe.loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
      filtered.length === 0 ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-xs">No orders. Use '+ New Order' or apply an Order Set template.</div> :
      <div className="space-y-1.5">
        {filtered.map((o: CPOEOrder) => (
          <div key={o.id} className={`bg-white rounded-lg border px-3 py-2 flex items-center justify-between ${o.status === 'cancelled' ? 'opacity-40 line-through' : ''}`}>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-base">{TYPE_ICONS[o.orderType]}</span>
              <div>
                <div className="text-xs font-medium">{o.orderText}</div>
                <div className="text-[10px] text-gray-400">
                  {o.orderedByName} • {new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {o.isVerbal && !o.cosignedBy && <span className="text-amber-600 font-medium ml-1">VERBAL — needs cosign</span>}
                  {o.notes && <span className="ml-1 text-gray-400">— {o.notes}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[8px] ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] ${STATUS_COLORS[o.status]}`}>{o.status}</span>
              {o.status === 'ordered' && <button onClick={() => cpoe.verifyOrder(o.id)} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[8px]">Verify</button>}
              {o.isVerbal && !o.cosignedBy && <button onClick={() => cpoe.cosignOrder(o.id, staffId)} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px]">Cosign</button>}
              {['ordered', 'verified'].includes(o.status) && <button onClick={() => cpoe.cancelOrder(o.id, 'Cancelled by physician', staffId)} className="text-red-400 text-[9px]">✕</button>}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
