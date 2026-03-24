'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDocuments } from '@/lib/documents/document-hooks';
import { Plus, X, Search, FileText, Download, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const DOC_TYPES = ['policy', 'sop', 'protocol', 'guideline', 'form', 'manual', 'circular', 'memo'];
const TYPE_BADGE: Record<string, string> = { policy: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', sop: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', protocol: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', guideline: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', form: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', manual: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', circular: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', memo: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600' };
const STATUS_BADGE: Record<string, string> = { draft: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', under_review: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', approved: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', superseded: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', archived: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600' };

function DocsInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const docs = useDocuments(centreId);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ doc_type: 'sop', department: '', title: '', content_html: '', effective_date: '', review_date: '', is_nabh_required: false, nabh_standard: '', tags: '' });

  const handleCreate = async () => {
    if (!form.title) return;
    const res = await docs.create({
      ...form, tags: form.tags ? form.tags.split(',').map(s => s.trim()) : [],
      effective_date: form.effective_date || null, review_date: form.review_date || null,
    }, staffId);
    if (res.success) { flash('Document created'); setShowNew(false); setForm({ doc_type: 'sop', department: '', title: '', content_html: '', effective_date: '', review_date: '', is_nabh_required: false, nabh_standard: '', tags: '' }); } else { flash(res.error || 'Operation failed'); }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Document & SOP Management</h1><p className="text-xs text-gray-400">NABH Document Control System</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Document</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Total', v: docs.stats.total, c: 'text-gray-800' },
          { l: 'Approved', v: docs.stats.approved, c: 'text-emerald-700' },
          { l: 'Draft', v: docs.stats.draft, c: 'text-gray-500' },
          { l: 'Under Review', v: docs.stats.underReview, c: 'text-amber-700' },
          { l: 'Review Due (30d)', v: docs.stats.reviewDueSoon, c: docs.stats.reviewDueSoon > 0 ? 'text-amber-700' : 'text-gray-400' },
          { l: 'Review Overdue', v: docs.stats.reviewOverdue, c: docs.stats.reviewOverdue > 0 ? 'text-red-600' : 'text-gray-400' },
          { l: 'NABH Required', v: docs.stats.nabh, c: 'text-blue-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {/* Type breakdown */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(docs.stats.byType).map(([k, v]) => (
          <div key={k} className="bg-white rounded-xl border px-3 py-2 flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_BADGE[k] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{k}</span>
            <span className="font-bold text-sm">{v as number}</span>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); docs.load({ search: e.target.value, type: typeFilter, status: statusFilter }); }} className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg" placeholder="Search title, doc#..." /></div>
          <div className="flex gap-1">{['all', ...DOC_TYPES].map(t => <button key={t} onClick={() => { setTypeFilter(t); docs.load({ type: t, status: statusFilter, search }); }} className={`px-2 py-1.5 text-[10px] font-medium rounded-lg capitalize ${typeFilter === t ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{t}</button>)}</div>
          <div className="flex gap-1">{['all', 'draft', 'under_review', 'approved'].map(s => <button key={s} onClick={() => { setStatusFilter(s); docs.load({ type: typeFilter, status: s, search }); }} className={`px-2 py-1.5 text-[10px] font-medium rounded-lg ${statusFilter === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>)}</div>
        </div>
        <table className="w-full text-xs"><thead><tr><th>Doc#</th><th>Title</th><th>Type</th><th>Department</th><th>Version</th><th>Status</th><th>Review Date</th><th>NABH</th><th>Actions</th></tr></thead>
          <tbody>{docs.documents.map(d => {
            const reviewOverdue = d.status === 'approved' && d.review_date && d.review_date < today;
            return (
              <tr key={d.id} className={reviewOverdue ? 'bg-red-50/50' : ''}>
                <td className="font-mono text-[10px]">{d.doc_number}</td>
                <td><div className="font-semibold">{d.title}</div>{d.tags?.length > 0 && <div className="flex gap-1 mt-0.5">{d.tags.slice(0, 3).map((t: string) => <span key={t} className="text-[8px] bg-gray-100 text-gray-500 px-1 rounded">{t}</span>)}</div>}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_BADGE[d.doc_type] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize`}>{d.doc_type}</span></td>
                <td className="text-[11px]">{d.department || '—'}</td>
                <td className="font-bold">v{d.version}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[d.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{d.status?.replace('_', ' ')}</span></td>
                <td className="text-[11px]">
                  {d.review_date ? (
                    <span className={reviewOverdue ? 'text-red-600 font-bold flex items-center gap-1' : d.review_date <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] ? 'text-amber-600' : 'text-gray-500'}>
                      {reviewOverdue && <AlertTriangle size={10} />}
                      {new Date(d.review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  ) : '—'}
                </td>
                <td>{d.is_nabh_required ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 text-[8px]">{d.nabh_standard || 'NABH'}</span> : '—'}</td>
                <td>
                  <div className="flex gap-1">
                    {d.status === 'draft' && <button onClick={() => docs.update(d.id, { status: 'under_review' })} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium">Submit</button>}
                    {d.status === 'under_review' && <button onClick={() => { docs.approve(d.id, staffId); flash('Approved'); }} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Approve</button>}
                    {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="p-1 bg-gray-50 rounded-lg hover:bg-gray-100"><Download size={12} className="text-gray-500" /></a>}
                  </div>
                </td>
              </tr>
            );
          })}{docs.documents.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No documents</td></tr>}</tbody>
        </table>
      </div>

      {/* New Document Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">New Document</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Title *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>{DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}><option value="">All</option>{['Administration', 'Medical', 'Nursing', 'Laboratory', 'Pharmacy', 'Radiology', 'OT', 'ICU', 'Emergency', 'Housekeeping', 'HR', 'Finance', 'IT', 'Quality'].map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Effective Date</label><input type="date" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Review Date</label><input type="date" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.review_date} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Tags (comma separated)</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="nabh, icu, safety" /></div>
              <div className="flex items-center gap-2 mt-4"><input type="checkbox" checked={form.is_nabh_required} onChange={e => setForm(f => ({ ...f, is_nabh_required: e.target.checked }))} className="rounded" /><span className="text-xs">NABH Required</span>
                {form.is_nabh_required && <input className="px-2 py-1 border rounded-lg text-xs w-24" placeholder="Standard" value={form.nabh_standard} onChange={e => setForm(f => ({ ...f, nabh_standard: e.target.value }))} />}</div>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Content</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-24 resize-none" value={form.content_html} onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))} placeholder="Document content (or upload file after creation)" /></div>
            <button onClick={handleCreate} disabled={!form.title} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create Document (v1 Draft)</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function DocumentsPage() { return <RoleGuard module="settings"><DocsInner /></RoleGuard>; }
