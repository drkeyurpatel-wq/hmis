// HEALTH1 HMIS — RATE CARD & SERVICE MASTER SETUP
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Search, Edit2, Trash2, Save, X, Upload, Download, Settings, IndianRupee, Tag, Package, Bed, Filter, ChevronDown, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import type { ServiceMaster, ServiceCategory, PayorType, BillingPackage, BedChargeRule } from '@/lib/billing/billing-v2-types';
import { SERVICE_CATEGORY_LABELS, PAYOR_TYPE_LABELS } from '@/lib/billing/billing-v2-types';

type SettingsTab = 'services' | 'rate_cards' | 'packages' | 'bed_charges' | 'discounts';

function ServiceFormModal({ isOpen, onClose, onSave, editingService, centreId }: { isOpen: boolean; onClose: () => void; onSave: (data: any) => void; editingService: ServiceMaster | null; centreId: string }) {
  const [form, setForm] = useState({ service_code: '', service_name: '', department: '', service_category: 'CONSULTATION' as ServiceCategory, base_rate: 0, gst_applicable: false, gst_percentage: 0, hsn_sac_code: '', is_payable_to_doctor: true, doctor_payout_type: '' });
  useEffect(() => {
    if (editingService) setForm({ service_code: editingService.service_code, service_name: editingService.service_name, department: editingService.department, service_category: editingService.service_category, base_rate: editingService.base_rate, gst_applicable: editingService.gst_applicable, gst_percentage: editingService.gst_percentage, hsn_sac_code: editingService.hsn_sac_code || '', is_payable_to_doctor: editingService.is_payable_to_doctor, doctor_payout_type: editingService.doctor_payout_type || '' });
    else setForm({ service_code: '', service_name: '', department: '', service_category: 'CONSULTATION', base_rate: 0, gst_applicable: false, gst_percentage: 0, hsn_sac_code: '', is_payable_to_doctor: true, doctor_payout_type: '' });
  }, [editingService, isOpen]);
  if (!isOpen) return null;
  const departments = ['OPD','IPD','ER','ICU','OT','LAB','RADIOLOGY','PHARMACY','PHYSIOTHERAPY','DIET','NURSING','BLOOD_BANK','DAYCARE','CATHLAB'];
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
    <div className="flex items-center justify-between border-b px-5 py-4 sticky top-0 bg-white"><h3 className="font-semibold text-gray-900">{editingService ? 'Edit Service' : 'Add New Service'}</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Service Code *</label><input type="text" value={form.service_code} onChange={(e) => setForm({...form, service_code: e.target.value.toUpperCase()})} placeholder="e.g., CONS-GEN" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Service Name *</label><input type="text" value={form.service_name} onChange={(e) => setForm({...form, service_name: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div></div>
      <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Department *</label><select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30"><option value="">— Select —</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Category *</label><select value={form.service_category} onChange={(e) => setForm({...form, service_category: e.target.value as ServiceCategory})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30">{Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
      <div className="grid grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Base Rate *</label><input type="number" min={0} step={0.01} value={form.base_rate} onChange={(e) => setForm({...form, base_rate: Number(e.target.value)})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">GST %</label><div className="flex items-center gap-2"><input type="checkbox" checked={form.gst_applicable} onChange={(e) => setForm({...form, gst_applicable: e.target.checked})} className="rounded border-gray-300 text-[#00B4D8]" /><input type="number" min={0} max={28} value={form.gst_percentage} onChange={(e) => setForm({...form, gst_percentage: Number(e.target.value)})} disabled={!form.gst_applicable} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono disabled:opacity-40 focus:outline-none" /></div></div><div><label className="block text-xs font-medium text-gray-600 mb-1">HSN/SAC</label><input type="text" value={form.hsn_sac_code} onChange={(e) => setForm({...form, hsn_sac_code: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none" /></div></div>
      <div className="grid grid-cols-2 gap-4"><div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_payable_to_doctor} onChange={(e) => setForm({...form, is_payable_to_doctor: e.target.checked})} className="rounded border-gray-300 text-[#00B4D8]" /><span className="text-sm text-gray-700">Payable to Doctor (MedPay)</span></label></div>{form.is_payable_to_doctor && <div><label className="block text-xs font-medium text-gray-600 mb-1">Payout Type</label><select value={form.doctor_payout_type} onChange={(e) => setForm({...form, doctor_payout_type: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"><option value="">— Default —</option><option value="FFS">FFS</option><option value="MGM">MGM</option><option value="FIXED">Fixed</option><option value="RETAINER">Retainer</option></select></div>}</div>
    </div>
    <div className="border-t px-5 py-3 flex items-center justify-end gap-2 sticky bottom-0 bg-white"><button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={() => onSave({...form, centre_id: centreId, id: editingService?.id})} disabled={!form.service_code || !form.service_name || !form.department} className="rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90 disabled:opacity-40"><Save className="h-3.5 w-3.5 inline mr-1" />{editingService ? 'Update' : 'Create'} Service</button></div>
  </div></div>);
}

export default function RateCardSetupPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('services');
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceMaster | null>(null);
  const centreId = 'CURRENT_CENTRE_ID';

  const loadServices = useCallback(async () => { setLoading(true); try { const res = await fetch(`/api/billing/settings/services?centre_id=${centreId}`); if (res.ok) setServices(await res.json()); } catch {} setLoading(false); }, [centreId, searchTerm, filterDept, filterCategory]);
  useEffect(() => { loadServices(); }, [loadServices]);

  const handleSaveService = async (data: any) => { try { const method = data.id ? 'PUT' : 'POST'; const url = data.id ? `/api/billing/settings/services/${data.id}` : '/api/billing/settings/services'; const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (res.ok) { setShowForm(false); setEditingService(null); await loadServices(); } } catch (err: any) { alert(`Failed: ${err.message}`); } };

  const filteredServices = services.filter(s => { if (searchTerm && !s.service_name.toLowerCase().includes(searchTerm.toLowerCase()) && !s.service_code.toLowerCase().includes(searchTerm.toLowerCase())) return false; if (filterDept && s.department !== filterDept) return false; if (filterCategory && s.service_category !== filterCategory) return false; return true; });
  const departments = [...new Set(services.map(s => s.department))].sort();
  const tabs: Array<{id: SettingsTab; label: string; icon: any}> = [{id:'services',label:'Service Master',icon:Tag},{id:'rate_cards',label:'Rate Cards',icon:IndianRupee},{id:'packages',label:'Packages',icon:Package},{id:'bed_charges',label:'Bed Charges',icon:Bed},{id:'discounts',label:'Discount Schemes',icon:Tag}];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button><div><h1 className="text-lg font-bold text-[#0A2540] flex items-center gap-2"><Settings className="h-5 w-5 text-gray-400" /> Billing Settings</h1><p className="text-xs text-gray-500">Service masters, rate cards, packages, bed charges</p></div></div>
          <div className="flex items-center gap-2"><button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><Download className="h-4 w-4" /> Export</button><button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><Upload className="h-4 w-4" /> Import CSV</button><button onClick={() => { setEditingService(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90"><Plus className="h-4 w-4" /> Add Service</button></div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">{tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon className="h-3.5 w-3.5" /> {tab.label}</button>)}</div>

        {activeTab === 'services' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search services..." className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"><option value="">All Departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"><option value="">All Categories</option>{Object.entries(SERVICE_CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
              <span className="text-xs text-gray-500 font-mono">{filteredServices.length} services</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full"><thead><tr className="bg-gray-50/80"><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Code</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Service Name</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Department</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Category</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Base Rate</th><th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">GST</th><th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">MedPay</th><th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">Status</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Actions</th></tr></thead>
              <tbody>
                {filteredServices.map(svc => <tr key={svc.id} className="border-b border-gray-50 hover:bg-gray-50/50"><td className="px-4 py-2.5"><span className="text-xs font-mono text-gray-600">{svc.service_code}</span></td><td className="px-4 py-2.5"><span className="text-sm font-medium text-gray-900">{svc.service_name}</span></td><td className="px-4 py-2.5"><span className="text-xs text-gray-600">{svc.department}</span></td><td className="px-4 py-2.5"><span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{SERVICE_CATEGORY_LABELS[svc.service_category] || svc.service_category}</span></td><td className="px-4 py-2.5 text-right"><span className="text-sm font-mono font-semibold text-gray-900">₹{svc.base_rate.toLocaleString('en-IN')}</span></td><td className="px-4 py-2.5 text-center">{svc.gst_applicable ? <span className="text-[10px] font-medium text-blue-600">{svc.gst_percentage}%</span> : <span className="text-[10px] text-gray-400">—</span>}</td><td className="px-4 py-2.5 text-center">{svc.is_payable_to_doctor ? <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <X className="h-3.5 w-3.5 text-gray-300 mx-auto" />}</td><td className="px-4 py-2.5 text-center"><span className={`text-[10px] font-medium px-2 py-0.5 rounded ${svc.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{svc.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-2.5 text-right"><button onClick={() => { setEditingService(svc); setShowForm(true); }} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button></td></tr>)}
                {filteredServices.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">{loading ? 'Loading...' : 'No services found.'}</td></tr>}
              </tbody></table>
            </div>
          </div>
        )}
        {activeTab === 'rate_cards' && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><IndianRupee className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-sm font-medium">Payor-Specific Rate Cards</p><p className="text-xs mt-1">Set different rates for PMJAY, CGHS, TPA, Corporate payors.</p><button onClick={() => setActiveTab('services')} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white">Set Up Services First</button></div>}
        {activeTab === 'packages' && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><Package className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-sm font-medium">Package Management</p><p className="text-xs mt-1">Create surgical, medical, PMJAY, daycare, health checkup packages.</p></div>}
        {activeTab === 'bed_charges' && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><Bed className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-sm font-medium">Bed Charge Rules</p><p className="text-xs mt-1">Configure per-day charges by room category and ward type.</p></div>}
        {activeTab === 'discounts' && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><Tag className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-sm font-medium">Discount Schemes</p><p className="text-xs mt-1">Staff discounts, senior citizen, BPL, referral, loyalty programs.</p></div>}
      </div>
      <ServiceFormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditingService(null); }} onSave={handleSaveService} editingService={editingService} centreId={centreId} />
    </div>
  );
}
