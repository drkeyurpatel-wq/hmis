// components/lab/lab-modal.tsx
// Reusable modal system for lab module — replaces all prompt() calls
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// ── Base Modal ──────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function LabModal({ open, onClose, title, children, width = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className={`bg-h1-card rounded-h1-lg shadow-h1-modal ${width} w-full animate-h1-fade-in`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-h1-border">
          <h3 className="text-h1-card-title text-h1-navy">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-h1-navy/5 rounded-h1-sm transition-colors cursor-pointer">
            <X className="w-4 h-4 text-h1-text-muted" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Reject Sample Modal ─────────────────────────────────────
const REJECTION_REASONS = [
  'Hemolyzed sample', 'Clotted sample', 'Lipemic sample',
  'Insufficient quantity', 'Wrong container', 'Patient ID mismatch',
  'Unlabeled sample', 'Delayed transport', 'Contaminated', 'Other',
];

interface RejectSampleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  patientName?: string;
  testName?: string;
}

export function RejectSampleModal({ open, onClose, onConfirm, patientName, testName }: RejectSampleModalProps) {
  const [selected, setSelected] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const reason = selected === 'Other' ? customReason : selected;
    if (reason) { onConfirm(reason); onClose(); setSelected(''); setCustomReason(''); }
  };

  return (
    <LabModal open={open} onClose={onClose} title="Reject Sample">
      {patientName && (
        <div className="text-h1-small text-h1-text-secondary mb-3">
          {patientName} — {testName}
        </div>
      )}
      <div className="space-y-1.5 mb-4">
        {REJECTION_REASONS.map(r => (
          <label key={r} className="flex items-center gap-2 px-3 py-2 rounded-h1-sm
            hover:bg-h1-navy/[0.03] transition-colors cursor-pointer">
            <input type="radio" name="reject" value={r} checked={selected === r}
              onChange={() => setSelected(r)}
              className="w-3.5 h-3.5 accent-h1-red" />
            <span className="text-h1-body text-h1-text">{r}</span>
          </label>
        ))}
      </div>
      {selected === 'Other' && (
        <input type="text" value={customReason} onChange={e => setCustomReason(e.target.value)}
          placeholder="Specify reason..." autoFocus
          className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
            focus:outline-none focus:ring-1 focus:ring-h1-teal mb-4" />
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-h1-small font-medium text-h1-text-secondary
          hover:bg-h1-navy/5 rounded-h1-sm transition-colors cursor-pointer">Cancel</button>
        <button onClick={handleConfirm} disabled={!selected || (selected === 'Other' && !customReason)}
          className="px-4 py-2 text-h1-small font-medium bg-h1-red text-white rounded-h1-sm
            hover:bg-h1-red/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          Reject Sample</button>
      </div>
    </LabModal>
  );
}

// ── Outsource Modal ─────────────────────────────────────────
interface OutsourceModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (labName: string, expectedReturn: string, cost?: number) => void;
  testName?: string;
}

export function OutsourceModal({ open, onClose, onConfirm, testName }: OutsourceModalProps) {
  const [labName, setLabName] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [cost, setCost] = useState('');

  const handleConfirm = () => {
    if (labName) {
      onConfirm(labName, expectedReturn, cost ? parseFloat(cost) : undefined);
      onClose(); setLabName(''); setExpectedReturn(''); setCost('');
    }
  };

  return (
    <LabModal open={open} onClose={onClose} title="Outsource Test">
      {testName && <div className="text-h1-small text-h1-text-secondary mb-3">Test: {testName}</div>}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-h1-small font-medium text-h1-text-secondary block mb-1">External Lab Name *</label>
          <input type="text" value={labName} onChange={e => setLabName(e.target.value)} autoFocus
            placeholder="e.g., SRL Diagnostics, Metropolis"
            className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal" />
        </div>
        <div>
          <label className="text-h1-small font-medium text-h1-text-secondary block mb-1">Expected Return Date</label>
          <input type="date" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)}
            className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal" />
        </div>
        <div>
          <label className="text-h1-small font-medium text-h1-text-secondary block mb-1">Cost (₹)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-h1-small font-medium text-h1-text-secondary
          hover:bg-h1-navy/5 rounded-h1-sm transition-colors cursor-pointer">Cancel</button>
        <button onClick={handleConfirm} disabled={!labName}
          className="px-4 py-2 text-h1-small font-medium bg-h1-yellow text-white rounded-h1-sm
            hover:bg-h1-yellow/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          Dispatch</button>
      </div>
    </LabModal>
  );
}

// ── Phone Input Modal (WhatsApp) ────────────────────────────
interface PhoneModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (phone: string) => void;
  patientName?: string;
}

export function PhoneModal({ open, onClose, onConfirm, patientName }: PhoneModalProps) {
  const [phone, setPhone] = useState('');

  const handleConfirm = () => {
    const cleaned = phone.replace(/\s+/g, '').replace(/^(\+91|91|0)/, '');
    if (cleaned.length >= 10) { onConfirm(cleaned); onClose(); setPhone(''); }
  };

  return (
    <LabModal open={open} onClose={onClose} title="Send via WhatsApp">
      {patientName && <div className="text-h1-small text-h1-text-secondary mb-3">Patient: {patientName}</div>}
      <div className="mb-4">
        <label className="text-h1-small font-medium text-h1-text-secondary block mb-1">Phone Number</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoFocus
          placeholder="Enter 10-digit mobile number"
          className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
            focus:outline-none focus:ring-1 focus:ring-h1-teal"
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-h1-small font-medium text-h1-text-secondary
          hover:bg-h1-navy/5 rounded-h1-sm transition-colors cursor-pointer">Cancel</button>
        <button onClick={handleConfirm} disabled={phone.replace(/\D/g, '').length < 10}
          className="px-4 py-2 text-h1-small font-medium bg-h1-success text-white rounded-h1-sm
            hover:bg-h1-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          Send</button>
      </div>
    </LabModal>
  );
}

// ── Acknowledge Modal ───────────────────────────────────────
interface AcknowledgeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (action: string) => void;
  parameterName?: string;
  value?: string;
}

export function AcknowledgeModal({ open, onClose, onConfirm, parameterName, value }: AcknowledgeModalProps) {
  const [action, setAction] = useState('');

  const handleConfirm = () => {
    if (action.trim()) { onConfirm(action.trim()); onClose(); setAction(''); }
  };

  return (
    <LabModal open={open} onClose={onClose} title="Acknowledge Critical Value">
      {parameterName && (
        <div className="bg-h1-red/5 border border-h1-red/20 rounded-h1-sm px-3 py-2 mb-3">
          <span className="text-h1-small font-semibold text-h1-red">{parameterName}: {value}</span>
        </div>
      )}
      <div className="mb-4">
        <label className="text-h1-small font-medium text-h1-text-secondary block mb-1">Action taken by doctor *</label>
        <textarea value={action} onChange={e => setAction(e.target.value)} autoFocus rows={3}
          placeholder="Describe clinical action taken in response to this critical value..."
          className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
            focus:outline-none focus:ring-1 focus:ring-h1-teal resize-y" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-h1-small font-medium text-h1-text-secondary
          hover:bg-h1-navy/5 rounded-h1-sm transition-colors cursor-pointer">Cancel</button>
        <button onClick={handleConfirm} disabled={!action.trim()}
          className="px-4 py-2 text-h1-small font-medium bg-h1-success text-white rounded-h1-sm
            hover:bg-h1-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          Acknowledge</button>
      </div>
    </LabModal>
  );
}
