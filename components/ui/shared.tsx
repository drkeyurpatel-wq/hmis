// components/ui/shared.tsx
// Shared UI primitives used across all modules

'use client';
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';

// ============================================================
// LOADING SKELETON
// ============================================================
export function Skeleton({ className = '', rows = 1 }: { className?: string; rows?: number }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="bg-gray-50 p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => <div key={i} className="h-3 bg-gray-200 rounded flex-1 animate-pulse" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-3 flex gap-4 border-t">
          {Array.from({ length: cols }).map((_, c) => <div key={c} className="h-3 bg-gray-100 rounded flex-1 animate-pulse" />)}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4 mb-6`}>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================
export function EmptyState({ icon, title, description, action, onAction }: {
  icon?: string; title: string; description?: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="text-center py-12 bg-white rounded-xl border">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      {action && onAction && (
        <button onClick={onAction} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">{action}</button>
      )}
    </div>
  );
}

// ============================================================
// TOAST SYSTEM
// ============================================================
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast { id: string; message: string; type: ToastType; }

const ToastContext = createContext<{
  toast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
}>({ toast: () => {}, toasts: [] });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-600 text-white',
  };

  return (
    <ToastContext.Provider value={{ toast: addToast, toasts }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium max-w-sm animate-slide-in`}>
            {t.type === 'error' && '✕ '}{t.type === 'warning' && '⚠ '}{t.type === 'success' && '✓ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ============================================================
// ROLE GUARD
// ============================================================
// ============================================================
// MODULE ACCESS — now reads from DB role permissions
// Falls back to staff_type for backward compatibility
// ============================================================
const STAFF_TYPE_FALLBACK: Record<string, string[]> = {
  dashboard: ['doctor', 'nurse', 'admin', 'receptionist', 'pharmacist', 'lab_tech', 'accountant', 'support', 'technician'],
  patients: ['doctor', 'nurse', 'admin', 'receptionist', 'support'],
  opd: ['doctor', 'nurse', 'admin', 'receptionist'],
  emr: ['doctor', 'nurse'], 'emr-v2': ['doctor', 'nurse'],
  billing: ['admin', 'receptionist', 'accountant'],
  pharmacy: ['pharmacist', 'admin', 'doctor'],
  lab: ['lab_tech', 'admin', 'doctor', 'nurse'],
  ipd: ['doctor', 'nurse', 'admin'],
  ot: ['doctor', 'nurse', 'admin'],
  radiology: ['technician', 'admin', 'doctor'],
  reports: ['admin', 'doctor', 'accountant'],
  settings: ['admin'], quality: ['admin', 'doctor', 'nurse'],
  mis: ['admin', 'doctor', 'accountant'],
};

export function RoleGuard({ module, children, fallback }: {
  module: string; children: React.ReactNode; fallback?: React.ReactNode;
}) {
  const { staff, hasPermission } = useAuthStore();
  const staffType = staff?.staff_type || '';

  // Super admin always has access
  if (staffType === 'admin') return <>{children}</>;

  // Check DB role permissions first
  if (hasPermission(module, 'view')) return <>{children}</>;

  // Fallback: check staff_type (backward compat when roles not yet assigned)
  const allowed = STAFF_TYPE_FALLBACK[module] || [];
  if (allowed.includes(staffType)) return <>{children}</>;

  return fallback ? <>{fallback}</> : (
    <div className="text-center py-20">
      <div className="text-4xl mb-3">🔒</div>
      <h2 className="text-lg font-semibold text-gray-900">Access restricted</h2>
      <p className="text-sm text-gray-500 mt-1">You don't have permission to access the {module} module.</p>
      <p className="text-xs text-gray-400 mt-2">Contact admin to request access.</p>
    </div>
  );
}

export function useHasAccess(module: string): boolean {
  const { staff, hasPermission } = useAuthStore();
  const staffType = staff?.staff_type || '';
  if (staffType === 'admin') return true;
  if (hasPermission(module, 'view')) return true;
  return (STAFF_TYPE_FALLBACK[module] || []).includes(staffType);
}

// ============================================================
// CONFIRMATION MODAL
// ============================================================
export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  confirmColor = 'bg-blue-600 hover:bg-blue-700', onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string;
  confirmColor?: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className={`flex-1 px-4 py-2 text-white text-sm rounded-lg ${confirmColor}`}>{confirmLabel}</button>
          <button onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================
export function StatCard({ label, value, sub, color = 'bg-gray-50', href }: {
  label: string; value: string | number; sub?: string; color?: string; href?: string;
}) {
  const inner = (
    <div className={`${color} rounded-xl p-4 ${href ? 'hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer' : ''}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

// ============================================================
// SEARCH INPUT
// ============================================================
export function SearchInput({ placeholder, value, onChange, onClear, className = '' }: {
  placeholder: string; value: string; onChange: (v: string) => void; onClear?: () => void; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {value && onClear && (
        <button onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

// ============================================================
// BADGE
// ============================================================
export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) {
  const colors: Record<string, string> = {
    // Generic
    active: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800', pending: 'bg-yellow-100 text-yellow-800',
    // OPD
    waiting: 'bg-yellow-100 text-yellow-800', with_doctor: 'bg-blue-100 text-blue-800',
    // IPD
    discharge_initiated: 'bg-orange-100 text-orange-800', discharged: 'bg-green-100 text-green-800',
    // Billing
    draft: 'bg-gray-100 text-gray-700', final: 'bg-blue-100 text-blue-800',
    partially_paid: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800',
    // Pharmacy
    in_progress: 'bg-blue-100 text-blue-800', dispensed: 'bg-green-100 text-green-800',
    // Insurance
    approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800',
    query: 'bg-purple-100 text-purple-800', settled: 'bg-green-100 text-green-800',
    submitted: 'bg-blue-100 text-blue-800',
    // OT
    scheduled: 'bg-yellow-100 text-yellow-800', postponed: 'bg-orange-100 text-orange-800',
    // EMR
    signed: 'bg-green-100 text-green-800', amended: 'bg-orange-100 text-orange-800',
    // Accounting
    posted: 'bg-green-100 text-green-800', reversed: 'bg-red-100 text-red-800',
  };
  const color = colors[status] || 'bg-gray-100 text-gray-700';
  const sz = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return <span className={`${color} ${sz} rounded-full font-medium whitespace-nowrap`}>{status.replace(/_/g, ' ')}</span>;
}

// ============================================================
// PRINT TEMPLATE WRAPPER
// ============================================================
export function openPrintWindow(html: string, title: string = 'Health1 Print') {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; }
body { padding: 15mm; color: #1a1a1a; font-size: 11px; line-height: 1.5; }
.hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 12px; }
.logo { width: 60px; height: 60px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; }
.hn { font-size: 16px; font-weight: 700; color: #1e40af; }
.hs { font-size: 9px; color: #666; }
.pr { display: flex; gap: 16px; margin-bottom: 6px; font-size: 11px; }
.pr b { color: #1e40af; }
.st { font-size: 12px; font-weight: 700; color: #1e40af; margin: 12px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 6px 0; }
th { background: #eff6ff; color: #1e40af; text-align: left; padding: 4px 6px; border: 1px solid #d1d5db; }
td { padding: 4px 6px; border: 1px solid #e5e7eb; }
.ft { margin-top: 30px; text-align: right; }
.sig { width: 150px; border-bottom: 1px solid #333; margin-left: auto; margin-bottom: 4px; }
.warn { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 4px 8px; margin: 6px 0; font-size: 9px; color: #991b1b; }
.total-row td { font-weight: 700; background: #f9fafb; }
@media print { body { padding: 0; } }
</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// ============================================================
// BILL PRINT TEMPLATE
// ============================================================
export function printBill(bill: {
  billNumber: string; billDate: string; patientName: string; patientUhid: string;
  ageGender: string; payorType: string; items: { description: string; quantity: number; rate: number; amount: number }[];
  grossAmount: number; discountAmount: number; netAmount: number; paidAmount: number; balanceAmount: number;
  payments: { mode: string; amount: number; receipt: string; date: string }[];
}, centre: { name: string; address: string; phone: string; tagline: string }) {
  const itemsHtml = bill.items.map((item, i) =>
    `<tr><td>${i + 1}</td><td>${item.description}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">Rs.${item.rate.toLocaleString('en-IN')}</td><td style="text-align:right">Rs.${item.amount.toLocaleString('en-IN')}</td></tr>`
  ).join('');

  const paymentsHtml = bill.payments.map(p =>
    `<tr><td>${p.receipt}</td><td>${p.date}</td><td>${p.mode.toUpperCase()}</td><td style="text-align:right">Rs.${p.amount.toLocaleString('en-IN')}</td></tr>`
  ).join('');

  openPrintWindow(`
<div class="hdr">
  <div style="display:flex;gap:10px;align-items:center">
    <div class="logo">LOGO</div>
    <div><div class="hn">${centre.name}</div><div class="hs">${centre.address} | ${centre.phone}</div><div class="hs">${centre.tagline}</div></div>
  </div>
  <div style="text-align:right;font-size:10px;color:#666">
    <div style="font-size:14px;font-weight:700;color:#1e40af">BILL</div>
    Bill #: ${bill.billNumber}<br/>Date: ${bill.billDate}
  </div>
</div>

<div class="pr"><b>Patient:</b> ${bill.patientName} &nbsp; <b>UHID:</b> ${bill.patientUhid} &nbsp; <b>Age/Sex:</b> ${bill.ageGender} &nbsp; <b>Payor:</b> ${bill.payorType}</div>

<div class="st">Bill items</div>
<table>
  <tr><th>#</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>
  ${itemsHtml}
  <tr class="total-row"><td colspan="4" style="text-align:right">Gross total</td><td style="text-align:right">Rs.${bill.grossAmount.toLocaleString('en-IN')}</td></tr>
  ${bill.discountAmount > 0 ? `<tr><td colspan="4" style="text-align:right;color:#991b1b">Discount</td><td style="text-align:right;color:#991b1b">-Rs.${bill.discountAmount.toLocaleString('en-IN')}</td></tr>` : ''}
  <tr class="total-row"><td colspan="4" style="text-align:right;font-size:13px">Net amount</td><td style="text-align:right;font-size:13px">Rs.${bill.netAmount.toLocaleString('en-IN')}</td></tr>
</table>

${bill.payments.length > 0 ? `
<div class="st">Payments received</div>
<table><tr><th>Receipt #</th><th>Date</th><th>Mode</th><th style="text-align:right">Amount</th></tr>${paymentsHtml}
<tr class="total-row"><td colspan="3" style="text-align:right">Total paid</td><td style="text-align:right">Rs.${bill.paidAmount.toLocaleString('en-IN')}</td></tr></table>` : ''}

${bill.balanceAmount > 0 ? `<div style="text-align:right;font-size:14px;font-weight:700;color:#991b1b;margin-top:8px">Balance due: Rs.${bill.balanceAmount.toLocaleString('en-IN')}</div>` : '<div style="text-align:right;font-size:14px;font-weight:700;color:#166534;margin-top:8px">PAID IN FULL</div>'}

<div class="ft"><div class="sig"></div><div style="font-size:9px;color:#666">Authorized signatory</div></div>
  `, 'Bill — ' + bill.billNumber);
}

// ============================================================
// DISCHARGE SUMMARY PRINT
// ============================================================
export function printDischargeSummary(data: {
  patientName: string; uhid: string; ageGender: string; ipdNumber: string;
  admissionDate: string; dischargeDate: string; department: string;
  admittingDoctor: string; primaryDoctor: string; payorType: string;
  provisionalDiagnosis: string; finalDiagnosis: string;
  procedures: string[]; investigations: string; courseInHospital: string;
  conditionAtDischarge: string; adviceOnDischarge: string[];
  medications: { name: string; dose: string; frequency: string; duration: string }[];
  followUp: string;
}, centre: { name: string; address: string; phone: string; tagline: string }) {
  const medsHtml = data.medications.map((m, i) =>
    `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.dose}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`
  ).join('');

  openPrintWindow(`
<div class="hdr">
  <div style="display:flex;gap:10px;align-items:center">
    <div class="logo">LOGO</div>
    <div><div class="hn">${centre.name}</div><div class="hs">${centre.address} | ${centre.phone}</div></div>
  </div>
  <div style="text-align:right"><div style="font-size:14px;font-weight:700;color:#1e40af">DISCHARGE SUMMARY</div></div>
</div>

<table style="margin-bottom:12px">
  <tr><td style="width:25%"><b>Patient</b></td><td>${data.patientName}</td><td style="width:20%"><b>UHID</b></td><td>${data.uhid}</td></tr>
  <tr><td><b>Age/Sex</b></td><td>${data.ageGender}</td><td><b>IPD #</b></td><td>${data.ipdNumber}</td></tr>
  <tr><td><b>Admission</b></td><td>${data.admissionDate}</td><td><b>Discharge</b></td><td>${data.dischargeDate}</td></tr>
  <tr><td><b>Department</b></td><td>${data.department}</td><td><b>Payor</b></td><td>${data.payorType}</td></tr>
  <tr><td><b>Admitting Dr.</b></td><td>${data.admittingDoctor}</td><td><b>Primary Dr.</b></td><td>${data.primaryDoctor}</td></tr>
</table>

<div class="st">Provisional diagnosis</div><p style="font-size:11px;margin-bottom:6px">${data.provisionalDiagnosis}</p>
<div class="st">Final diagnosis</div><p style="font-size:11px;margin-bottom:6px">${data.finalDiagnosis}</p>

${data.procedures.length > 0 ? `<div class="st">Procedures performed</div><ul style="padding-left:20px;font-size:11px;margin-bottom:6px">${data.procedures.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}

<div class="st">Investigations summary</div><p style="font-size:10px;margin-bottom:6px;white-space:pre-wrap">${data.investigations}</p>
<div class="st">Course in hospital</div><p style="font-size:10px;margin-bottom:6px;white-space:pre-wrap">${data.courseInHospital}</p>
<div class="st">Condition at discharge</div><p style="font-size:11px;margin-bottom:6px">${data.conditionAtDischarge}</p>

<div class="st">Medications at discharge</div>
<table><tr><th>#</th><th>Medication</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr>${medsHtml}</table>

<div class="st">Advice on discharge</div>
<ul style="padding-left:20px;font-size:11px;margin-bottom:6px">${data.adviceOnDischarge.map(a => `<li>${a}</li>`).join('')}</ul>

<div class="st">Follow-up</div><p style="font-size:11px;margin-bottom:12px">${data.followUp}</p>

<div style="display:flex;justify-content:space-between;margin-top:30px">
  <div style="text-align:center"><div style="width:150px;border-bottom:1px solid #333;margin-bottom:4px"></div><div style="font-size:9px;color:#666">${data.admittingDoctor}</div></div>
  <div style="text-align:center"><div style="width:150px;border-bottom:1px solid #333;margin-bottom:4px"></div><div style="font-size:9px;color:#666">${data.primaryDoctor}</div></div>
</div>
  `, 'Discharge Summary — ' + data.uhid);
}

// ============================================================
// ENCOUNTER SUMMARY PRINT
// ============================================================
export function printEncounterSummary(data: {
  patientName: string; uhid: string; ageGender: string; doctorName: string;
  date: string; encounterType: string; status: string;
  vitals: any; complaints: string[]; examFindings: any[];
  diagnoses: { code: string; label: string; type: string }[];
  investigations: { name: string; urgency?: string; result?: string; isAbnormal?: boolean }[];
  prescriptions: { brand: string; generic: string; strength: string; dose: string; frequency: string; duration: string; instructions: string }[];
  advice: string[]; followUp: string; referral?: string;
}, centre: { name: string; address: string; phone: string; tagline: string }) {
  const vitalsHtml = data.vitals?.systolic ? `
    <div class="pr"><b>Vitals:</b> BP ${data.vitals.systolic}/${data.vitals.diastolic} mmHg | HR ${data.vitals.heartRate}/min | SpO2 ${data.vitals.spo2}% | Temp ${data.vitals.temperature}°F | Wt ${data.vitals.weight}kg</div>` : '';

  const dxHtml = data.diagnoses.map(d => `<tr><td>${d.code}</td><td>${d.label}</td><td>${d.type}</td></tr>`).join('');

  const rxHtml = data.prescriptions.map((p, i) =>
    `<tr><td>${i + 1}</td><td><b>${p.brand}</b> (${p.generic}) ${p.strength}</td><td>${p.dose}</td><td>${p.frequency}</td><td>${p.duration}</td><td>${p.instructions}</td></tr>`
  ).join('');

  const invHtml = data.investigations.map(i =>
    `<tr><td>${i.name}</td><td>${i.urgency || 'routine'}</td><td>${i.result || 'Pending'}</td><td>${i.isAbnormal ? '<span style="color:#991b1b;font-weight:700">ABNORMAL</span>' : i.result ? 'Normal' : '—'}</td></tr>`
  ).join('');

  const examHtml = data.examFindings.length > 0 ? data.examFindings.map(e =>
    `<div style="margin-bottom:4px"><b>${e.system || ''}:</b> ${e.findings || e.value || JSON.stringify(e)}</div>`
  ).join('') : '';

  openPrintWindow(`
<div class="hdr">
  <div style="display:flex;gap:10px;align-items:center">
    <div class="logo">LOGO</div>
    <div><div class="hn">${centre.name}</div><div class="hs">${centre.address} | ${centre.phone}</div><div class="hs">${centre.tagline}</div></div>
  </div>
  <div style="text-align:right;font-size:10px;color:#666">
    <div style="font-size:14px;font-weight:700;color:#1e40af">ENCOUNTER SUMMARY</div>
    Date: ${data.date}<br/>Type: ${data.encounterType.toUpperCase()}<br/>Status: ${data.status}
  </div>
</div>

<div class="pr"><b>Patient:</b> ${data.patientName} &nbsp; <b>UHID:</b> ${data.uhid} &nbsp; <b>Age/Sex:</b> ${data.ageGender} &nbsp; <b>Doctor:</b> ${data.doctorName}</div>

${vitalsHtml}

${data.complaints.length > 0 ? `<div class="st">Chief complaints</div><div style="font-size:11px">${data.complaints.join(', ')}</div>` : ''}

${examHtml ? `<div class="st">Examination findings</div><div style="font-size:10px">${examHtml}</div>` : ''}

${data.diagnoses.length > 0 ? `<div class="st">Diagnosis</div>
<table><tr><th>ICD Code</th><th>Diagnosis</th><th>Type</th></tr>${dxHtml}</table>` : ''}

${data.investigations.length > 0 ? `<div class="st">Investigations</div>
<table><tr><th>Test</th><th>Urgency</th><th>Result</th><th>Flag</th></tr>${invHtml}</table>` : ''}

${data.prescriptions.length > 0 ? `<div class="st">Prescription</div>
<table><tr><th>#</th><th>Medication</th><th>Dose</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr>${rxHtml}</table>` : ''}

${data.advice.length > 0 ? `<div class="st">Advice</div><ul style="padding-left:20px;font-size:10px">${data.advice.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}

${data.followUp ? `<div style="margin-top:6px;font-size:10px"><b>Follow-up:</b> ${data.followUp}</div>` : ''}
${data.referral ? `<div style="margin-top:4px;font-size:10px"><b>Referral:</b> ${data.referral}</div>` : ''}

<div class="ft"><div class="sig"></div><div style="font-size:9px;color:#666">${data.doctorName}</div></div>
  `, 'Encounter Summary — ' + data.uhid);
}

// ============================================================
// Print Lab Report
// ============================================================
export function printLabReport(data: {
  patientName: string; uhid: string; age: string | number; gender: string;
  testName: string; testCode: string; barcode?: string;
  orderedBy: string; collectedAt?: string; reportedAt?: string; verifiedBy?: string;
  results: { parameterName: string; value: string; unit: string; refRange: string; flag: string }[];
  centreName?: string; centreAddress?: string; centrePhone?: string;
}) {
  const now = new Date();
  const flagColor = (f: string) => f === 'CRITICAL' ? 'color:#dc2626;font-weight:900' : f === 'ABN' || f === 'HIGH' || f === 'LOW' ? 'color:#d97706;font-weight:700' : '';
  const valStyle = (f: string) => f === 'CRITICAL' ? 'color:#dc2626;font-weight:900;font-size:11px' : f === 'ABN' || f === 'HIGH' || f === 'LOW' ? 'color:#d97706;font-weight:700' : '';
  const resultsHtml = data.results.map(r => `<tr>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${r.parameterName}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:center;${valStyle(r.flag)}">${r.value}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9px;color:#666">${r.unit || ''}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9px;color:#888">${r.refRange || '—'}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:center;${flagColor(r.flag)};font-size:9px">${r.flag || ''}</td>
  </tr>`).join('');

  openPrintWindow(`
<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:12px">
    <div>
      <div style="font-size:18px;font-weight:700;color:#1e40af">${data.centreName || 'Health1 Super Speciality Hospital'}</div>
      <div style="font-size:8px;color:#666">${data.centreAddress || 'Shilaj, Ahmedabad'} | ${data.centrePhone || ''}</div>
    </div>
    <div style="text-align:right;font-size:9px;color:#666">
      <div style="font-size:12px;font-weight:700;color:#1e40af">LABORATORY REPORT</div>
      Date: ${now.toLocaleDateString('en-IN')}<br/>
      Time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>

  <!-- Patient Info -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:10px;margin-bottom:12px;padding:8px;background:#f8fafc;border-radius:6px">
    <div><b>Patient:</b> ${data.patientName}</div>
    <div><b>UHID:</b> ${data.uhid}</div>
    <div><b>Age/Sex:</b> ${data.age} / ${data.gender}</div>
    <div><b>Barcode:</b> ${data.barcode || '—'}</div>
    <div><b>Referred by:</b> Dr. ${data.orderedBy}</div>
    <div><b>Collected:</b> ${data.collectedAt || '—'}</div>
  </div>

  <!-- Test Name -->
  <div style="font-size:13px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:4px;margin-bottom:8px">${data.testName} (${data.testCode})</div>

  <!-- Results Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr style="background:#eff6ff">
      <th style="padding:5px 8px;text-align:left;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Parameter</th>
      <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Result</th>
      <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Unit</th>
      <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Reference Range</th>
      <th style="padding:5px 8px;text-align:center;font-size:10px;color:#1e40af;border-bottom:2px solid #1e40af">Flag</th>
    </tr></thead>
    <tbody>${resultsHtml}</tbody>
  </table>

  <!-- Interpretation Key -->
  <div style="font-size:8px;color:#888;margin-bottom:16px">
    <b>Flag Key:</b> CRITICAL = Value requires immediate clinical attention | ABN = Outside reference range | Δ = Significant change from previous result
  </div>

  <!-- Signatures -->
  <div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb">
    <div style="text-align:center;font-size:9px;color:#666">
      <div style="width:140px;border-bottom:1px solid #333;margin-bottom:4px"></div>
      Lab Technician
    </div>
    <div style="text-align:center;font-size:9px;color:#666">
      <div style="width:140px;border-bottom:1px solid #333;margin-bottom:4px"></div>
      ${data.verifiedBy ? 'Verified by: ' + data.verifiedBy : 'Pathologist'}
    </div>
  </div>

  <div style="margin-top:16px;font-size:7px;color:#aaa;text-align:center">
    This is a computer-generated report. ${data.reportedAt ? 'Reported: ' + data.reportedAt : ''}<br/>
    Health1 Super Speciality Hospital — Quality Healthcare for All
  </div>
</div>
  `, 'Lab Report — ' + data.uhid + ' — ' + data.testCode);
}
