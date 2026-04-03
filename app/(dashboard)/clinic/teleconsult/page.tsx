'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { RoleGuard } from '@/components/ui/shared';
import {
  Video, Clock, Users, CheckCircle, RefreshCw,
  ExternalLink, Heart, Activity,
} from 'lucide-react';

interface TeleconsultSlot {
  id: string;
  appointment_time: string | null;
  appointment_date: string;
  type: string;
  status: string;
  notes: string | null;
  patient?: { first_name: string; last_name: string; uhid: string };
  doctor?: { full_name: string; specialisation: string | null };
}

export default function TeleconsultPage() {
  return <RoleGuard module="clinic_teleconsult"><TeleconsultInner /></RoleGuard>;
}

function TeleconsultInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [slots, setSlots] = useState<TeleconsultSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    if (!centreId) return;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const client = sb();
      const { data } = await client
        .from('hmis_appointments')
        .select('id, appointment_time, appointment_date, type, status, notes, patient:hmis_patients(first_name, last_name, uhid), doctor:hmis_staff!doctor_id(full_name, specialisation)')
        .eq('centre_id', centreId)
        .eq('type', 'referral')
        .gte('appointment_date', today)
        .lte('appointment_date', today + 'T23:59:59')
        .order('appointment_time', { ascending: true });
      setSlots((data as any) || []);
      setLoading(false);
    };
    load();
  }, [centreId]);

  const markComplete = async (slotId: string) => {
    const client = sb();
    await client.from('hmis_appointments').update({ status: 'completed' }).eq('id', slotId);
    setSlots(slots.map(s => s.id === slotId ? { ...s, status: 'completed' } : s));
    setActiveSession(null);
  };

  const completedCount = slots.filter(s => s.status === 'completed').length;
  const pendingCount = slots.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length;

  return (
    <div className="overflow-x-auto w-full max-w-[1280px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Teleconsult Station</h1>
          <p className="text-sm text-gray-500">Video consultations with hub hospital specialists</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{pendingCount}</div>
          <div className="text-[11px] text-gray-500 font-medium">Pending Today</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
          <div className="text-[11px] text-gray-500 font-medium">Completed</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users size={16} className="text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{slots.length}</div>
          <div className="text-[11px] text-gray-500 font-medium">Total Scheduled</div>
        </div>
      </div>

      {/* Active Session */}
      {activeSession && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-blue-800">Session Active</span>
            </div>
            <button onClick={() => markComplete(activeSession)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer">
              <CheckCircle size={14} className="inline mr-1.5" />
              End Session
            </button>
          </div>
          <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
            <div className="text-center">
              <Video size={48} className="text-white/30 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Video session in progress</p>
              <p className="text-white/30 text-xs mt-1">
                Connect via your preferred video platform (Google Meet / Daily.co)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700">Today&apos;s Teleconsult Schedule</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin text-gray-300 mx-auto" size={20} />
          </div>
        ) : slots.length === 0 ? (
          <div className="p-8 text-center">
            <Video size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No teleconsult sessions scheduled today</p>
            <p className="text-xs text-gray-300 mt-1">
              Teleconsult appointments appear here when booked via the patient app or OPD.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {slots.map((slot) => {
              const isComplete = slot.status === 'completed';
              const isCancelled = slot.status === 'cancelled';
              return (
                <div key={slot.id} className={`px-4 py-3 flex items-center gap-3 ${isComplete ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-gray-400 w-12 shrink-0">
                    {slot.appointment_time?.slice(0, 5) || '--:--'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">
                      {(slot.patient as any)?.first_name} {(slot.patient as any)?.last_name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{(slot.patient as any)?.uhid}</span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      with Dr. {(slot.doctor as any)?.full_name}
                      {(slot.doctor as any)?.specialisation && ` — ${(slot.doctor as any).specialisation}`}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isComplete ? 'bg-green-100 text-green-700' :
                    isCancelled ? 'bg-gray-100 text-gray-500' :
                    slot.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {slot.status.replace('_', ' ')}
                  </span>
                  {!isComplete && !isCancelled && (
                    <button
                      onClick={() => setActiveSession(slot.id)}
                      disabled={!!activeSession}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                      <Video size={12} className="inline mr-1" />
                      Start
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-bold text-gray-600 mb-2">How Teleconsult Works</h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>1. Patient arrives at clinic for scheduled teleconsult appointment</li>
          <li>2. Nurse records vitals and prepares the patient</li>
          <li>3. Click &quot;Start Session&quot; to connect with the hub specialist via video</li>
          <li>4. Doctor at hub examines via video and creates prescription in HMIS</li>
          <li>5. Prescription auto-routes to clinic pharmacy for dispensing</li>
          <li>6. Click &quot;End Session&quot; when consultation is complete</li>
        </ul>
      </div>
    </div>
  );
}
