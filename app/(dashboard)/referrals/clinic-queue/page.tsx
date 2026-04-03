'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { RoleGuard } from '@/components/ui/shared';
import {
  ArrowUpRight, RefreshCw, CheckCircle, XCircle, Clock,
  Calendar, AlertTriangle, Building2, Filter,
} from 'lucide-react';
import type { ClinicReferral, ClinicReferralStatus } from '@/types/database';

const STATUS_CONFIG: Record<ClinicReferralStatus, { label: string; color: string }> = {
  referred: { label: 'Pending', color: 'bg-blue-100 text-blue-700' },
  appointment_created: { label: 'Appointment Created', color: 'bg-teal-100 text-teal-700' },
  patient_visited: { label: 'Patient Visited', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700' },
};

export default function ClinicReferralQueuePage() {
  return <RoleGuard module="referrals"><ClinicReferralQueueInner /></RoleGuard>;
}

function ClinicReferralQueueInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [referrals, setReferrals] = useState<ClinicReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('referred');
  const [creating, setCreating] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const client = sb();
    let query = client
      .from('hmis_clinic_referrals')
      .select(`
        *,
        patient:hmis_patients(first_name, last_name, uhid, phone_primary, gender, age_years),
        from_centre:hmis_centres!from_centre_id(name, code),
        referred_by_staff:hmis_staff!referred_by(full_name)
      `)
      .eq('to_centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data } = await query;
    setReferrals((data as any) || []);
    setLoading(false);
  }, [centreId, statusFilter]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const handleCreateAppointment = async (referralId: string) => {
    setCreating(referralId);
    const client = sb();
    await client.from('hmis_clinic_referrals').update({
      status: 'appointment_created',
      appointment_created: true,
      accepted_by: staff?.id,
    }).eq('id', referralId);
    loadReferrals();
    setCreating(null);
  };

  const handleDecline = async (referralId: string) => {
    const reason = prompt('Reason for declining:');
    if (!reason) return;
    const client = sb();
    await client.from('hmis_clinic_referrals').update({
      status: 'cancelled',
    }).eq('id', referralId);
    loadReferrals();
  };

  const pendingCount = referrals.filter(r => r.status === 'referred').length;

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clinic Referrals Queue</h1>
          <p className="text-sm text-gray-500">Referrals from spoke clinics requiring action</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              <Clock size={13} /> {pendingCount} pending
            </div>
          )}
          <button onClick={loadReferrals} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
            statusFilter === 'all' ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
          }`}>All</button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === key ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
            }`}>{cfg.label}</button>
        ))}
      </div>

      {/* Referral list */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} />
        </div>
      ) : referrals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <CheckCircle size={40} className="mx-auto text-teal-400 mb-3" />
          <h2 className="text-base font-bold text-gray-700">No referrals in queue</h2>
          <p className="text-sm text-gray-400 mt-1">Clinic referrals will appear here when received.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map((ref) => {
            const statusCfg = STATUS_CONFIG[ref.status];
            const isActionable = ref.status === 'referred';
            return (
              <div key={ref.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                ref.urgency === 'emergency' ? 'border-red-200 ring-2 ring-red-100' :
                ref.urgency === 'urgent' ? 'border-amber-200' : 'border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    ref.urgency === 'emergency' ? 'bg-red-100' :
                    ref.urgency === 'urgent' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    <ArrowUpRight size={18} className={
                      ref.urgency === 'emergency' ? 'text-red-600' :
                      ref.urgency === 'urgent' ? 'text-amber-600' : 'text-blue-600'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">
                        {(ref.patient as any)?.first_name} {(ref.patient as any)?.last_name}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{(ref.patient as any)?.uhid}</span>
                      {(ref.patient as any)?.gender && (
                        <span className="text-xs text-gray-400 capitalize">{(ref.patient as any).gender}, {(ref.patient as any).age_years}y</span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {ref.urgency !== 'routine' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ref.urgency === 'emergency' ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-white'
                        }`}>
                          {ref.urgency.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 mt-1 font-medium">{ref.reason}</p>
                    {ref.clinical_notes && (
                      <p className="text-xs text-gray-500 mt-1">{ref.clinical_notes}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {(ref.from_centre as any)?.name || 'Clinic'}
                      </span>
                      {ref.department && <span>&middot; {ref.department}</span>}
                      <span>&middot; Dr. {(ref.referred_by_staff as any)?.full_name || 'Unknown'}</span>
                      <span>&middot; {new Date(ref.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {ref.vitals_at_referral && (
                      <div className="flex gap-3 mt-2 text-xs text-gray-500">
                        {(ref.vitals_at_referral as any).bp && <span>BP: {(ref.vitals_at_referral as any).bp}</span>}
                        {(ref.vitals_at_referral as any).pulse && <span>Pulse: {(ref.vitals_at_referral as any).pulse}</span>}
                        {(ref.vitals_at_referral as any).temp && <span>Temp: {(ref.vitals_at_referral as any).temp}</span>}
                        {(ref.vitals_at_referral as any).spo2 && <span>SpO2: {(ref.vitals_at_referral as any).spo2}</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isActionable && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleCreateAppointment(ref.id)}
                        disabled={creating === ref.id}
                        className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer">
                        <Calendar size={12} className="inline mr-1" />
                        {creating === ref.id ? 'Creating...' : 'Create Appointment'}
                      </button>
                      <button onClick={() => handleDecline(ref.id)}
                        className="px-3 py-1.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer">
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
