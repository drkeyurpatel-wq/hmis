'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useConversionLead, logFollowup, updateLeadStatus, updateLead } from '@/lib/convert/useConvert';
import {
  STATUS_LABELS, STATUS_COLORS, URGENCY_COLORS, ADVISED_TYPE_LABELS,
  CONCERN_LABELS, ACTION_TYPE_LABELS, OUTCOME_LABELS, LOST_STATUSES,
  type ActionType, type FollowupOutcome, type LeadStatus,
} from '@/lib/convert/types';
import {
  ArrowLeft, Phone, MessageCircle, FileText, Clock,
  User, Stethoscope, Building2, Shield, Calendar,
  Send, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';

function LeadDetail() {
  const params = useParams();
  const leadId = params.id as string;
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';

  const { lead, patient, doctor, department, followups, loading, refetch } = useConversionLead(leadId);

  // Follow-up form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    actionType: 'phone_call' as ActionType,
    description: '',
    outcome: '' as FollowupOutcome | '',
    nextDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Status change
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const submitFollowup = useCallback(async () => {
    if (!formData.description || submitting) return;
    setSubmitting(true);
    const { error } = await logFollowup({
      lead_id: leadId,
      action_type: formData.actionType,
      action_description: formData.description,
      outcome: formData.outcome || undefined,
      next_followup_date: formData.nextDate || undefined,
      performed_by: staffId,
    });
    setSubmitting(false);
    if (!error) {
      setFormData({ actionType: 'phone_call', description: '', outcome: '', nextDate: '' });
      setShowForm(false);
      refetch();
    }
  }, [formData, leadId, staffId, submitting, refetch]);

  const handleStatusChange = useCallback(async () => {
    if (!newStatus || submitting) return;
    setSubmitting(true);
    await updateLeadStatus(leadId, newStatus);
    if (statusNote) {
      await logFollowup({
        lead_id: leadId,
        action_type: 'note',
        action_description: `Status changed to ${STATUS_LABELS[newStatus as LeadStatus] || newStatus}. ${statusNote}`,
        performed_by: staffId,
      });
    }
    setSubmitting(false);
    setShowStatusModal(false);
    setNewStatus('');
    setStatusNote('');
    refetch();
  }, [newStatus, statusNote, leadId, staffId, submitting, refetch]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!lead || !patient) {
    return (
      <div className="p-6">
        <Link href="/convert" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 cursor-pointer">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="bg-white rounded-xl border p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
          <p className="text-gray-500 font-medium">Lead not found</p>
        </div>
      </div>
    );
  }

  const isLost = lead.status.startsWith('lost_');
  const isConverted = lead.status === 'admitted' || lead.status === 'completed';

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/convert/tasks" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h1>
          <p className="text-sm text-gray-500">UHID: {patient.uhid} | {lead.advised_procedure}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: STATUS_COLORS[lead.status] + '20', color: STATUS_COLORS[lead.status] }}>
          {STATUS_LABELS[lead.status as LeadStatus] || lead.status}
        </span>
      </div>

      {/* Lead Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Patient Info */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <User size={15} className="text-teal-600" /> Patient
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Name</span>
              <span className="text-gray-800 font-medium">{patient.first_name} {patient.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">UHID</span>
              <span className="text-gray-800">{patient.uhid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Phone</span>
              <a href={`tel:${patient.phone_primary}`} className="text-blue-600 hover:underline cursor-pointer">{patient.phone_primary}</a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gender / Age</span>
              <span className="text-gray-800">{patient.gender} / {patient.age_years}y</span>
            </div>
          </div>
        </div>

        {/* Clinical Info */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Stethoscope size={15} className="text-teal-600" /> Clinical
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Procedure</span>
              <span className="text-gray-800 font-medium">{lead.advised_procedure}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Type</span>
              <span className="text-gray-800">{ADVISED_TYPE_LABELS[lead.advised_type] || lead.advised_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Doctor</span>
              <span className="text-gray-800">{doctor?.full_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Department</span>
              <span className="text-gray-800">{department?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Urgency</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${URGENCY_COLORS[lead.urgency]}`}>
                {lead.urgency.toUpperCase()}
              </span>
            </div>
            {lead.diagnosis && (
              <div className="flex justify-between">
                <span className="text-gray-400">Diagnosis</span>
                <span className="text-gray-800 text-right max-w-[60%]">{lead.diagnosis} {lead.icd_code && `(${lead.icd_code})`}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial & Pipeline */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Building2 size={15} className="text-teal-600" /> Pipeline
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Visit Date</span>
              <span className="text-gray-800">{formatDate(lead.visit_date)}</span>
            </div>
            {lead.estimated_cost != null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Cost</span>
                <span className="text-gray-800 font-medium">{formatCurrency(lead.estimated_cost)}</span>
              </div>
            )}
            {lead.estimated_stay_days != null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Stay</span>
                <span className="text-gray-800">{lead.estimated_stay_days} days</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Insurance</span>
              <span className="text-gray-800">
                {lead.insurance_applicable ? `Yes (${lead.insurance_coverage_pct || 0}%)` : 'No'}
              </span>
            </div>
            {lead.patient_concern && (
              <div className="flex justify-between">
                <span className="text-gray-400">Concern</span>
                <span className="text-amber-700 text-xs font-medium">{CONCERN_LABELS[lead.patient_concern] || lead.patient_concern}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Follow-ups</span>
              <span className="text-gray-800">{lead.followup_count}</span>
            </div>
            {lead.next_followup_date && (
              <div className="flex justify-between">
                <span className="text-gray-400">Next F/U</span>
                <span className="text-blue-600 font-medium">{formatDate(lead.next_followup_date)}</span>
              </div>
            )}
            {lead.conversion_days != null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Conversion Days</span>
                <span className="text-emerald-600 font-medium">{lead.conversion_days}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isConverted && !isLost && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            if (patient.phone_primary) window.open(`tel:${patient.phone_primary}`);
            setShowForm(true);
            setFormData(f => ({ ...f, actionType: 'phone_call', description: 'Phone call to patient' }));
          }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium transition-colors cursor-pointer">
            <Phone size={14} /> Call
          </button>
          <button onClick={() => {
            if (patient.phone_primary) window.open(`https://wa.me/91${patient.phone_primary.replace(/\D/g, '').slice(-10)}`);
            setShowForm(true);
            setFormData(f => ({ ...f, actionType: 'whatsapp', description: '' }));
          }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium transition-colors cursor-pointer">
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button onClick={() => { setShowForm(true); setFormData(f => ({ ...f, actionType: 'note', description: '' })); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors cursor-pointer">
            <FileText size={14} /> Log Note
          </button>
          <div className="flex-1" />
          <button onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium transition-colors cursor-pointer">
            Change Status
          </button>
        </div>
      )}

      {/* Follow-up Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Log Follow-up</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Action Type</label>
              <select value={formData.actionType}
                onChange={e => setFormData(f => ({ ...f, actionType: e.target.value as ActionType }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Outcome</label>
              <select value={formData.outcome}
                onChange={e => setFormData(f => ({ ...f, outcome: e.target.value as FollowupOutcome }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select outcome...</option>
                {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <textarea value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={3} className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="What happened during this interaction..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Next Follow-up Date</label>
              <input type="date" value={formData.nextDate}
                onChange={e => setFormData(f => ({ ...f, nextDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={submitFollowup} disabled={submitting || !formData.description}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
              Submit
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Change Lead Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[...LOST_STATUSES, 'scheduled' as const, 'interested' as const, 'contacted' as const].map(st => (
              <button key={st} onClick={() => setNewStatus(st)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  newStatus === st ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}>
                {STATUS_LABELS[st]}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
            <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Reason for status change..." />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleStatusChange} disabled={!newStatus || submitting}
              className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
              {submitting ? 'Saving...' : 'Update Status'}
            </button>
            <button onClick={() => { setShowStatusModal(false); setNewStatus(''); }}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Follow-up Timeline</h3>
        {followups.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No follow-ups logged yet
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {followups.map((fu, i) => (
                <div key={fu.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white bg-teal-500" />
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-medium text-gray-600">{ACTION_TYPE_LABELS[fu.action_type]}</span>
                      <span>by {fu.performer_name || 'Unknown'}</span>
                      <span className="ml-auto">{formatDateTime(fu.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{fu.action_description}</p>
                    {fu.outcome && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                        Outcome: {OUTCOME_LABELS[fu.outcome] || fu.outcome}
                      </span>
                    )}
                    {fu.next_followup_date && (
                      <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                        Next: {formatDate(fu.next_followup_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  return (
    <RoleGuard>
      <LeadDetail />
    </RoleGuard>
  );
}
