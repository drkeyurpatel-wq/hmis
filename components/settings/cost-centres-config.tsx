'use client';
import React, { useState } from 'react';
import { useCostCentres, type CostCentre, type CostCentreMap } from '@/lib/billing/cost-centre-hooks';

interface Props { centreId: string; flash: (m: string) => void; }

const CC_TYPES: { value: CostCentre['type']; label: string; color: string }[] = [
  { value: 'revenue', label: 'Revenue', color: 'bg-green-100 text-green-700' },
  { value: 'expense', label: 'Expense', color: 'bg-red-100 text-red-700' },
  { value: 'overhead', label: 'Overhead', color: 'bg-amber-100 text-amber-700' },
  { value: 'shared', label: 'Shared', color: 'bg-blue-100 text-blue-700' },
];

const MATCH_TYPES = [
  { value: 'department', label: 'Department Name' },
  { value: 'tariff_category', label: 'Tariff Category' },
  { value: 'bill_type', label: 'Bill Type' },
];

const TARIFF_CATS = ['consultation','room_rent','ot_charges','professional_fee','icu_charges','nursing','procedure','consumable','miscellaneous'];
const BILL_TYPES = ['opd','ipd','pharmacy','lab','radiology','package'];

export default function CostCentresConfig({ centreId, flash }: Props) {
  const { costCentres, maps, loading, saveCostCentre, toggleActive, saveMap, deleteMap } = useCostCentres(centreId);
  const [tab, setTab] = useState<'centres'|'maps'>('centres');

  // Cost Centre form
  const [showCCForm, setShowCCForm] = useState(false);
  const [editCCId, setEditCCId] = useState<string | null>(null);
  const [ccForm, setCCForm] = useState({ name: '', code: '', type: 'revenue' as CostCentre['type'], budget_monthly: 0 });

  // Map form
  const [showMapForm, setShowMapForm] = useState(false);
  const [mapForm, setMapForm] = useState({ cost_centre_id: '', match_type: 'department' as CostCentreMap['match_type'], match_value: '', priority: 0 });

  const resetCC = () => { setCCForm({ name: '', code: '', type: 'revenue', budget_monthly: 0 }); setShowCCForm(false); setEditCCId(null); };
  const resetMap = () => { setMapForm({ cost_centre_id: '', match_type: 'department', match_value: '', priority: 0 }); setShowMapForm(false); };

  const handleSaveCC = async () => {
    if (!ccForm.name.trim()) { flash('Name is required'); return; }
    const code = ccForm.code || ccForm.name.substring(0, 6).toUpperCase().replace(/\s/g, '');
    const result = await saveCostCentre({ ...ccForm, code, id: editCCId || undefined });
    if (result.error) flash(`Error: ${result.error}`);
    else flash(editCCId ? 'Cost centre updated' : 'Cost centre added');
    resetCC();
  };

  const handleSaveMap = async () => {
    if (!mapForm.cost_centre_id || !mapForm.match_value) { flash('All fields required'); return; }
    const result = await saveMap(mapForm);
    if (result.error) flash(`Error: ${result.error}`);
    else flash('Mapping rule added');
    resetMap();
  };

  const startEditCC = (cc: CostCentre) => {
    setEditCCId(cc.id);
    setCCForm({ name: cc.name, code: cc.code, type: cc.type, budget_monthly: cc.budget_monthly });
    setShowCCForm(true);
  };

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  const activeCC = costCentres.filter(c => c.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Cost Centres ({costCentres.length})</h3>
          <p className="text-[10px] text-gray-500">Define cost centres and map them to departments/services for live P&L tracking</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('centres')} className={`px-3 py-1 text-[10px] font-medium rounded-md ${tab === 'centres' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>Centres</button>
            <button onClick={() => setTab('maps')} className={`px-3 py-1 text-[10px] font-medium rounded-md ${tab === 'maps' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>Mappings ({maps.length})</button>
          </div>
          {tab === 'centres' && <button onClick={() => { resetCC(); setShowCCForm(true); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ Add Cost Centre</button>}
          {tab === 'maps' && <button onClick={() => { resetMap(); setShowMapForm(true); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ Add Mapping</button>}
        </div>
      </div>

      {/* Cost Centre Form */}
      {tab === 'centres' && showCCForm && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
          <h4 className="font-bold text-xs text-blue-700">{editCCId ? 'Edit Cost Centre' : 'New Cost Centre'}</h4>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-[10px] text-gray-500 font-medium">Name *</label>
              <input value={ccForm.name} onChange={e => setCCForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Cardiology Dept" autoFocus /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Code</label>
              <input value={ccForm.code} onChange={e => setCCForm(f => ({ ...f, code: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Auto if blank" /></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Type</label>
              <select value={ccForm.type} onChange={e => setCCForm(f => ({ ...f, type: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {CC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Monthly Budget (Rs.)</label>
              <input type="number" value={ccForm.budget_monthly || ''} onChange={e => setCCForm(f => ({ ...f, budget_monthly: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveCC} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{editCCId ? 'Update' : 'Add'}</button>
            <button onClick={resetCC} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg border">Cancel</button>
          </div>
        </div>
      )}

      {/* Mapping Form */}
      {tab === 'maps' && showMapForm && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
          <h4 className="font-bold text-xs text-blue-700">New Mapping Rule</h4>
          <p className="text-[10px] text-gray-500">Map a department, tariff category, or bill type to a cost centre. Higher priority wins when multiple rules match.</p>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-[10px] text-gray-500 font-medium">Cost Centre *</label>
              <select value={mapForm.cost_centre_id} onChange={e => setMapForm(f => ({ ...f, cost_centre_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>
                {activeCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Match Type *</label>
              <select value={mapForm.match_type} onChange={e => setMapForm(f => ({ ...f, match_type: e.target.value as any, match_value: '' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {MATCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500 font-medium">Match Value *</label>
              {mapForm.match_type === 'tariff_category' ? (
                <select value={mapForm.match_value} onChange={e => setMapForm(f => ({ ...f, match_value: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>
                  {TARIFF_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              ) : mapForm.match_type === 'bill_type' ? (
                <select value={mapForm.match_value} onChange={e => setMapForm(f => ({ ...f, match_value: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>
                  {BILL_TYPES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              ) : (
                <input value={mapForm.match_value} onChange={e => setMapForm(f => ({ ...f, match_value: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Cardiology" />
              )}
            </div>
            <div><label className="text-[10px] text-gray-500 font-medium">Priority</label>
              <input type="number" value={mapForm.priority} onChange={e => setMapForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveMap} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Add Rule</button>
            <button onClick={resetMap} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg border">Cancel</button>
          </div>
        </div>
      )}

      {/* Cost Centre List */}
      {tab === 'centres' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-3 text-left font-medium">Cost Centre</th>
              <th className="p-3 text-center font-medium">Code</th>
              <th className="p-3 text-center font-medium">Type</th>
              <th className="p-3 text-right font-medium">Budget/mo</th>
              <th className="p-3 text-center font-medium">Mappings</th>
              <th className="p-3 text-center font-medium">Status</th>
              <th className="p-3 text-center font-medium">Actions</th>
            </tr></thead>
            <tbody>{costCentres.map(cc => {
              const mapCount = maps.filter(m => m.cost_centre_id === cc.id).length;
              const typeInfo = CC_TYPES.find(t => t.value === cc.type);
              return (
                <tr key={cc.id} className={`border-b hover:bg-gray-50 ${!cc.is_active ? 'opacity-40' : ''}`}>
                  <td className="p-3 font-medium">{cc.name}</td>
                  <td className="p-3 text-center font-mono text-gray-500">{cc.code}</td>
                  <td className="p-3 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${typeInfo?.color || 'bg-gray-100'}`}>{typeInfo?.label || cc.type}</span></td>
                  <td className="p-3 text-right text-gray-600">{cc.budget_monthly > 0 ? `Rs.${Math.round(cc.budget_monthly).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="p-3 text-center">{mapCount > 0 ? <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[9px]">{mapCount} rules</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleActive(cc.id, !cc.is_active)} className={`w-9 h-5 rounded-full relative ${cc.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${cc.is_active ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => startEditCC(cc)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border hover:bg-gray-200">Edit</button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {costCentres.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No cost centres. Add one above to start P&L tracking.</div>}
        </div>
      )}

      {/* Mapping List */}
      {tab === 'maps' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-3 text-left font-medium">Cost Centre</th>
              <th className="p-3 text-center font-medium">Match Type</th>
              <th className="p-3 text-center font-medium">Match Value</th>
              <th className="p-3 text-center font-medium">Priority</th>
              <th className="p-3 text-center font-medium">Actions</th>
            </tr></thead>
            <tbody>{maps.map(m => (
              <tr key={m.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{m.cost_centre?.code} — {m.cost_centre?.name}</td>
                <td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px]">{m.match_type.replace('_', ' ')}</span></td>
                <td className="p-3 text-center font-mono text-gray-600">{m.match_value}</td>
                <td className="p-3 text-center">{m.priority}</td>
                <td className="p-3 text-center">
                  <button onClick={() => deleteMap(m.id)} className="px-2 py-0.5 text-red-500 text-[10px] hover:text-red-700">Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {maps.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No mapping rules. Add rules to auto-assign cost centres during billing.</div>}
        </div>
      )}

      {/* Quick tips */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h4 className="font-bold text-xs text-gray-700 mb-2">How it works</h4>
        <ul className="text-[10px] text-gray-500 space-y-1">
          <li>1. Create cost centres for each revenue/expense unit (e.g. Cardiology, ICU, Lab, Pharmacy)</li>
          <li>2. Add mapping rules to auto-tag bill items by department, tariff category, or bill type</li>
          <li>3. Log expenses against cost centres (salaries, consumables, rent, etc.)</li>
          <li>4. View live P&L at <span className="font-mono bg-gray-200 px-1 rounded">/pnl</span> — revenue vs expense by cost centre</li>
        </ul>
      </div>
    </div>
  );
}
