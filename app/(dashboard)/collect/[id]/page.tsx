'use client';

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import {
  useClaimDetail, useClaimFollowups, useClaimQueries,
  useCreateFollowup, useCreateQuery, useRespondToQuery,
  useUpdateClaimDetail, useSettleClaim,
} from '@/lib/collect/useARClaimDetail';
import {
  AGING_COLORS, PRIORITY_COLORS, STATUS_COLORS, ACTION_TYPE_LABELS, QUERY_TYPE_LABELS,
  type FollowupAction, type QueryType, type ClaimFollowup, type ClaimQuery,
} from '@/lib/collect/ar-types';
import {
  ArrowLeft, Phone, Mail, Eye, FileText, AlertTriangle,
  UserCheck, Ban, CheckCircle2, Clock, MessageSquare,
  Send, ChevronDown, ChevronUp, IndianRupee, RefreshCw,
  User, Building2, CreditCard, Calendar,
} from 'lucide-react';

const fmtINR = (n: number) => formatCurrency(n);

type ModalType = 'followup' | 'query' | 'settle' | 'respond' | 'reassign' | null;

function ClaimDetailInner() {
  const params = useParams();
  const claimId = params.id as string;
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';

  const { claim, loading, error, refetch: refetchClaim } = useClaimDetail(claimId);
  const { followups, loading: fuLoading, refetch: refetchFollowups } = useClaimFollowups(claimId);
  const { queries, loading: qLoading, refetch: refetchQueries } = useClaimQueries(claimId);

  const refetchAll = useCallback(() => { refetchClaim(); refetchFollowups(); refetchQueries(); }, [refetchClaim, refetchFollowups, refetchQueries]);

  const { create: createFollowup, saving: fuSaving } = useCreateFollowup(refetchAll);
  const { create: createQuery, saving: qSaving } = useCreateQuery(refetchAll);
  const { respond: respondToQuery, saving: rSaving } = useRespondToQuery(refetchAll);
  const { update: updateClaim, saving: uSaving } = useUpdateClaimDetail(refetchAll);
  const { settle: settleClaim, saving: sSaving } = useSettleClaim(refetchAll);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'queries'>('timeline');

  // Follow-up form
  const [ff, setFf] = useState({
    actionType: 'phone_call' as FollowupAction,
    contactedPerson: '', description: '', outcome: '', nextFollowupDate: '', amountPromised: '',
  });

  // Query form
  const [qf, setQf] = useState({
    queryType: 'document_request' as QueryType, description: '', raisedBy: '',
  });

  // Settlement form
  const [sf, setSf] = useState({
    settledAmount: '', tdsAmount: '0', disallowanceAmount: '0', settlementDate: '', settlementUtr: '',
  });

  // Respond form
  const [rf, setRf] = useState({ responseDescription: '' });

  // Staff list for reassign
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  React.useEffect(() => {
    const loadStaff = async () => {
      const { sb } = await import('@/lib/supabase/browser');
      if (!sb()) return;
      const { data } = await sb().from('hmis_staff').select('id, full_name').eq('is_active', true).order('full_name');
      setStaffList(data || []);
    };
    loadStaff();
  }, []);

  const handleSubmitFollowup = async () => {
    if (!ff.description.trim()) return;
    await createFollowup({
      claimId, actionType: ff.actionType, contactedPerson: ff.contactedPerson || undefined,
      description: ff.description, outcome: ff.outcome || undefined,
      nextFollowupDate: ff.nextFollowupDate || undefined,
      amountPromised: ff.amountPromised ? parseFloat(ff.amountPromised) : undefined,
      staffId,
    });
    setFf({ actionType: 'phone_call', contactedPerson: '', description: '', outcome: '', nextFollowupDate: '', amountPromised: '' });
    setActiveModal(null);
  };

  const handleSubmitQuery = async () => {
    if (!qf.description.trim()) return;
    await createQuery({
      claimId, queryType: qf.queryType, description: qf.description, raisedBy: qf.raisedBy || undefined, staffId,
    });
    setQf({ queryType: 'document_request', description: '', raisedBy: '' });
    setActiveModal(null);
  };

  const handleSettle = async () => {
    if (!sf.settledAmount || !sf.settlementDate || !sf.settlementUtr) return;
    await settleClaim(claimId, {
      settledAmount: parseFloat(sf.settledAmount), tdsAmount: parseFloat(sf.tdsAmount) || 0,
      disallowanceAmount: parseFloat(sf.disallowanceAmount) || 0,
      settlementDate: sf.settlementDate, settlementUtr: sf.settlementUtr, staffId,
    });
    setActiveModal(null);
  };

  const handleRespond = async () => {
    if (!respondingTo || !rf.responseDescription.trim()) return;
    await respondToQuery(respondingTo, { responseDescription: rf.responseDescription, staffId });
    setRf({ responseDescription: '' }); setRespondingTo(null); setActiveModal(null);
  };

  const handleEscalate = async () => {
    await updateClaim(claimId, { priority: 'critical' });
  };

  const handleReassign = async (newStaffId: string) => {
    await updateClaim(claimId, { assigned_to: newStaffId });
    setActiveModal(null);
  };

  const handleWriteOff = async () => {
    if (!confirm('Are you sure you want to write off this claim? This action cannot be undone.')) return;
    await updateClaim(claimId, { status: 'written_off', closure_reason: 'Written off by staff' });
    await createFollowup({
      claimId, actionType: 'write_off', description: 'Claim written off', staffId,
    });
  };

  if (loading) return <DetailSkeleton />;
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error} <button onClick={refetchClaim} className="underline cursor-pointer ml-1">Retry</button>
      </div>
    </div>
  );
  if (!claim) return (
    <div className="p-6 text-center text-gray-400">Claim not found</div>
  );

  const claimed = parseFloat(String(claim.claimed_amount)) || 0;
  const approved = parseFloat(String(claim.approved_amount)) || 0;
  const settled = parseFloat(String(claim.settled_amount)) || 0;
  const tds = parseFloat(String(claim.tds_amount)) || 0;
  const disallowance = parseFloat(String(claim.disallowance_amount)) || 0;
  const outstanding = claimed - settled - tds - disallowance;
  const settledPct = claimed > 0 ? Math.round((settled / claimed) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/collect" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{claim.claim_number || 'Claim Detail'}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_COLORS[claim.status] || 'bg-gray-100 text-gray-600'}`}>
              {claim.status?.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${PRIORITY_COLORS[claim.priority]}`}>
              {claim.priority}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${AGING_COLORS[claim.aging_bucket]}`}>
              {claim.aging_bucket} days ({claim.days_outstanding}d)
            </span>
          </div>
        </div>
        <button onClick={refetchAll}
          className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Main Layout: Left 60% + Right 40% on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Panel */}
        <div className="lg:col-span-3 space-y-5">
          {/* Claim Header Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={<User size={14} />} label="Patient"
                value={claim.patient ? `${claim.patient.first_name} ${claim.patient.last_name} (${claim.patient.uhid})` : '-'} />
              {claim.patient?.phone_primary && (
                <InfoRow icon={<Phone size={14} />} label="Phone" value={claim.patient.phone_primary} />
              )}
              <InfoRow icon={<Building2 size={14} />} label="Insurer" value={claim.insurer?.name || '-'} />
              <InfoRow icon={<Building2 size={14} />} label="TPA" value={claim.tpa?.name || '-'} />
              <InfoRow icon={<CreditCard size={14} />} label="Bill"
                value={claim.bill ? `${claim.bill.bill_number} (Net: ${fmtINR(parseFloat(String(claim.bill.net_amount)) || 0)})` : '-'} />
              <InfoRow icon={<Calendar size={14} />} label="Submitted" value={claim.submitted_at ? formatDate(claim.submitted_at) : '-'} />
              <InfoRow icon={<UserCheck size={14} />} label="Assigned To" value={claim.assigned_staff?.full_name || 'Unassigned'} />
              <InfoRow icon={<Calendar size={14} />} label="Next Follow-up"
                value={claim.next_followup_date ? formatDate(claim.next_followup_date) : 'Not set'} />
            </div>
          </div>

          {/* Financial Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Summary</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
              <FinBox label="Claimed" value={fmtINR(claimed)} />
              <FinBox label="Approved" value={approved ? fmtINR(approved) : '-'} />
              <FinBox label="Settled" value={settled ? fmtINR(settled) : '-'} color="text-emerald-600" />
              <FinBox label="TDS" value={tds ? fmtINR(tds) : '-'} />
              <FinBox label="Disallowance" value={disallowance ? fmtINR(disallowance) : '-'} color="text-red-600" />
              <FinBox label="Outstanding" value={fmtINR(outstanding)} color="text-amber-600" bold />
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Recovery Progress</span>
                <span>{settledPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${settledPct}%` }} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Log Follow-up" icon={<Phone size={14} />} primary onClick={() => setActiveModal('followup')} />
            <ActionButton label="Record Query" icon={<MessageSquare size={14} />} onClick={() => setActiveModal('query')} />
            <ActionButton label="Mark Settled" icon={<CheckCircle2 size={14} />} onClick={() => setActiveModal('settle')}
              disabled={claim.status === 'settled'} />
            <ActionButton label="Escalate" icon={<AlertTriangle size={14} />} onClick={handleEscalate}
              disabled={claim.priority === 'critical' || uSaving} />
            <ActionButton label="Reassign" icon={<UserCheck size={14} />} onClick={() => setActiveModal('reassign')} />
            <ActionButton label="Write Off" icon={<Ban size={14} />} variant="danger" onClick={handleWriteOff}
              disabled={claim.status === 'written_off' || claim.status === 'settled'} />
          </div>

          {/* Bottom — Queries Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Queries ({queries.length})</h3>
            </div>
            {qLoading ? <SkeletonRows /> : queries.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No queries recorded</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {queries.map((q, i) => (
                  <div key={q.id}>
                    <div className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setExpandedQuery(expandedQuery === q.id ? null : q.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                          <span className="text-xs text-gray-400">{formatDate(q.query_date)}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {QUERY_TYPE_LABELS[q.query_type] || q.query_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            q.status === 'open' ? 'bg-red-100 text-red-700' :
                            q.status === 'responded' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {q.status}
                          </span>
                          {q.days_to_respond !== null && (
                            <span className="text-xs text-gray-400">{q.days_to_respond}d to respond</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-1">{q.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {q.status === 'open' && (
                          <button onClick={e => { e.stopPropagation(); setRespondingTo(q.id); setActiveModal('respond'); }}
                            className="text-xs px-2 py-1 bg-teal-600 text-white rounded-md hover:bg-teal-700 cursor-pointer transition-colors duration-200">
                            Respond
                          </button>
                        )}
                        {expandedQuery === q.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {expandedQuery === q.id && (
                      <div className="px-4 pb-3 bg-gray-50/50 text-sm">
                        <div className="mb-2"><span className="text-xs font-medium text-gray-500">Query:</span> <span className="text-gray-700">{q.description}</span></div>
                        {q.raised_by && <div className="text-xs text-gray-400 mb-1">Raised by: {q.raised_by}</div>}
                        {q.response_description && (
                          <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-100">
                            <span className="text-xs font-medium text-green-700">Response ({q.response_date ? formatDate(q.response_date) : ''}):</span>
                            <p className="text-sm text-green-800 mt-1">{q.response_description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <button onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors duration-200 ${activeTab === 'timeline' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                Timeline
              </button>
              <button onClick={() => setActiveTab('queries')}
                className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors duration-200 ${activeTab === 'queries' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                Queries ({queries.length})
              </button>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {activeTab === 'timeline' && (
                fuLoading ? <SkeletonRows /> : followups.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">No follow-ups recorded yet</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {followups.map(fu => (
                      <TimelineEntry key={fu.id} followup={fu} />
                    ))}
                  </div>
                )
              )}

              {activeTab === 'queries' && (
                qLoading ? <SkeletonRows /> : queries.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">No queries</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {queries.map(q => (
                      <QueryTimelineEntry key={q.id} query={q}
                        onRespond={() => { setRespondingTo(q.id); setActiveModal('respond'); }} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- MODALS ---- */}

      {/* Follow-up Modal */}
      {activeModal === 'followup' && (
        <Modal title="Log Follow-up" onClose={() => setActiveModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Action Type</label>
              <select value={ff.actionType} onChange={e => setFf(p => ({ ...p, actionType: e.target.value as FollowupAction }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer">
                {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <FormInput label="Contacted Person" value={ff.contactedPerson} onChange={v => setFf(p => ({ ...p, contactedPerson: v }))} />
            <FormTextarea label="Description" value={ff.description} onChange={v => setFf(p => ({ ...p, description: v }))} required />
            <FormTextarea label="Outcome" value={ff.outcome} onChange={v => setFf(p => ({ ...p, outcome: v }))} />
            <FormInput label="Next Follow-up Date" type="date" value={ff.nextFollowupDate} onChange={v => setFf(p => ({ ...p, nextFollowupDate: v }))} />
            <FormInput label="Amount Promised" type="number" value={ff.amountPromised} onChange={v => setFf(p => ({ ...p, amountPromised: v }))} />
            <ModalFooter label="Save Follow-up" saving={fuSaving} disabled={!ff.description.trim()} onSubmit={handleSubmitFollowup} onCancel={() => setActiveModal(null)} />
          </div>
        </Modal>
      )}

      {/* Query Modal */}
      {activeModal === 'query' && (
        <Modal title="Record Query" onClose={() => setActiveModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Query Type</label>
              <select value={qf.queryType} onChange={e => setQf(p => ({ ...p, queryType: e.target.value as QueryType }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer">
                {Object.entries(QUERY_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <FormInput label="Raised By" value={qf.raisedBy} onChange={v => setQf(p => ({ ...p, raisedBy: v }))} placeholder="Person/dept who raised query" />
            <FormTextarea label="Description" value={qf.description} onChange={v => setQf(p => ({ ...p, description: v }))} required />
            <ModalFooter label="Record Query" saving={qSaving} disabled={!qf.description.trim()} onSubmit={handleSubmitQuery} onCancel={() => setActiveModal(null)} />
          </div>
        </Modal>
      )}

      {/* Settlement Modal */}
      {activeModal === 'settle' && (
        <Modal title="Mark Settled" onClose={() => setActiveModal(null)}>
          <div className="space-y-3">
            <FormInput label="Settlement Amount" type="number" value={sf.settledAmount} onChange={v => setSf(p => ({ ...p, settledAmount: v }))} required />
            <FormInput label="TDS Amount" type="number" value={sf.tdsAmount} onChange={v => setSf(p => ({ ...p, tdsAmount: v }))} />
            <FormInput label="Disallowance Amount" type="number" value={sf.disallowanceAmount} onChange={v => setSf(p => ({ ...p, disallowanceAmount: v }))} />
            {/* Auto-calculated write-off */}
            {sf.settledAmount && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Claimed</span><span>{fmtINR(claimed)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Settled</span><span className="text-emerald-600">{fmtINR(parseFloat(sf.settledAmount) || 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">TDS</span><span>{fmtINR(parseFloat(sf.tdsAmount) || 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Disallowance</span><span className="text-red-600">{fmtINR(parseFloat(sf.disallowanceAmount) || 0)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-medium">
                  <span className="text-gray-700">Write-off</span>
                  <span className="text-amber-600">
                    {fmtINR(claimed - (parseFloat(sf.settledAmount) || 0) - (parseFloat(sf.tdsAmount) || 0) - (parseFloat(sf.disallowanceAmount) || 0))}
                  </span>
                </div>
              </div>
            )}
            <FormInput label="Settlement Date" type="date" value={sf.settlementDate} onChange={v => setSf(p => ({ ...p, settlementDate: v }))} required />
            <FormInput label="Settlement UTR" value={sf.settlementUtr} onChange={v => setSf(p => ({ ...p, settlementUtr: v }))} required placeholder="Bank reference number" />
            <ModalFooter label="Confirm Settlement" saving={sSaving}
              disabled={!sf.settledAmount || !sf.settlementDate || !sf.settlementUtr}
              onSubmit={handleSettle} onCancel={() => setActiveModal(null)} />
          </div>
        </Modal>
      )}

      {/* Respond to Query Modal */}
      {activeModal === 'respond' && respondingTo && (
        <Modal title="Respond to Query" onClose={() => { setActiveModal(null); setRespondingTo(null); }}>
          <div className="space-y-3">
            <FormTextarea label="Response" value={rf.responseDescription}
              onChange={v => setRf(p => ({ ...p, responseDescription: v }))} required placeholder="Describe your response to this query..." />
            <ModalFooter label="Submit Response" saving={rSaving}
              disabled={!rf.responseDescription.trim()}
              onSubmit={handleRespond} onCancel={() => { setActiveModal(null); setRespondingTo(null); }} />
          </div>
        </Modal>
      )}

      {/* Reassign Modal */}
      {activeModal === 'reassign' && (
        <Modal title="Reassign Claim" onClose={() => setActiveModal(null)}>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {staffList.map(s => (
              <button key={s.id} onClick={() => handleReassign(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-teal-50 cursor-pointer transition-colors duration-200 ${
                  claim.assigned_to === s.id ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'
                }`}>
                {s.full_name} {claim.assigned_to === s.id && '(current)'}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Timeline Entry ----
function TimelineEntry({ followup }: { followup: ClaimFollowup }) {
  const iconMap: Record<string, React.ReactNode> = {
    phone_call: <Phone size={12} />,
    email_sent: <Mail size={12} />,
    email_received: <Mail size={12} />,
    portal_check: <Eye size={12} />,
    document_submitted: <FileText size={12} />,
    document_received: <FileText size={12} />,
    escalation: <AlertTriangle size={12} />,
    payment_received: <IndianRupee size={12} />,
    write_off: <Ban size={12} />,
    status_change: <RefreshCw size={12} />,
    note: <MessageSquare size={12} />,
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500 mt-0.5">
          {iconMap[followup.action_type] || <Clock size={12} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {ACTION_TYPE_LABELS[followup.action_type] || followup.action_type}
            </span>
            <span className="text-xs text-gray-400">{formatDateTime(followup.created_at)}</span>
          </div>
          {followup.contacted_person && (
            <div className="text-xs text-gray-400 mt-0.5">Contacted: {followup.contacted_person}</div>
          )}
          <p className="text-sm text-gray-700 mt-1">{followup.description}</p>
          {followup.outcome && (
            <p className="text-xs text-gray-500 mt-1">Outcome: {followup.outcome}</p>
          )}
          {followup.amount_promised && (
            <p className="text-xs text-emerald-600 mt-1">Amount promised: {fmtINR(followup.amount_promised)}</p>
          )}
          <div className="text-xs text-gray-400 mt-1">by {followup.staff?.full_name || 'Staff'}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Query Timeline Entry ----
function QueryTimelineEntry({ query, onRespond }: { query: ClaimQuery; onRespond: () => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          query.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}>
          <MessageSquare size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {QUERY_TYPE_LABELS[query.query_type] || query.query_type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              query.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>{query.status}</span>
            <span className="text-xs text-gray-400">{formatDate(query.query_date)}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{query.description}</p>
          {query.response_description && (
            <div className="mt-2 p-2 bg-green-50 rounded border border-green-100 text-xs text-green-800">
              <span className="font-medium">Response:</span> {query.response_description}
            </div>
          )}
          {query.status === 'open' && (
            <button onClick={onRespond}
              className="mt-2 text-xs px-2.5 py-1 bg-teal-600 text-white rounded-md hover:bg-teal-700 cursor-pointer transition-colors duration-200">
              Respond
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Reusable UI Pieces ----
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function FinBox({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm ${bold ? 'font-bold' : 'font-semibold'} ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function ActionButton({ label, icon, primary, variant, onClick, disabled }: {
  label: string; icon: React.ReactNode; primary?: boolean; variant?: 'danger';
  onClick?: () => void; disabled?: boolean;
}) {
  const cls = primary
    ? 'bg-teal-600 text-white hover:bg-teal-700'
    : variant === 'danger'
    ? 'border border-red-200 text-red-600 hover:bg-red-50'
    : 'border border-gray-200 text-gray-600 hover:bg-gray-50';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-40 ${cls}`}>
      {icon} {label}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors duration-200 text-lg">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
    </div>
  );
}

function FormTextarea({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" />
    </div>
  );
}

function ModalFooter({ label, saving, disabled, onSubmit, onCancel }: {
  label: string; saving: boolean; disabled: boolean; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onSubmit} disabled={disabled || saving}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer transition-colors duration-200">
        {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {label}
      </button>
      <button onClick={onCancel}
        className="px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors duration-200">
        Cancel
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-40" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32" />
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-80" />
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

export default function ClaimDetailPage() {
  return (
    <RoleGuard module="billing">
      <ClaimDetailInner />
    </RoleGuard>
  );
}
