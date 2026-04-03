'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useConversionTasks, logFollowup } from '@/lib/convert/useConvert';
import {
  URGENCY_COLORS, ACTION_TYPE_LABELS, OUTCOME_LABELS,
  type ActionType, type FollowupOutcome,
} from '@/lib/convert/types';
import {
  Phone, MessageCircle, FileText, CalendarPlus,
  ArrowLeft, Clock, ChevronDown, ChevronUp,
  UserCheck, Send,
} from 'lucide-react';

function TaskList() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const { data: tasks, loading, refetch } = useConversionTasks(centreId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [followupForm, setFollowupForm] = useState<{
    leadId: string;
    actionType: ActionType;
    description: string;
    outcome: FollowupOutcome | '';
    nextDate: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const openFollowup = useCallback((leadId: string, actionType: ActionType, presetOutcome?: FollowupOutcome) => {
    setFollowupForm({
      leadId,
      actionType,
      description: actionType === 'phone_call' ? 'Phone call to patient' : '',
      outcome: presetOutcome || '',
      nextDate: '',
    });
    setExpandedId(leadId);
  }, []);

  const submitFollowup = useCallback(async () => {
    if (!followupForm || !followupForm.description || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await logFollowup({
        lead_id: followupForm.leadId,
        action_type: followupForm.actionType,
        action_description: followupForm.description,
        outcome: followupForm.outcome || undefined,
        next_followup_date: followupForm.nextDate || undefined,
        performed_by: staffId,
      });
      if (!error) {
        setFollowupForm(null);
        setExpandedId(null);
        flash('Follow-up logged');
        refetch();
      } else {
        flash('Error: ' + error.message);
      }
    } catch (err: any) {
      flash('Error: ' + (err?.message || 'Failed to log follow-up'));
    } finally {
      setSubmitting(false);
    }
  }, [followupForm, staffId, submitting, refetch]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/convert" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Counselor Task List</h1>
            <p className="text-sm text-gray-500">{tasks.length} active leads requiring follow-up</p>
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {['emergency', 'urgent', 'soon', 'routine'].map(urg => {
          const count = tasks.filter(t => t.urgency === urg).length;
          if (count === 0) return null;
          return (
            <span key={urg} className={`px-3 py-1 rounded-full text-xs font-medium ${URGENCY_COLORS[urg as keyof typeof URGENCY_COLORS]}`}>
              {urg.charAt(0).toUpperCase() + urg.slice(1)}: {count}
            </span>
          );
        })}
      </div>

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <UserCheck size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-gray-500 font-medium">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No pending conversion tasks at the moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isExpanded = expandedId === task.lead_id;
            const isFormOpen = followupForm?.leadId === task.lead_id;
            return (
              <div key={task.lead_id} className="bg-white rounded-xl border hover:shadow-sm transition-shadow">
                {/* Card header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${URGENCY_COLORS[task.urgency]}`}>
                          {task.urgency}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">{task.task_reason}</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                        <Link href={`/convert/${task.lead_id}`}
                          className="text-base font-semibold text-gray-900 hover:text-teal-700 cursor-pointer">
                          {task.patient_name}
                        </Link>
                        <span className="text-xs text-gray-400">({task.patient_uhid})</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {task.doctor_name && <><span className="text-gray-400">Dr.</span> {task.doctor_name} advised: </>}
                        <span className="font-medium">{task.advised_procedure}</span>
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> Advised {task.days_since_advised} day{task.days_since_advised !== 1 ? 's' : ''} ago
                        </span>
                        {task.estimated_cost != null && task.estimated_cost > 0 && (
                          <span>Est: {formatCurrency(task.estimated_cost)}</span>
                        )}
                        {task.followup_count > 0 && (
                          <span>{task.followup_count} follow-up{task.followup_count !== 1 ? 's' : ''}</span>
                        )}
                        {task.last_followup_date && (
                          <span>Last: {formatDate(task.last_followup_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <button onClick={() => {
                      openFollowup(task.lead_id, 'phone_call');
                      if (task.patient_phone) window.open(`tel:${task.patient_phone}`);
                    }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors cursor-pointer">
                      <Phone size={13} /> Call
                    </button>
                    <button onClick={() => {
                      if (task.patient_phone) window.open(`https://wa.me/91${task.patient_phone.replace(/\D/g, '').slice(-10)}`);
                      openFollowup(task.lead_id, 'whatsapp');
                    }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors cursor-pointer">
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                    <button onClick={() => openFollowup(task.lead_id, 'note')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs font-medium transition-colors cursor-pointer">
                      <FileText size={13} /> Log Note
                    </button>
                    <button onClick={() => openFollowup(task.lead_id, 'note', 'scheduled')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-medium transition-colors cursor-pointer">
                      <CalendarPlus size={13} /> Schedule
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => setExpandedId(isExpanded ? null : task.lead_id)}
                      className="p-1.5 rounded hover:bg-gray-100 cursor-pointer">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Follow-up Form (inline) */}
                {isFormOpen && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FileText size={14} />
                        Log Follow-up — {ACTION_TYPE_LABELS[followupForm.actionType]}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Action Type</label>
                          <select value={followupForm.actionType}
                            onChange={e => setFollowupForm(f => f ? { ...f, actionType: e.target.value as ActionType } : f)}
                            className="w-full border rounded-lg px-3 py-2 text-sm">
                            {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Description *</label>
                          <textarea value={followupForm.description}
                            onChange={e => setFollowupForm(f => f ? { ...f, description: e.target.value } : f)}
                            rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="What happened during this interaction..." />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Outcome</label>
                          <select value={followupForm.outcome}
                            onChange={e => setFollowupForm(f => f ? { ...f, outcome: e.target.value as FollowupOutcome } : f)}
                            className="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="">Select outcome...</option>
                            {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Next Follow-up Date</label>
                          <input type="date" value={followupForm.nextDate}
                            onChange={e => setFollowupForm(f => f ? { ...f, nextDate: e.target.value } : f)}
                            className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={submitFollowup} disabled={submitting || !followupForm.description}
                          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          {submitting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          Submit
                        </button>
                        <button onClick={() => { setFollowupForm(null); setExpandedId(null); }}
                          className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <RoleGuard>
      <TaskList />
    </RoleGuard>
  );
}
