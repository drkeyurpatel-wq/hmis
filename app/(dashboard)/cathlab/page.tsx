'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCathLab, useCathLabInventory, useCathLabMonitoring, type CathProcedure, type VesselFinding, type StentEntry } from '@/lib/cathlab/cathlab-hooks';
import { sb } from '@/lib/supabase/browser';

const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', abandoned: 'bg-red-100 text-red-700', complication: 'bg-red-100 text-red-700' };
const TYPE_COLORS: Record<string, string> = { cag: 'bg-blue-600', ptca: 'bg-red-600', pci: 'bg-red-600', ppi: 'bg-purple-600', icd: 'bg-purple-600', crt: 'bg-purple-600', ep_study: 'bg-indigo-600', tavi: 'bg-amber-600', bmc: 'bg-teal-600', structural: 'bg-orange-600' };
const VESSELS = ['LM', 'LAD', 'D1', 'D2', 'LCx', 'OM1', 'OM2', 'RCA', 'PDA', 'PLV'];
const SEGMENTS = ['proximal', 'mid', 'distal', 'ostial'];
const LESION_TYPES = ['discrete', 'tubular', 'diffuse', 'total_occlusion', 'bifurcation', 'calcified'];
const FLOW_GRADES = ['TIMI-0', 'TIMI-1', 'TIMI-2', 'TIMI-3'];
const STENT_TYPES = ['DES', 'BMS', 'DCB', 'SCUBA', 'BVS'];
const HEMOSTASIS = ['manual', 'tr_band', 'angioseal', 'perclose', 'mynx', 'femostop'];
const COMPLICATIONS = ['none', 'dissection', 'no_reflow', 'slow_flow', 'perforation', 'tamponade', 'arrhythmia', 'vascular_complication', 'hematoma', 'retroperitoneal_bleed', 'contrast_reaction', 'aki', 'stroke', 'death'];
const ITEM_TYPES = ['des', 'bms', 'dcb', 'balloon', 'guidewire', 'guiding_catheter', 'sheath', 'closure_device', 'pacemaker', 'icd', 'crt', 'ivus_catheter', 'ffr_wire', 'rotablator', 'other'];

type Tab = 'schedule' | 'inventory' | 'analytics';

function CathLabInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const cath = useCathLab(centreId);
  const inv = useCathLabInventory(centreId);

  const [tab, setTab] = useState<Tab>('schedule');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<CathProcedure | null>(null);
  const [detailTab, setDetailTab] = useState<'pre' | 'findings' | 'stents' | 'hemo' | 'post'>('findings');

  // Master data
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);

  useEffect(() => {
    if (!sb() || !centreId) return;
    sb()!.from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).order('full_name').then(({ data }: any) => setDoctors(data || []));
  }, [centreId]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,last_name.ilike.%${patSearch}%`).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => { cath.load(date); }, [date]);

  // Schedule form
  const [sf, setSf] = useState({ procedure_type: 'cag', procedure_name: '', indication: '', access_site: 'radial', primary_operator: '', secondary_operator: '', anesthetist_id: '', estimated_duration_min: '60', is_emergency: false, scheduled_time: '09:00' });

  const handleSchedule = async () => {
    if (!selPat || !sf.primary_operator) return;
    const res = await cath.schedule({
      patient_id: selPat.id, procedure_date: date, procedure_type: sf.procedure_type,
      procedure_name: sf.procedure_name, indication: sf.indication, access_site: sf.access_site,
      primary_operator: sf.primary_operator, secondary_operator: sf.secondary_operator || null,
      anesthetist_id: sf.anesthetist_id || null,
      estimated_duration_min: parseInt(sf.estimated_duration_min) || 60,
      is_emergency: sf.is_emergency, scheduled_time: sf.scheduled_time + ':00',
      priority: sf.is_emergency ? 'emergency' : 'elective',
    });
    if (res.success) { flash('Scheduled'); setShowNew(false); setSelPat(null); }
  };

  // Save procedure field
  const saveField = async (field: string, value: any) => {
    if (!selected) return;
    await cath.updateProcedure(selected.id, { [field]: value });
    setSelected(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Stent form
  const [stentForm, setStentForm] = useState({ vessel: '', type: 'DES', brand: '', size: '', serial: '' });

  const addStent = async () => {
    if (!selected || !stentForm.vessel) return;
    const updated = [...(selected.stents_placed || []), { ...stentForm }];
    await cath.updateProcedure(selected.id, { stents_placed: updated });
    setSelected(prev => prev ? { ...prev, stents_placed: updated } : null);
    setStentForm({ vessel: '', type: 'DES', brand: '', size: '', serial: '' });
    flash('Stent recorded');
  };

  // Vessel finding form
  const [vfForm, setVfForm] = useState<Partial<VesselFinding>>({ vessel: '', segment: 'mid', stenosis_pct: 0, type: 'discrete', calcification: 'none', thrombus: false, flow: 'TIMI-3', intervention: 'none' });

  const addVesselFinding = async () => {
    if (!selected || !vfForm.vessel) return;
    const updated = [...(selected.vessel_findings || []), vfForm as VesselFinding];
    await cath.updateProcedure(selected.id, { vessel_findings: updated });
    setSelected(prev => prev ? { ...prev, vessel_findings: updated } : null);
    setVfForm({ vessel: '', segment: 'mid', stenosis_pct: 0, type: 'discrete', calcification: 'none', thrombus: false, flow: 'TIMI-3', intervention: 'none' });
  };

  // Inventory form
  const [invForm, setInvForm] = useState({ item_type: 'des', brand: '', model: '', size: '', serial_number: '', lot_number: '', expiry_date: '', cost_price: '', mrp: '', vendor: '' });

  const cardiologists = useMemo(() => doctors.filter(d => d.specialisation?.toLowerCase().includes('cardio')), [doctors]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Cath Lab</h1><p className="text-xs text-gray-500">Cardiac catheterization, interventions, device implants</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ Schedule</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
        {[
          { l: 'Total', v: cath.stats.total }, { l: 'CAG', v: cath.stats.cag },
          { l: 'PCI/PTCA', v: cath.stats.ptca }, { l: 'Devices', v: cath.stats.device },
          { l: 'Emergency', v: cath.stats.emergency },
          { l: 'Stents', v: cath.stats.totalStents }, { l: 'Stent/PCI', v: cath.stats.avgStentsPerPTCA },
          { l: 'Avg Fluoro', v: cath.stats.avgFluoro ? cath.stats.avgFluoro + 'm' : '—' },
          { l: 'Avg Contrast', v: cath.stats.avgContrast ? cath.stats.avgContrast + 'ml' : '—' },
          { l: 'Complications', v: cath.stats.complicationRate + '%' },
        ].map(k => <div key={k.l} className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['schedule', 'inventory', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg capitalize ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'schedule' ? `Today (${cath.procedures.length})` : t === 'inventory' ? `Inventory (${inv.stockStats.total})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* ═══ SCHEDULE TAB ═══ */}
      {tab === 'schedule' && (cath.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        cath.procedures.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No procedures on {date}</div> :
        <div className="space-y-2">
          {cath.procedures.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer ${p.is_emergency ? 'border-l-4 border-l-red-500' : ''}`} onClick={() => { setSelected(p); setDetailTab('findings'); }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.scheduled_time && <span className="text-xs font-mono text-gray-500 w-14">{p.scheduled_time.slice(0, 5)}</span>}
                  <span className={`px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase ${TYPE_COLORS[p.procedure_type] || 'bg-gray-600'}`}>{p.procedure_type}</span>
                  <div>
                    <span className="font-medium text-sm">{p.patient_name}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{p.uhid} · {p.age}y {p.gender?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.stents_placed.length > 0 && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{p.stents_placed.length} stent{p.stents_placed.length > 1 ? 's' : ''}</span>}
                  {p.fluoroscopy_time_min && <span className="text-[9px] text-gray-400">{p.fluoroscopy_time_min}m fluoro</span>}
                  <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[p.procedure_status]}`}>{p.procedure_status.replace('_', ' ')}</span>
                  {p.procedure_status === 'scheduled' && <button onClick={e => { e.stopPropagation(); cath.startProcedure(p.id); flash('Started'); }} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-medium hover:bg-amber-200">Start</button>}
                  {p.procedure_status === 'in_progress' && <button onClick={e => { e.stopPropagation(); cath.completeProcedure(p.id); flash('Completed'); }} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium hover:bg-green-200">Complete</button>}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                <span>{p.procedure_name || p.indication || '—'}</span>
                <span>Access: {p.access_site}</span>
                <span>Op: {p.primary_operator_name}</span>
                {p.vessel_findings.length > 0 && <span className="text-red-600">{p.vessel_findings.map(v => `${v.vessel} ${v.stenosis_pct}%`).join(', ')}</span>}
                {p.complications.length > 0 && !p.complications.includes('none') && <span className="text-red-600 font-bold">⚠ {p.complications.join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ INVENTORY TAB ═══ */}
      {tab === 'inventory' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-sm font-bold">Add Stock</h3>
          <div className="grid grid-cols-5 gap-2">
            <div><label className="text-[9px] text-gray-500">Type</label><select value={invForm.item_type} onChange={e => setInvForm(f => ({...f, item_type: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Brand</label><input value={invForm.brand} onChange={e => setInvForm(f => ({...f, brand: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Abbott/Medtronic" /></div>
            <div><label className="text-[9px] text-gray-500">Size</label><input value={invForm.size} onChange={e => setInvForm(f => ({...f, size: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="3.0 x 38mm" /></div>
            <div><label className="text-[9px] text-gray-500">Serial #</label><input value={invForm.serial_number} onChange={e => setInvForm(f => ({...f, serial_number: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Lot #</label><input value={invForm.lot_number} onChange={e => setInvForm(f => ({...f, lot_number: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Expiry</label><input type="date" value={invForm.expiry_date} onChange={e => setInvForm(f => ({...f, expiry_date: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Cost ₹</label><input type="number" value={invForm.cost_price} onChange={e => setInvForm(f => ({...f, cost_price: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">MRP ₹</label><input type="number" value={invForm.mrp} onChange={e => setInvForm(f => ({...f, mrp: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Vendor</label><input value={invForm.vendor} onChange={e => setInvForm(f => ({...f, vendor: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div className="flex items-end"><button onClick={async () => {
              const res = await inv.addItem({ ...invForm, cost_price: parseFloat(invForm.cost_price) || 0, mrp: parseFloat(invForm.mrp) || 0 });
              if (res.success) flash('Added to stock');
            }} className="w-full py-1.5 bg-teal-600 text-white text-xs rounded font-medium">Add</button></div>
          </div>
        </div>
        {inv.items.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Type</th><th className="p-2">Brand</th><th className="p-2">Size</th>
            <th className="p-2">Serial</th><th className="p-2">Expiry</th><th className="p-2 text-right">Cost</th><th className="p-2">Status</th>
          </tr></thead><tbody>{inv.items.map(i => {
            const daysToExpiry = i.expiry_date ? Math.round((new Date(i.expiry_date).getTime() - Date.now()) / 86400000) : null;
            return (
              <tr key={i.id} className={`border-b ${daysToExpiry !== null && daysToExpiry < 90 ? 'bg-amber-50' : ''}`}>
                <td className="p-2 font-medium uppercase">{i.item_type.replace('_', ' ')}</td>
                <td className="p-2">{i.brand} {i.model}</td><td className="p-2">{i.size}</td>
                <td className="p-2 font-mono text-[10px]">{i.serial_number}</td>
                <td className="p-2">{i.expiry_date ? <span className={daysToExpiry !== null && daysToExpiry < 90 ? 'text-red-600 font-bold' : ''}>{new Date(i.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span> : '—'}</td>
                <td className="p-2 text-right">₹{Math.round(i.cost_price).toLocaleString('en-IN')}</td>
                <td className="p-2"><span className={`text-[9px] px-1.5 py-0.5 rounded ${i.status === 'in_stock' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{i.status}</span></td>
              </tr>
            );
          })}</tbody></table>
        </div>}
      </div>}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Procedure Mix</h3>
          {[['CAG', cath.stats.cag, 'bg-blue-500'], ['PCI/PTCA', cath.stats.ptca, 'bg-red-500'], ['Devices', cath.stats.device, 'bg-purple-500'], ['Emergency', cath.stats.emergency, 'bg-amber-500']].map(([label, val, color]) => (
            <div key={label as string} className="flex items-center gap-3">
              <span className="text-xs w-20">{label as string}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, ((val as number) / Math.max(1, cath.stats.total)) * 100)}%` }} /></div>
              <span className="text-xs font-bold w-8 text-right">{val as number}</span>
            </div>
          ))}
          <div className="pt-2 border-t text-xs text-gray-500">CAG→PCI conversion: <b>{cath.stats.conversionRate}%</b></div>
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Quality Metrics</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span>Avg fluoro time</span><b>{cath.stats.avgFluoro || '—'} min</b></div>
            <div className="flex justify-between"><span>Avg contrast volume</span><b>{cath.stats.avgContrast || '—'} ml</b></div>
            <div className="flex justify-between"><span>Stents per PCI</span><b>{cath.stats.avgStentsPerPTCA}</b></div>
            <div className="flex justify-between"><span>Complication rate</span><b className={parseFloat(cath.stats.complicationRate) > 5 ? 'text-red-600' : 'text-green-600'}>{cath.stats.complicationRate}%</b></div>
            <div className="flex justify-between"><span>Total stents deployed</span><b>{cath.stats.totalStents}</b></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 col-span-2">
          <h3 className="text-sm font-bold mb-3">Inventory Summary</h3>
          <div className="grid grid-cols-6 gap-3">
            {Object.entries(inv.stockStats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-[9px] text-gray-500 uppercase">{type.replace('_', ' ')}</div>
                <div className="text-lg font-bold">{count}</div>
              </div>
            ))}
          </div>
          {inv.stockStats.expiringSoon > 0 && <div className="mt-2 text-xs text-red-600">⚠ {inv.stockStats.expiringSoon} items expiring within 90 days</div>}
        </div>
      </div>}

      {/* ═══ SCHEDULE NEW MODAL ═══ */}
      {showNew && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
        <div className="bg-white rounded-xl w-[550px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Schedule Cath Lab Procedure</h3><button onClick={() => setShowNew(false)} className="text-gray-400 text-lg">×</button></div>

          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><span className="font-medium text-sm">{selPat.first_name} {selPat.last_name}</span><span className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}y {selPat.gender?.charAt(0)}</span><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}

          <div>
            <label className="text-[10px] text-gray-500">Procedure type</label>
            <div className="flex gap-1 mt-1 flex-wrap">{['cag', 'ptca', 'ppi', 'icd', 'crt', 'ep_study', 'tavi', 'structural'].map(t =>
              <button key={t} onClick={() => setSf(f => ({...f, procedure_type: t}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${sf.procedure_type === t ? TYPE_COLORS[t] + ' text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
            )}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-gray-500">Procedure name</label><input value={sf.procedure_name} onChange={e => setSf(f => ({...f, procedure_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="CAG + PTCA to LAD" /></div>
            <div><label className="text-[10px] text-gray-500">Indication</label><input value={sf.indication} onChange={e => setSf(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Unstable angina" /></div>
            <div><label className="text-[10px] text-gray-500">Access site</label><div className="flex gap-1 mt-1">{['radial', 'femoral', 'radial_femoral'].map(s => <button key={s} onClick={() => setSf(f => ({...f, access_site: s}))} className={`flex-1 py-1.5 rounded text-[10px] capitalize ${sf.access_site === s ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}>{s.replace('_', '+')}</button>)}</div></div>
            <div><label className="text-[10px] text-gray-500">Scheduled time</label><input type="time" value={sf.scheduled_time} onChange={e => setSf(f => ({...f, scheduled_time: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Primary operator *</label><select value={sf.primary_operator} onChange={e => setSf(f => ({...f, primary_operator: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>{cardiologists.length > 0 && <optgroup label="Cardiologists">{cardiologists.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</optgroup>}
              <optgroup label="All">{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</optgroup>
            </select></div>
            <div><label className="text-[10px] text-gray-500">Second operator</label><select value={sf.secondary_operator} onChange={e => setSf(f => ({...f, secondary_operator: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">None</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select></div>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sf.is_emergency} onChange={e => setSf(f => ({...f, is_emergency: e.target.checked}))} className="rounded" /> Emergency / Primary PCI</label>
          <button onClick={handleSchedule} disabled={!selPat || !sf.primary_operator} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Schedule</button>
        </div>
      </div>}

      {/* ═══ PROCEDURE DETAIL DRAWER ═══ */}
      {selected && <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
        <div className="w-[600px] bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase ${TYPE_COLORS[selected.procedure_type] || 'bg-gray-600'}`}>{selected.procedure_type}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[selected.procedure_status]}`}>{selected.procedure_status.replace('_', ' ')}</span>
              </div>
              <div className="font-bold text-lg mt-1">{selected.patient_name}</div>
              <div className="text-xs text-gray-500">{selected.uhid} · {selected.age}y {selected.gender?.charAt(0).toUpperCase()} · {selected.procedure_name || selected.indication}</div>
              <div className="text-xs text-gray-400 mt-0.5">Op: {selected.primary_operator_name}{selected.secondary_operator_name ? ` + ${selected.secondary_operator_name}` : ''} · Access: {selected.access_site}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
          </div>

          {/* Detail tabs */}
          <div className="flex gap-1 border-b pb-1">{(['pre', 'findings', 'stents', 'hemo', 'post'] as const).map(t =>
            <button key={t} onClick={() => setDetailTab(t)} className={`px-3 py-1.5 text-[10px] font-medium rounded-lg capitalize ${detailTab === t ? 'bg-teal-600 text-white' : 'bg-white border text-gray-500'}`}>{t === 'hemo' ? 'Hemodynamics' : t === 'pre' ? 'Pre-procedure' : t === 'post' ? 'Post-procedure' : t}</button>
          )}</div>

          {/* PRE-PROCEDURE */}
          {detailTab === 'pre' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Pre-procedure labs & checklist</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['pre_creatinine','Creatinine','mg/dL'],['pre_hb','Hb','g/dL'],['pre_platelet','Platelet','K'],['pre_inr','INR',''],['pre_echo_ef','Echo EF','%']].map(([key,label,unit]) => (
                <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                  <div className="relative"><input type="number" step="any" className="w-full px-2 py-1.5 border rounded text-xs pr-10" defaultValue={(selected as any)[key] || ''} onBlur={e => saveField(key, parseFloat(e.target.value) || null)} />
                    {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{unit}</span>}</div></div>
              ))}
            </div>
            <div><label className="text-[9px] text-gray-500">ECG findings</label>
              <input className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.pre_ecg_findings} onBlur={e => saveField('pre_ecg_findings', e.target.value)} placeholder="NSR / ST changes / etc." /></div>
            <div><label className="text-[9px] text-gray-500">Checklist</label>
              <div className="grid grid-cols-2 gap-1 mt-1">{['consent_signed', 'allergy_checked', 'iv_access', 'ecg_done', 'blood_grouped', 'anticoagulant_given'].map(k => {
                const checked = selected.pre_procedure_checklist?.[k] || false;
                return <label key={k} className="flex items-center gap-2 text-xs py-1 px-2 bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => {
                    const updated = { ...selected.pre_procedure_checklist, [k]: !checked };
                    saveField('pre_procedure_checklist', updated);
                  }} className="rounded" />{k.replace(/_/g, ' ')}</label>;
              })}</div>
            </div>
          </div>}

          {/* FINDINGS */}
          {detailTab === 'findings' && <div className="space-y-3">
            <div><label className="text-[9px] text-gray-500">CAG findings (free text)</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-16 resize-none" defaultValue={selected.cag_findings}
                onBlur={e => saveField('cag_findings', e.target.value)} placeholder="LM: Normal&#10;LAD: 90% mid stenosis&#10;LCx: Normal&#10;RCA: Dominant, 70% proximal" /></div>

            <h4 className="text-xs font-bold">Structured vessel findings ({selected.vessel_findings.length})</h4>
            {selected.vessel_findings.map((v, i) => (
              <div key={i} className="bg-red-50 rounded-lg p-2 text-xs flex items-center gap-2">
                <span className="font-bold text-red-700">{v.vessel}</span>
                <span>{v.segment} · {v.stenosis_pct}% · {v.type}</span>
                <span className="text-gray-400">Flow: {v.flow}</span>
                {v.intervention !== 'none' && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px]">{v.intervention}</span>}
              </div>
            ))}

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] text-gray-500">Vessel</label><select value={vfForm.vessel || ''} onChange={e => setVfForm(f => ({...f, vessel: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">Select</option>{VESSELS.map(v => <option key={v}>{v}</option>)}</select></div>
                <div><label className="text-[9px] text-gray-500">Segment</label><select value={vfForm.segment || ''} onChange={e => setVfForm(f => ({...f, segment: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{SEGMENTS.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="text-[9px] text-gray-500">Stenosis %</label><input type="number" min="0" max="100" value={vfForm.stenosis_pct || ''} onChange={e => setVfForm(f => ({...f, stenosis_pct: parseInt(e.target.value) || 0}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">Flow</label><select value={vfForm.flow || ''} onChange={e => setVfForm(f => ({...f, flow: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{FLOW_GRADES.map(f => <option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] text-gray-500">Lesion type</label><select value={vfForm.type || ''} onChange={e => setVfForm(f => ({...f, type: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{LESION_TYPES.map(t => <option key={t}>{t.replace('_', ' ')}</option>)}</select></div>
                <div><label className="text-[9px] text-gray-500">Calcification</label><select value={vfForm.calcification || ''} onChange={e => setVfForm(f => ({...f, calcification: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option>none</option><option>mild</option><option>moderate</option><option>severe</option></select></div>
                <div><label className="text-[9px] text-gray-500">Intervention</label><select value={vfForm.intervention || ''} onChange={e => setVfForm(f => ({...f, intervention: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="none">None</option><option value="ptca_des">PTCA+DES</option><option value="ptca_bms">PTCA+BMS</option><option value="ptca_dcb">PTCA+DCB</option><option value="plain_balloon">Plain balloon</option><option value="rotablation">Rotablation</option></select></div>
              </div>
              <button onClick={addVesselFinding} disabled={!vfForm.vessel} className="px-3 py-1.5 bg-red-600 text-white text-[10px] rounded font-medium disabled:opacity-40">+ Add finding</button>
            </div>

            {/* Radiation */}
            <h4 className="text-xs font-bold mt-3">Radiation & contrast</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[9px] text-gray-500">Fluoro (min)</label><input type="number" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.fluoroscopy_time_min || ''} onBlur={e => saveField('fluoroscopy_time_min', parseFloat(e.target.value) || null)} /></div>
              <div><label className="text-[9px] text-gray-500">Radiation (mGy)</label><input type="number" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.radiation_dose_mgy || ''} onBlur={e => saveField('radiation_dose_mgy', parseFloat(e.target.value) || null)} /></div>
              <div><label className="text-[9px] text-gray-500">Contrast (ml)</label><input type="number" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.contrast_volume_ml || ''} onBlur={e => saveField('contrast_volume_ml', parseInt(e.target.value) || null)} /></div>
            </div>

            {/* Complications */}
            <h4 className="text-xs font-bold">Complications</h4>
            <div className="flex gap-1 flex-wrap">{COMPLICATIONS.map(c =>
              <button key={c} onClick={() => {
                const current = selected.complications || [];
                const updated = c === 'none' ? ['none'] : current.filter(x => x !== 'none').includes(c) ? current.filter(x => x !== c) : [...current.filter(x => x !== 'none'), c];
                saveField('complications', updated);
              }} className={`px-2 py-1 rounded text-[9px] capitalize ${(selected.complications || []).includes(c) ? (c === 'none' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{c.replace('_', ' ')}</button>
            )}</div>
          </div>}

          {/* STENTS */}
          {detailTab === 'stents' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Stents placed ({selected.stents_placed.length})</h4>
            {selected.stents_placed.map((s, i) => (
              <div key={i} className="bg-red-50 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2"><span className="font-bold text-red-700">{s.vessel}</span><span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px]">{s.type}</span><span>{s.brand}</span><span className="text-gray-500">{s.size}</span><span className="ml-auto text-gray-400">S/N: {s.serial}</span></div>
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-5 gap-2">
              <div><label className="text-[9px] text-gray-500">Vessel</label><select value={stentForm.vessel} onChange={e => setStentForm(f => ({...f, vessel: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">Select</option>{VESSELS.map(v => <option key={v}>{v}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Type</label><select value={stentForm.type} onChange={e => setStentForm(f => ({...f, type: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{STENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Brand</label><input value={stentForm.brand} onChange={e => setStentForm(f => ({...f, brand: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="Xience/Orsiro" /></div>
              <div><label className="text-[9px] text-gray-500">Size</label><input value={stentForm.size} onChange={e => setStentForm(f => ({...f, size: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="3.0×38" /></div>
              <div className="flex items-end"><button onClick={addStent} disabled={!stentForm.vessel} className="w-full py-1 bg-red-600 text-white text-[10px] rounded font-bold disabled:opacity-40">+ Stent</button></div>
            </div>
            <div><label className="text-[9px] text-gray-500">Serial number</label><input value={stentForm.serial} onChange={e => setStentForm(f => ({...f, serial: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Stent serial / lot number" /></div>
          </div>}

          {/* HEMODYNAMICS */}
          {detailTab === 'hemo' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Hemodynamic measurements</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['ao_systolic','Ao Systolic','mmHg'],['ao_diastolic','Ao Diastolic','mmHg'],['lv_systolic','LV Systolic','mmHg'],['lvedp','LVEDP','mmHg'],['ra_mean','RA Mean','mmHg'],['rv_systolic','RV Systolic','mmHg'],['pa_systolic','PA Systolic','mmHg'],['pa_diastolic','PA Diastolic','mmHg'],['pcwp','PCWP','mmHg'],['cardiac_output','CO','L/min'],['cardiac_index','CI','L/min/m²'],['qp_qs','Qp:Qs','']].map(([key,label,unit]) => (
                <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                  <div className="relative"><input type="number" step="any" className="w-full px-2 py-1.5 border rounded text-xs pr-12" defaultValue={selected.hemodynamics?.[key] || ''}
                    onBlur={e => { const h = { ...selected.hemodynamics, [key]: parseFloat(e.target.value) || null }; saveField('hemodynamics', h); }} />
                    {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{unit}</span>}</div></div>
              ))}
            </div>
            <h4 className="text-xs font-bold mt-3">Imaging used</h4>
            <div className="flex gap-1">{['IVUS', 'OCT', 'FFR', 'iFR', 'Angioscopy'].map(im =>
              <button key={im} onClick={() => {
                const current = selected.imaging_used || [];
                const updated = current.includes(im) ? current.filter(x => x !== im) : [...current, im];
                saveField('imaging_used', updated);
              }} className={`px-3 py-1.5 rounded text-[10px] font-medium ${(selected.imaging_used || []).includes(im) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{im}</button>
            )}</div>
          </div>}

          {/* POST-PROCEDURE */}
          {detailTab === 'post' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Post-procedure</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[9px] text-gray-500">Sheath removal time</label><input type="datetime-local" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.sheath_removal_time?.slice(0, 16) || ''} onBlur={e => saveField('sheath_removal_time', e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
              <div><label className="text-[9px] text-gray-500">Hemostasis method</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.hemostasis_method} onChange={e => saveField('hemostasis_method', e.target.value)}>
                <option value="">Select</option>{HEMOSTASIS.map(h => <option key={h}>{h.replace('_', ' ')}</option>)}</select></div>
            </div>
            <div><label className="text-[9px] text-gray-500">Post-procedure notes</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-20 resize-none" defaultValue={selected.post_procedure_notes} onBlur={e => saveField('post_procedure_notes', e.target.value)} placeholder="Access site ok, pulse present, no hematoma..." /></div>
            <div><label className="text-[9px] text-gray-500">Outcome</label><div className="flex gap-1">{['success', 'partial', 'failed', 'abandoned'].map(o =>
              <button key={o} onClick={() => saveField('outcome', o)} className={`flex-1 py-1.5 rounded text-[10px] font-medium capitalize ${selected.outcome === o ? (o === 'success' ? 'bg-green-600 text-white' : o === 'failed' || o === 'abandoned' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white') : 'bg-gray-100 text-gray-500'}`}>{o}</button>
            )}</div></div>
          </div>}
        </div>
      </div>}
    </div>
  );
}

export default function CathLabPage() { return <RoleGuard module="ot"><CathLabInner /></RoleGuard>; }
