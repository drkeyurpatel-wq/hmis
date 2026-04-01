'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useARTasks, useLogFollowup, useUpdateClaim } from '@/lib/collect/useARTasks';
import { AGING_COLORS, PRIORITY_COLORS, ACTION_TYPE_LABELS, type FollowupAction } from '@/lib/collect/ar-types';
import {
  ListChecks, RefreshCw, Phone, Mail, Eye, CalendarClock,
  AlertTriangle, ChevronLeft, ChevronDown, ChevronUp,
  MessageSquareWarning, Flame, Clock, ArrowLeft,
} from 'lucide-react';

const fmtINR = (n: number) => formatCurrency(n);

const ACTION_TYPES: { value: FollowupAction; label: string; icon: React.ReactNode }[] = [
  { value: 'phone_call', label: 'Phone Call', icon: <Phone size={14} /> },
  { value: 'email_sent', label: 'Email Sent', icon: <Mail size={14} /> },
  { value: 'portal_check', label: 'Portal Check', icon: <Eye size={14} /> },
  { value: 'document_submitted', label: 'Doc Submitted', icon: <ListChecks size={14} /> },
  { value: 'escalation', label: 'Escalation', icon: <AlertTriangle size={14} /> },
  { value: 'note', label: 'Note', icon: <MessageSquareWarning size={14} /> },
];

function TasksInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { tasks, loading, error, stats, refetch } = useARTasks(centreId, staffId);
  const { logFollowup, saving: followupSaving } = useLogFollowup();
  const { updateClaim, saving: updateSaving } = useUpdateClaim();

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [followupForm, setFollowupForm] = useState<{
    claimId: string; mode: 'call' | 'email' | 'full';
  } | null>(null);

  // Quick follow-up form state
  const [ff, setFf] = useState({
    actionType: 'phone_call' as FollowupAction,
    contactedPerson: '',
    description: '',
    outcome: '',
    nextFollowupDate: '',
    amountPromised: '',
  });

  const resetForm = () => {
    setFf({ actionType: 'phone_call', contactedPerson: '', description: '', outcome: '', nextFollowupDate: '', amountPromised: '' });
    setFollowupForm(null);
  };

  const submitFollowup = async () => {
    if (!followupForm || !ff.description.trim()) return;
    const ok = await logFollowup({
      claimId: followupForm.claimId,
      actionType: ff.actionType,
      contactedPerson: ff.contactedPerson || undefined,
      description: ff.description,
      outcome: ff.outcome || undefined,
      nextFollowupDate: ff.nextFollowupDate || undefined,
      amountPromised: ff.amountPromised ? parseFloat(ff.amountPromised) : undefined,
      staffId,
    });
    if (ok) { resetForm(); refetch(); }
  };

  const handleEscalate = async (claimId: string) => {
    const ok = await updateClaim(claimId, { priority: 'critical' });
    if (ok) refetch();
  };

  const handleSetFollowup = async (claimId: string, date: string) => {
    const ok = await updateClaim(claimId, { next_followup_date: date });
    if (ok) refetch();
  };

  const openFollowup = (claimId: string, mode: 'call' | 'email' | 'full') => {
    setFollowupForm({ claimId, mode });
    setFf(prev => ({
      ...prev,
      actionType: mode === 'call' ? 'phone_call' : mode === 'email' ? 'email_sent' : prev.actionType,
    }));
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/collect" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Today&apos;s Follow-ups
              <span className="bg-teal-100 text-teal-700 text-sm font-medium px-2.5 py-0.5 rounded-full">{stats.total}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{formatDate(new Date())}</p>
          </div>
        </div>
        <button onClick={refetch}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors duration-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Tasks" value={stats.total} icon={<ListChecks size={14} />} />
        <StatPill label="Open Queries" value={stats.openQueries} icon={<MessageSquareWarning size={14} />} color="text-amber-600" />
        <StatPill label="Critical Claims" value={stats.critical} icon={<Flame size={14} />} color="text-red-600" />
        <StatPill label="Due Today" value={stats.dueTodayCount} icon={<Clock size={14} />} color="text-blue-600" />
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
          <button onClick={refetch} className="ml-2 underline cursor-pointer">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-64 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Task Cards */}
      {!loading && tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ListChecks size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No pending follow-ups</p>
          <p className="text-sm text-gray-400 mt-1">All caught up! Check the AR Dashboard for the full claims list.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map(task => {
          const isExpanded = expandedTask === task.claim_id;
          const isFollowupOpen = followupForm?.claimId === task.claim_id;

          return (
            <div key={task.claim_id} className={`bg-white rounded-xl border transition-all duration-200 ${
              task.priority === 'critical' ? 'border-red-300 ring-1 ring-red-200' :
              task.priority === 'high' ? 'border-orange-200' : 'border-gray-200'
            }`}>
              {/* Card Header */}
              <div className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{task.patient_name}</span>
                      <span className="text-xs text-gray-400">({task.patient_uhid})</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                      {task.has_open_query && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Query
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span>{task.claim_number}</span>
                      <span className="text-gray-300">|</span>
                      <span>{task.insurer_name}</span>
                      {task.tpa_name !== 'N/A' && (
                        <><span className="text-gray-300">|</span><span>{task.tpa_name}</span></>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-gray-900">{fmtINR(task.outstanding_amount)}</div>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${AGING_COLORS[task.aging_bucket]}`}>
                        {task.aging_bucket}d
                      </span>
                      <span className="text-xs text-gray-400">{task.days_outstanding} days</span>
                    </div>
                  </div>
                </div>

                {/* Task reason */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                    {task.task_reason}
                  </span>
                </div>

                {/* Last follow-up */}
                {task.last_followup_date && (
                  <div className="mt-2 text-xs text-gray-400">
                    Last follow-up: {formatDate(task.last_followup_date)}
                    {task.last_followup_note && (
                      <span className="text-gray-500"> — {task.last_followup_note.slice(0, 100)}{task.last_followup_note.length > 100 ? '...' : ''}</span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionBtn label="Log Call" icon={<Phone size={14} />}
                    onClick={() => openFollowup(task.claim_id, 'call')}
                    active={isFollowupOpen && followupForm?.mode === 'call'} />
                  <ActionBtn label="Log Email" icon={<Mail size={14} />}
                    onClick={() => openFollowup(task.claim_id, 'email')}
                    active={isFollowupOpen && followupForm?.mode === 'email'} />
                  <Link href={`/collect/${task.claim_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                    <Eye size={14} /> View Claim
                  </Link>
                  <SetFollowupBtn claimId={task.claim_id} onSet={handleSetFollowup} />
                  <ActionBtn label="Escalate" icon={<AlertTriangle size={14} />}
                    onClick={() => handleEscalate(task.claim_id)}
                    variant="danger" disabled={task.priority === 'critical' || updateSaving} />
                </div>
              </div>

              {/* Inline Follow-up Form */}
              {isFollowupOpen && (
                <div className="border-t border-gray-100 p-4 md:p-5 bg-gray-50/50">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Quick Follow-up — {followupForm.mode === 'call' ? 'Phone Call' : followupForm.mode === 'email' ? 'Email' : 'General'}
                  </h4>

                  {/* Action type pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ACTION_TYPES.map(at => (
                      <button key={at.value}
                        onClick={() => setFf(p => ({ ...p, actionType: at.value }))}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors duration-200 ${
                          ff.actionType === at.value
                            ? 'bg-teal-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'
                        }`}>
                        {at.icon} {at.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Contacted Person</label>
                      <input type="text" value={ff.contactedPerson} onChange={e => setFf(p => ({ ...p, contactedPerson: e.target.value }))}
                        placeholder="e.g., Claims officer name"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Next Follow-up Date</label>
                      <input type="date" value={ff.nextFollowupDate} onChange={e => setFf(p => ({ ...p, nextFollowupDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Description <span className="text-red-500">*</span></label>
                      <textarea value={ff.description} onChange={e => setFf(p => ({ ...p, description: e.target.value }))}
                        rows={2} placeholder="What happened during this follow-up?"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Outcome</label>
                      <textarea value={ff.outcome} onChange={e => setFf(p => ({ ...p, outcome: e.target.value }))}
                        rows={1} placeholder="Result of follow-up"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Amount Promised</label>
                      <input type="number" value={ff.amountPromised} onChange={e => setFf(p => ({ ...p, amountPromised: e.target.value }))}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={submitFollowup} disabled={!ff.description.trim() || followupSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer transition-colors duration-200">
                      {followupSaving ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : null}
                      Save Follow-up
                    </button>
                    <button onClick={resetForm}
                      className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors duration-200">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Small components ----
function StatPill({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className={`${color || 'text-gray-500'}`}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, variant, active, disabled }: {
  label: string; icon: React.ReactNode; onClick?: () => void;
  variant?: 'danger'; active?: boolean; disabled?: boolean;
}) {
  const base = variant === 'danger'
    ? 'border-red-200 text-red-600 hover:bg-red-50'
    : active ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors duration-200 disabled:opacity-40 ${base}`}>
      {icon} {label}
    </button>
  );
}

function SetFollowupBtn({ claimId, onSet }: { claimId: string; onSet: (id: string, date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
        <CalendarClock size={14} /> Set Follow-up
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          <input type="date" autoFocus
            onChange={e => { if (e.target.value) { onSet(claimId, e.target.value); setOpen(false); } }}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <RoleGuard module="billing">
      <TasksInner />
    </RoleGuard>
  );
}
