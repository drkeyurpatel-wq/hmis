'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEquipmentLifecycle, type Equipment, type MaintenanceLog } from '@/lib/equipment-lifecycle/equipment-lifecycle-hooks';

const STATUS_COLORS: Record<string, string> = { active: 'bg-green-100 text-green-700', maintenance: 'bg-amber-100 text-amber-700', condemned: 'bg-red-100 text-red-700', out_of_order: 'bg-red-100 text-red-700' };
const CRIT_COLORS: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' };
const SEV_COLORS: Record<string, string> = { critical: 'bg-red-600 text-white', high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' };
const MAINT_STATUS: Record<string, string> = { open: 'bg-red-100 text-red-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', pending_parts: 'bg-purple-100 text-purple-700' };
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n));

type Tab = 'equipment' | 'breakdowns' | 'alerts' | 'calibrations' | 'costs';

function Inner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const el = useEquipmentLifecycle(centreId);

  const [tab, setTab] = useState<Tab>('equipment');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);

  // Breakdown form
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [bf, setBf] = useState({ equipment_id: '', issue_description: '', severity: 'medium', patients_impacted: '0', patients_rescheduled: '0' });

  // Resolve form
  const [resolving, setResolving] = useState<MaintenanceLog | null>(null);
  const [rf, setRf] = useState({ resolution: '', cost: '0' });

  // Calibration form
  const [showCalib, setShowCalib] = useState(false);
  const [cf, setCf] = useState({ equipment_id: '', calibration_date: new Date().toISOString().split('T')[0], performed_by: '', vendor: '', certificate_number: '', result: 'pass', cost: '0' });

  const filtered = useMemo(() => {
    let list = el.equipment;
    if (catFilter !== 'all') list = list.filter(e => e.category === catFilter);
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    return list;
  }, [el.equipment, catFilter, statusFilter]);

  const categories = [...new Set(el.equipment.map(e => e.category))].sort();
  const totalAlerts = el.alerts.amcExpiring.length + el.alerts.calibDue.length + el.alerts.pmDue.length + el.alerts.slaBreach.length;

  const handleLogBreakdown = async () => {
    if (!bf.equipment_id || !bf.issue_description) { flash('Fill equipment and description'); return; }
    await el.logBreakdown({ ...bf, reported_by: staffId, patients_impacted: +bf.patients_impacted, patients_rescheduled: +bf.patients_rescheduled });
    flash('Breakdown logged — equipment set to maintenance');
    setShowBreakdown(false); setBf({ equipment_id: '', issue_description: '', severity: 'medium', patients_impacted: '0', patients_rescheduled: '0' });
    el.loadEquipment(); el.loadMaintenance();
  };

  const handleResolve = async () => {
    if (!resolving || !rf.resolution) return;
    await el.resolveMaintenance(resolving.id, { resolution: rf.resolution, cost: +rf.cost });
    flash('Resolved — equipment restored to active');
    setResolving(null); setRf({ resolution: '', cost: '0' });
    el.loadEquipment(); el.loadMaintenance();
  };

  const handleCalib = async () => {
    if (!cf.equipment_id || !cf.calibration_date) return;
    await el.logCalibration({ ...cf, cost: +cf.cost });
    flash('Calibration logged');
    setShowCalib(false); setCf({ equipment_id: '', calibration_date: new Date().toISOString().split('T')[0], performed_by: '', vendor: '', certificate_number: '', result: 'pass', cost: '0' });
    el.loadEquipment(); el.loadCalibrations();
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Equipment Lifecycle</h1>
        <div className="flex gap-1 flex-wrap">
          {(['equipment','breakdowns','alerts','calibrations','costs'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {t === 'equipment' ? 'Equipment' : t === 'breakdowns' ? 'Breakdowns' : t === 'alerts' ? `Alerts (${totalAlerts})` : t === 'calibrations' ? 'Calibrations' : 'Cost Analysis'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Equipment', value: el.equipment.length, color: 'text-gray-900' },
          { label: 'Active', value: el.equipment.filter(e => e.status === 'active').length, color: 'text-green-600' },
          { label: 'Under Maintenance', value: el.equipment.filter(e => e.status === 'maintenance').length, color: 'text-amber-600' },
          { label: 'Open Breakdowns', value: el.alerts.openBreakdowns.length, color: 'text-red-600' },
          { label: 'SLA Breaches', value: el.alerts.slaBreach.length, color: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Equipment Tab */}
      {tab === 'equipment' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            <select className="border rounded px-2 py-1.5 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="out_of_order">Out of Order</option>
            </select>
            <button onClick={() => setShowBreakdown(true)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium">+ Log Breakdown</button>
            <button onClick={() => setShowCalib(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium">+ Log Calibration</button>
          </div>

          {/* Breakdown form */}
          {showBreakdown && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Log Equipment Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <select className="border rounded px-2 py-1.5 text-sm" value={bf.equipment_id} onChange={e => setBf(p => ({ ...p, equipment_id: e.target.value }))}>
                  <option value="">Select equipment *</option>
                  {el.equipment.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name} ({e.category})</option>)}
                </select>
                <select className="border rounded px-2 py-1.5 text-sm" value={bf.severity} onChange={e => setBf(p => ({ ...p, severity: e.target.value }))}>
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" min="0" className="border rounded px-2 py-1.5 text-sm w-full" placeholder="Patients impacted" value={bf.patients_impacted} onChange={e => setBf(p => ({ ...p, patients_impacted: e.target.value }))} />
                  <input type="number" min="0" className="border rounded px-2 py-1.5 text-sm w-full" placeholder="Rescheduled" value={bf.patients_rescheduled} onChange={e => setBf(p => ({ ...p, patients_rescheduled: e.target.value }))} />
                </div>
              </div>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm mb-2" rows={2} placeholder="Issue description *" value={bf.issue_description} onChange={e => setBf(p => ({ ...p, issue_description: e.target.value }))} />
              <div className="flex gap-2">
                <button onClick={handleLogBreakdown} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm">Log Breakdown</button>
                <button onClick={() => setShowBreakdown(false)} className="text-sm text-gray-500">Cancel</button>
              </div>
            </div>
          )}

          {/* Calibration form */}
          {showCalib && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Log Calibration</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                <select className="border rounded px-2 py-1.5 text-sm" value={cf.equipment_id} onChange={e => setCf(p => ({ ...p, equipment_id: e.target.value }))}>
                  <option value="">Select equipment *</option>
                  {el.equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <input type="date" className="border rounded px-2 py-1.5 text-sm" value={cf.calibration_date} onChange={e => setCf(p => ({ ...p, calibration_date: e.target.value }))} />
                <select className="border rounded px-2 py-1.5 text-sm" value={cf.result} onChange={e => setCf(p => ({ ...p, result: e.target.value }))}>
                  <option value="pass">Pass</option><option value="fail">Fail</option><option value="conditional">Conditional</option>
                </select>
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Certificate #" value={cf.certificate_number} onChange={e => setCf(p => ({ ...p, certificate_number: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Performed by" value={cf.performed_by} onChange={e => setCf(p => ({ ...p, performed_by: e.target.value }))} />
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Vendor" value={cf.vendor} onChange={e => setCf(p => ({ ...p, vendor: e.target.value }))} />
                <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder="Cost ₹" value={cf.cost} onChange={e => setCf(p => ({ ...p, cost: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCalib} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">Save Calibration</button>
                <button onClick={() => setShowCalib(false)} className="text-sm text-gray-500">Cancel</button>
              </div>
            </div>
          )}

          {/* Equipment list */}
          <div className="overflow-x-auto bg-white border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">Equipment</th><th className="text-left p-3">Category</th><th className="text-left p-3">Location</th>
                <th className="text-center p-3">Status</th><th className="text-center p-3">Criticality</th>
                <th className="text-left p-3">AMC Expiry</th><th className="text-left p-3">Next PM</th><th className="text-right p-3">Downtime (hrs)</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEq(selectedEq?.id === e.id ? null : e)}>
                    <td className="p-3"><div className="font-medium">{e.name}</div><div className="text-xs text-gray-400">{e.brand} {e.model} · SN: {e.serial_number || '-'}</div></td>
                    <td className="p-3">{e.category}</td>
                    <td className="p-3 text-gray-600">{e.location || '-'}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[e.status]}`}>{e.status}</span></td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${CRIT_COLORS[e.criticality]}`}>{e.criticality}</span></td>
                    <td className="p-3">{e.amc_expiry || '-'} {e.amc_expiry && new Date(e.amc_expiry) < new Date() ? <span className="text-red-600 text-xs">EXPIRED</span> : ''}</td>
                    <td className="p-3">{e.next_pm_date || '-'}</td>
                    <td className="p-3 text-right font-mono">{e.total_downtime_hours || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded detail */}
          {selectedEq && (
            <div className="bg-white border rounded-lg p-4 mt-4">
              <h3 className="font-semibold mb-2">{selectedEq.name} — Cost of Ownership</h3>
              {(() => { const c = el.costOfOwnership(selectedEq); return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><div className="text-xs text-gray-400">Purchase</div><div className="font-bold">₹{fmt(c.purchase)}</div></div>
                  <div><div className="text-xs text-gray-400">Total AMC</div><div className="font-bold">₹{fmt(c.totalAmc)}</div></div>
                  <div><div className="text-xs text-gray-400">Repairs</div><div className="font-bold">₹{fmt(c.repairs)}</div></div>
                  <div><div className="text-xs text-gray-400">Total Ownership</div><div className="font-bold text-blue-700">₹{fmt(c.total)}</div></div>
                </div>
              ); })()}
            </div>
          )}
        </div>
      )}

      {/* Breakdowns Tab */}
      {tab === 'breakdowns' && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left p-3">Equipment</th><th className="text-left p-3">Issue</th><th className="text-center p-3">Severity</th>
              <th className="text-center p-3">Status</th><th className="text-left p-3">Reported</th><th className="text-center p-3">Patients</th>
              <th className="text-center p-3">SLA</th><th className="p-3">Action</th>
            </tr></thead>
            <tbody>
              {el.maintenance.filter(m => m.type === 'breakdown').map(m => {
                const hoursElapsed = Math.round((Date.now() - new Date(m.reported_at).getTime()) / 3600000);
                const slaBreach = m.sla_target_hours && hoursElapsed > m.sla_target_hours;
                return (
                  <tr key={m.id} className="border-t">
                    <td className="p-3 font-medium">{(m.equipment as any)?.name || '-'}</td>
                    <td className="p-3 max-w-[200px] truncate">{m.issue_description}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLORS[m.severity]}`}>{m.severity}</span></td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${MAINT_STATUS[m.status]}`}>{m.status}</span></td>
                    <td className="p-3 text-xs text-gray-500">{new Date(m.reported_at).toLocaleDateString()}<br />{m.status !== 'completed' ? `${hoursElapsed}h ago` : `${m.downtime_hours}h downtime`}</td>
                    <td className="p-3 text-center">{m.patients_impacted > 0 ? <span className="text-red-600">{m.patients_impacted} ({m.patients_rescheduled} resched)</span> : '-'}</td>
                    <td className="p-3 text-center">{m.status === 'completed' ? (m.sla_met ? <span className="text-green-600">Met ✓</span> : <span className="text-red-600">Breached</span>) : slaBreach ? <span className="text-red-600 font-bold">BREACH</span> : <span className="text-green-600">{m.sla_target_hours ? `${m.sla_target_hours - hoursElapsed}h left` : '-'}</span>}</td>
                    <td className="p-3">{m.status !== 'completed' && (
                      <button onClick={() => { setResolving(m); setRf({ resolution: '', cost: '0' }); }} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Resolve</button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {el.maintenance.filter(m => m.type === 'breakdown').length === 0 && <p className="p-4 text-gray-500 text-sm">No breakdown logs.</p>}
        </div>
      )}

      {/* Resolve modal */}
      {resolving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setResolving(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Resolve: {(resolving.equipment as any)?.name}</h3>
            <textarea className="w-full border rounded px-3 py-2 text-sm mb-2" rows={3} placeholder="Resolution *" value={rf.resolution} onChange={e => setRf(p => ({ ...p, resolution: e.target.value }))} />
            <input type="number" className="w-full border rounded px-3 py-2 text-sm mb-3" placeholder="Repair cost ₹" value={rf.cost} onChange={e => setRf(p => ({ ...p, cost: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={handleResolve} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Resolve</button>
              <button onClick={() => setResolving(null)} className="text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          {el.alerts.slaBreach.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-2">SLA Breaches ({el.alerts.slaBreach.length})</h3>
              {el.alerts.slaBreach.map(m => <div key={m.id} className="text-sm text-red-600">{(m.equipment as any)?.name} — {m.issue_description?.slice(0, 80)}</div>)}
            </div>
          )}
          {el.alerts.amcExpiring.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-amber-700 mb-2">AMC Expiring within 90 days ({el.alerts.amcExpiring.length})</h3>
              {el.alerts.amcExpiring.map(e => <div key={e.id} className="text-sm">{e.name} — expires {e.amc_expiry} ({e.amc_vendor})</div>)}
            </div>
          )}
          {el.alerts.calibDue.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-700 mb-2">Calibration Due within 30 days ({el.alerts.calibDue.length})</h3>
              {el.alerts.calibDue.map(e => <div key={e.id} className="text-sm">{e.name} — due {e.next_calibration_date}</div>)}
            </div>
          )}
          {el.alerts.pmDue.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-700 mb-2">Preventive Maintenance Due ({el.alerts.pmDue.length})</h3>
              {el.alerts.pmDue.map(e => <div key={e.id} className="text-sm">{e.name} — due {e.next_pm_date}</div>)}
            </div>
          )}
          {totalAlerts === 0 && <p className="text-green-600 text-sm">No active alerts ✓</p>}
        </div>
      )}

      {/* Calibrations Tab */}
      {tab === 'calibrations' && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left p-3">Equipment</th><th className="text-left p-3">Date</th><th className="text-center p-3">Result</th>
              <th className="text-left p-3">Certificate</th><th className="text-left p-3">Vendor</th><th className="text-left p-3">Next Due</th><th className="text-right p-3">Cost</th>
            </tr></thead>
            <tbody>
              {el.calibrations.map(c => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{el.equipment.find(e => e.id === c.equipment_id)?.name || '-'}</td>
                  <td className="p-3">{c.calibration_date}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.result === 'pass' ? 'bg-green-100 text-green-700' : c.result === 'fail' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.result}</span></td>
                  <td className="p-3">{c.certificate_number || '-'}</td>
                  <td className="p-3">{c.vendor || '-'}</td>
                  <td className="p-3">{c.next_due_date}</td>
                  <td className="p-3 text-right font-mono">₹{fmt(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {el.calibrations.length === 0 && <p className="p-4 text-gray-500 text-sm">No calibration records.</p>}
        </div>
      )}

      {/* Cost Analysis Tab */}
      {tab === 'costs' && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left p-3">Equipment</th><th className="text-right p-3">Purchase</th><th className="text-right p-3">AMC Total</th>
              <th className="text-right p-3">Repairs</th><th className="text-right p-3">Total Ownership</th><th className="text-right p-3">Downtime (hrs)</th>
            </tr></thead>
            <tbody>
              {el.equipment.sort((a, b) => el.costOfOwnership(b).total - el.costOfOwnership(a).total).map(e => {
                const c = el.costOfOwnership(e);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 font-medium">{e.name}<br /><span className="text-xs text-gray-400">{e.category} · {e.brand}</span></td>
                    <td className="p-3 text-right font-mono">₹{fmt(c.purchase)}</td>
                    <td className="p-3 text-right font-mono">₹{fmt(c.totalAmc)}</td>
                    <td className="p-3 text-right font-mono">₹{fmt(c.repairs)}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">₹{fmt(c.total)}</td>
                    <td className="p-3 text-right font-mono">{e.total_downtime_hours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function EquipmentLifecyclePage() {
  return <RoleGuard module="settings"><Inner /></RoleGuard>;
}
