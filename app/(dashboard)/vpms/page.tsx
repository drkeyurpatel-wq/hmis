'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useIndents, usePurchaseOrders, useGRNs, useVendors } from '@/lib/procurement/procurement-hooks';
import { Plus, X, Search, Truck, Package, Star, Phone, Mail } from 'lucide-react';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
type Tab = 'indents' | 'po' | 'grn' | 'vendors';
const DEPARTMENTS = ['Administration', 'OT', 'ICU', 'Emergency', 'Laboratory', 'Radiology', 'Pharmacy', 'OPD', 'IPD', 'Housekeeping', 'Kitchen', 'Maintenance', 'IT', 'Biomedical', 'CSSD'];
const VENDOR_CATEGORIES = ['pharma', 'surgical', 'medical_equipment', 'it', 'facility', 'lab', 'consumables', 'other'];
const INDENT_BADGE: Record<string, string> = { draft: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', submitted: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', approved: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', rejected: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', ordered: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', partially_received: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', received: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600' };
const PO_BADGE: Record<string, string> = { draft: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', sent: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', partial_received: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', received: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' };
const GRN_BADGE: Record<string, string> = { pending: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', verified: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', posted: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', rejected: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' };

function VPMSInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const indents = useIndents(centreId, staffId);
  const pos = usePurchaseOrders(centreId);
  const grns = useGRNs(centreId);
  const vendors = useVendors(centreId);

  const [tab, setTab] = useState<Tab>('indents');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Indent state
  const [showNewIndent, setShowNewIndent] = useState(false);
  const [indentForm, setIndentForm] = useState({ department: '', priority: 'routine', notes: '' });
  const [indentItems, setIndentItems] = useState<any[]>([{ item_name: '', qty: 1, unit: 'pcs', specification: '', urgency: 'routine', estimated_cost: 0 }]);
  const [indentStatusFilter, setIndentStatusFilter] = useState('all');
  const [selectedIndent, setSelectedIndent] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);

  // Vendor state
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', contact_person: '', phone: '', email: '', category: 'consumables', gst_number: '', address_line1: '', city: '', state: '', pincode: '', credit_days: 30 });
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorCatFilter, setVendorCatFilter] = useState('all');

  // PO/GRN filters
  const [poStatusFilter, setPoStatusFilter] = useState('all');
  const [grnStatusFilter, setGrnStatusFilter] = useState('all');

  const addItem = () => setIndentItems(prev => [...prev, { item_name: '', qty: 1, unit: 'pcs', specification: '', urgency: 'routine', estimated_cost: 0 }]);
  const removeItem = (i: number) => setIndentItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: any) => setIndentItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleCreateIndent = async () => {
    if (!indentForm.department || indentItems.every(i => !i.item_name)) return;
    const validItems = indentItems.filter(i => i.item_name);
    const res = await indents.create({ ...indentForm, items: validItems, status: 'submitted' }, staffId);
    if (res.success) {
      flash('Indent submitted'); setShowNewIndent(false);
      setIndentForm({ department: '', priority: 'routine', notes: '' });
      setIndentItems([{ item_name: '', qty: 1, unit: 'pcs', specification: '', urgency: 'routine', estimated_cost: 0 }]);
    }
  };

  const handleCreateVendor = async () => {
    if (!vendorForm.name) return;
    const res = await vendors.create({ ...vendorForm, credit_days: parseInt(String(vendorForm.credit_days)) || 30 });
    if (res.success) { flash('Vendor added'); setShowNewVendor(false); setVendorForm({ name: '', contact_person: '', phone: '', email: '', category: 'consumables', gst_number: '', address_line1: '', city: '', state: '', pincode: '', credit_days: 30 }); } else { flash(res.error || 'Operation failed'); }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'indents', label: 'Indents', count: indents.stats.total },
    { key: 'po', label: 'Purchase Orders', count: pos.stats.total },
    { key: 'grn', label: 'GRN', count: grns.stats.total },
    { key: 'vendors', label: 'Vendors', count: vendors.vendors.length },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Procurement & Purchasing</h1><p className="text-xs text-gray-400">Indents, purchase orders, GRN, vendors</p></div>
        <div className="flex gap-2">
          {tab === 'indents' && <button onClick={() => setShowNewIndent(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Indent</button>}
          {tab === 'vendors' && <button onClick={() => setShowNewVendor(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Add Vendor</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-8 gap-2">
        {[
          { l: 'Pending Approval', v: indents.stats.pendingApproval, c: indents.stats.pendingApproval > 0 ? 'text-amber-700' : 'text-gray-400' },
          { l: 'Approved', v: indents.stats.approved, c: 'text-emerald-700' },
          { l: 'Ordered', v: indents.stats.ordered, c: 'text-blue-700' },
          { l: 'Indent Value', v: INR(indents.stats.totalValue), c: 'text-gray-800' },
          { l: 'POs Active', v: pos.stats.sent, c: 'text-blue-700' },
          { l: 'PO Value', v: INR(pos.stats.totalValue), c: 'text-gray-800' },
          { l: 'GRN Pending', v: grns.stats.pending, c: grns.stats.pending > 0 ? 'text-amber-700' : 'text-gray-400' },
          { l: 'Vendors', v: vendors.vendors.length, c: 'text-teal-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">{TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2 text-xs font-medium rounded-xl flex items-center gap-1.5 ${tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>
          {t.label} {t.count > 0 && <span className={`text-[9px] px-1.5 rounded-full ${tab === t.key ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{t.count}</span>}
        </button>
      ))}</div>

      {/* ═══ INDENTS ═══ */}
      {tab === 'indents' && (<div className="space-y-3">
        <div className="flex gap-1 flex-wrap">
          {['all', 'submitted', 'approved', 'rejected', 'ordered', 'received'].map(s => (
            <button key={s} onClick={() => { setIndentStatusFilter(s); indents.load({ status: s }); }}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg capitalize ${indentStatusFilter === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr><th>Indent#</th><th>Department</th><th>Items</th><th>Priority</th><th className="text-right">Est. Cost</th><th>Requested By</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{indents.indents.map(ind => {
              const items = Array.isArray(ind.items) ? ind.items : [];
              return (
                <tr key={ind.id} className={ind.status === 'submitted' ? 'bg-amber-50/30' : ''}>
                  <td><button onClick={() => setSelectedIndent(ind)} className="font-mono text-teal-600 hover:underline text-[11px] font-bold">{ind.indent_number}</button></td>
                  <td className="text-[11px]">{ind.department}</td>
                  <td className="text-[10px] text-gray-500 max-w-[180px] truncate">{items.length} item{items.length !== 1 ? 's' : ''}: {items.slice(0, 2).map((i: any) => i.item_name).join(', ')}{items.length > 2 ? '...' : ''}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ind.priority === 'emergency' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : ind.priority === 'urgent' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} uppercase text-[8px]`}>{ind.priority}</span></td>
                  <td className="text-right text-[11px] font-semibold">₹{fmt(ind.total_estimated_cost || 0)}</td>
                  <td className="text-[11px]">{ind.requester?.full_name || '—'}</td>
                  <td className="text-[10px] text-gray-500">{new Date(ind.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${INDENT_BADGE[ind.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{ind.status?.replace('_', ' ')}</span></td>
                  <td><div className="flex gap-1">
                    {ind.status === 'draft' && <button onClick={() => { indents.submit(ind.id); flash('Submitted'); }} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-lg font-medium">Submit</button>}
                    {ind.status === 'submitted' && <>
                      <button onClick={() => { indents.approve(ind.id, staffId); flash('Approved'); }} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Approve</button>
                      <button onClick={() => setShowReject(ind.id)} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded-lg font-medium">Reject</button>
                    </>}
                  </div></td>
                </tr>);
            })}{indents.indents.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No indents</td></tr>}</tbody>
          </table>
        </div>
      </div>)}

      {/* ═══ PURCHASE ORDERS ═══ */}
      {tab === 'po' && (<div className="space-y-3">
        <div className="flex gap-1">
          {['all', 'draft', 'sent', 'partial_received', 'received', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setPoStatusFilter(s); pos.load(s); }}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg capitalize ${poStatusFilter === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr><th>PO#</th><th>Supplier</th><th>Items</th><th>Order Date</th><th>Expected</th><th className="text-right">Amount</th><th>Created By</th><th>Status</th></tr></thead>
            <tbody>{pos.orders.map(po => {
              const items = Array.isArray(po.items) ? po.items : [];
              return (
                <tr key={po.id}>
                  <td className="font-mono text-[11px] font-bold text-teal-600">{po.po_number}</td>
                  <td><div className="font-semibold text-[11px]">{po.supplier}</div>{po.supplier_gst && <div className="text-[9px] text-gray-400">GST: {po.supplier_gst}</div>}</td>
                  <td className="text-[10px] text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</td>
                  <td className="text-[10px]">{po.order_date ? new Date(po.order_date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                  <td className="text-[10px]">{po.expected_date ? new Date(po.expected_date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                  <td className="text-right font-semibold text-[11px]">₹{fmt(po.total_amount || 0)}</td>
                  <td className="text-[10px]">{po.creator?.full_name || '—'}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PO_BADGE[po.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{po.status?.replace('_', ' ')}</span></td>
                </tr>);
            })}{pos.orders.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No purchase orders</td></tr>}</tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 text-center">POs are created in the Pharmacy module or the full VPMS system</p>
      </div>)}

      {/* ═══ GRN ═══ */}
      {tab === 'grn' && (<div className="space-y-3">
        <div className="flex gap-1">
          {['all', 'pending', 'verified', 'posted', 'rejected'].map(s => (
            <button key={s} onClick={() => { setGrnStatusFilter(s); grns.load(s); }}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg capitalize ${grnStatusFilter === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr><th>GRN#</th><th>PO#</th><th>Supplier</th><th>Invoice#</th><th>Received</th><th className="text-right">Amount</th><th>Received By</th><th>Status</th></tr></thead>
            <tbody>{grns.grns.map(g => (
              <tr key={g.id} className={g.status === 'pending' ? 'bg-amber-50/30' : ''}>
                <td className="font-mono text-[11px] font-bold">{g.grn_number}</td>
                <td className="text-[10px] text-teal-600 font-mono">{g.po?.po_number || '—'}</td>
                <td className="text-[11px]">{g.supplier}</td>
                <td className="text-[10px]">{g.invoice_number || '—'}</td>
                <td className="text-[10px]">{g.received_date ? new Date(g.received_date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                <td className="text-right font-semibold text-[11px]">₹{fmt(g.total_amount || 0)}</td>
                <td className="text-[10px]">{g.receiver?.full_name || '—'}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${GRN_BADGE[g.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{g.status}</span></td>
              </tr>
            ))}{grns.grns.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No GRNs</td></tr>}</tbody>
          </table>
        </div>
      </div>)}

      {/* ═══ VENDORS ═══ */}
      {tab === 'vendors' && (<div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={vendorSearch} onChange={e => { setVendorSearch(e.target.value); vendors.load({ search: e.target.value, category: vendorCatFilter }); }} className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl" placeholder="Search vendor, GST..." /></div>
          <div className="flex gap-1 flex-wrap">{['all', ...VENDOR_CATEGORIES].map(c => (
            <button key={c} onClick={() => { setVendorCatFilter(c); vendors.load({ category: c, search: vendorSearch }); }}
              className={`px-2 py-1.5 text-[10px] font-medium rounded-lg capitalize ${vendorCatFilter === c ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{c === 'all' ? 'All' : c.replace('_', ' ')}</button>
          ))}</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {vendors.vendors.map(v => (
            <div key={v.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-bold text-sm">{v.name}</div>{v.code && <div className="text-[9px] text-gray-400 font-mono">{v.code}</div>}</div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 capitalize text-[8px]">{v.category?.replace('_', ' ')}</span>
              </div>
              <div className="space-y-1 text-[11px] text-gray-600">
                {v.contact_person && <div className="flex items-center gap-1.5"><Package size={10} className="text-gray-400" />{v.contact_person}</div>}
                {v.phone && <div className="flex items-center gap-1.5"><Phone size={10} className="text-gray-400" />{v.phone}</div>}
                {v.email && <div className="flex items-center gap-1.5"><Mail size={10} className="text-gray-400" />{v.email}</div>}
                {v.gst_number && <div className="text-[9px] text-gray-400">GST: {v.gst_number}</div>}
                {v.city && <div className="text-[9px] text-gray-400">{v.city}{v.state ? `, ${v.state}` : ''}</div>}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t">
                <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={11} className={s <= Math.round(v.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />)}</div>
                <div className="text-[9px] text-gray-400">Credit: {v.credit_days || 30}d</div>
              </div>
            </div>
          ))}
          {vendors.vendors.length === 0 && <div className="col-span-3 text-center py-12 bg-white rounded-2xl border text-gray-400">No vendors</div>}
        </div>
      </div>)}

      {/* ═══ NEW INDENT MODAL ═══ */}
      {showNewIndent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewIndent(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Raise Purchase Indent</h2><button onClick={() => setShowNewIndent(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department *</label>
                <select value={indentForm.department} onChange={e => setIndentForm(f => ({ ...f, department: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm">
                  <option value="">Select</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Priority</label>
                <div className="flex gap-1 mt-1">{['routine', 'urgent', 'emergency'].map(p => (
                  <button key={p} onClick={() => setIndentForm(f => ({ ...f, priority: p }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${indentForm.priority === p ? (p === 'emergency' ? 'bg-red-600 text-white' : p === 'urgent' ? 'bg-amber-500 text-white' : 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{p}</button>
                ))}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Notes</label>
                <input value={indentForm.notes} onChange={e => setIndentForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" placeholder="Optional" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-gray-500 uppercase font-semibold">Items *</label>
                <button onClick={addItem} className="text-[10px] text-teal-600 font-semibold flex items-center gap-1"><Plus size={12} /> Add Item</button>
              </div>
              <div className="space-y-2">
                {indentItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-gray-50 rounded-xl p-2.5">
                    <div className="col-span-4"><label className="text-[8px] text-gray-400 uppercase">Item *</label><input value={item.item_name} onChange={e => updateItem(i, 'item_name', e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs" placeholder="e.g., Surgical gloves" /></div>
                    <div className="col-span-1"><label className="text-[8px] text-gray-400 uppercase">Qty</label><input type="number" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs" /></div>
                    <div className="col-span-1"><label className="text-[8px] text-gray-400 uppercase">Unit</label><select value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="w-full px-1 py-1.5 border rounded-lg text-[10px]"><option>pcs</option><option>box</option><option>pack</option><option>kg</option><option>ltr</option><option>roll</option><option>set</option></select></div>
                    <div className="col-span-3"><label className="text-[8px] text-gray-400 uppercase">Spec</label><input value={item.specification} onChange={e => updateItem(i, 'specification', e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs" placeholder="Size, brand..." /></div>
                    <div className="col-span-2"><label className="text-[8px] text-gray-400 uppercase">Cost/unit ₹</label><input type="number" value={item.estimated_cost} onChange={e => updateItem(i, 'estimated_cost', e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs" /></div>
                    <div className="col-span-1 text-right">{indentItems.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>}</div>
                  </div>
                ))}
              </div>
              {indentItems.some(i => i.estimated_cost > 0) && (
                <div className="text-right mt-2 text-sm font-bold text-gray-700">Estimated Total: ₹{fmt(indentItems.reduce((s, i) => s + parseFloat(i.estimated_cost || 0) * parseFloat(i.qty || 1), 0))}</div>
              )}
            </div>
            <button onClick={handleCreateIndent} disabled={!indentForm.department || indentItems.every(i => !i.item_name)} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Submit Indent</button>
          </div>
        </div>
      )}

      {/* ═══ INDENT DETAIL ═══ */}
      {selectedIndent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedIndent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div><h2 className="text-lg font-bold">{selectedIndent.indent_number}</h2><div className="text-xs text-gray-400">{selectedIndent.department} · {selectedIndent.requester?.full_name}</div></div>
              <div className="flex items-center gap-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${INDENT_BADGE[selectedIndent.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{selectedIndent.status?.replace('_', ' ')}</span><button onClick={() => setSelectedIndent(null)}><X size={18} className="text-gray-400" /></button></div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-2.5"><div className="text-[9px] text-gray-400 uppercase">Priority</div><div className={`text-sm font-bold capitalize ${selectedIndent.priority === 'emergency' ? 'text-red-600' : selectedIndent.priority === 'urgent' ? 'text-amber-600' : 'text-gray-600'}`}>{selectedIndent.priority}</div></div>
              <div className="bg-gray-50 rounded-xl p-2.5"><div className="text-[9px] text-gray-400 uppercase">Items</div><div className="text-sm font-bold">{(selectedIndent.items || []).length}</div></div>
              <div className="bg-gray-50 rounded-xl p-2.5"><div className="text-[9px] text-gray-400 uppercase">Est. Cost</div><div className="text-sm font-bold">₹{fmt(selectedIndent.total_estimated_cost || 0)}</div></div>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-[11px]"><thead><tr><th>Item</th><th className="text-center">Qty</th><th>Unit</th><th>Spec</th><th className="text-right">Cost</th></tr></thead>
                <tbody>{(selectedIndent.items || []).map((item: any, i: number) => (
                  <tr key={i}><td className="font-semibold">{item.item_name}</td><td className="text-center font-bold">{item.qty}</td><td>{item.unit}</td><td className="text-gray-500">{item.specification || '—'}</td><td className="text-right">₹{fmt(parseFloat(item.estimated_cost || 0) * parseFloat(item.qty || 1))}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {selectedIndent.notes && <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600"><span className="font-semibold">Notes:</span> {selectedIndent.notes}</div>}
            {selectedIndent.approved_by && <div className="text-xs text-emerald-600">Approved by {selectedIndent.approver?.full_name} on {new Date(selectedIndent.approved_at).toLocaleDateString('en-IN')}</div>}
            {selectedIndent.rejection_reason && <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600"><span className="font-semibold">Rejected:</span> {selectedIndent.rejection_reason}</div>}
          </div>
        </div>
      )}

      {/* ═══ REJECT MODAL ═══ */}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowReject(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Reject Indent</h2>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm h-20 resize-none" placeholder="Reason for rejection..." />
            <button onClick={() => { indents.reject(showReject, staffId, rejectReason); setShowReject(null); setRejectReason(''); flash('Rejected'); }} disabled={!rejectReason} className="w-full py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Reject Indent</button>
          </div>
        </div>
      )}

      {/* ═══ NEW VENDOR MODAL ═══ */}
      {showNewVendor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewVendor(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Add Vendor</h2><button onClick={() => setShowNewVendor(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Company Name *</label><input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Contact Person</label><input value={vendorForm.contact_person} onChange={e => setVendorForm(f => ({ ...f, contact_person: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Phone</label><input value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Email</label><input value={vendorForm.email} onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Category</label><select value={vendorForm.category} onChange={e => setVendorForm(f => ({ ...f, category: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm">{VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">GST Number</label><input value={vendorForm.gst_number} onChange={e => setVendorForm(f => ({ ...f, gst_number: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Credit Days</label><input type="number" value={vendorForm.credit_days} onChange={e => setVendorForm(f => ({ ...f, credit_days: parseInt(e.target.value) || 30 }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Address</label><input value={vendorForm.address_line1} onChange={e => setVendorForm(f => ({ ...f, address_line1: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">City</label><input value={vendorForm.city} onChange={e => setVendorForm(f => ({ ...f, city: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">State</label><input value={vendorForm.state} onChange={e => setVendorForm(f => ({ ...f, state: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
            </div>
            <button onClick={handleCreateVendor} disabled={!vendorForm.name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Add Vendor</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VPMSPage() { return <RoleGuard module="settings"><VPMSInner /></RoleGuard>; }
