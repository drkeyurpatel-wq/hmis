'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, Check, FlaskConical, Pill, CreditCard, BedDouble, AlertTriangle, Activity, Clock } from 'lucide-react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'lab_ready' | 'rx_pending' | 'payment' | 'admission' | 'discharge' | 'critical' | 'er' | 'opd_waiting' | 'overdue_med' | 'bed_available';
  title: string;
  message: string;
  href: string;
  icon: any;
  color: string;
  time: Date;
  read: boolean;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  lab_ready: { icon: FlaskConical, color: 'text-cyan-600 bg-cyan-50' },
  rx_pending: { icon: Pill, color: 'text-amber-600 bg-amber-50' },
  payment: { icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
  admission: { icon: BedDouble, color: 'text-purple-600 bg-purple-50' },
  discharge: { icon: BedDouble, color: 'text-teal-600 bg-teal-50' },
  critical: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  er: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  opd_waiting: { icon: Clock, color: 'text-amber-600 bg-amber-50' },
  overdue_med: { icon: Pill, color: 'text-red-600 bg-red-50' },
  bed_available: { icon: BedDouble, color: 'text-emerald-600 bg-emerald-50' },
};

export function NotificationBell() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!centreId || !sb()) return;
    const today = new Date().toISOString().split('T')[0];
    const ts = today + 'T00:00:00';
    const items: Notification[] = [];

    try {
      const [labReady, rxPending, erActive, opdWaiting] = await Promise.all([
        sb().from('hmis_lab_orders').select('id, test_name, patient:hmis_patients!inner(first_name, last_name), created_at')
          .eq('centre_id', centreId).eq('status', 'completed').gte('created_at', ts).order('created_at', { ascending: false }).limit(5),
        sb().from('hmis_pharmacy_dispensing').select('id, created_at, patient:hmis_patients!inner(first_name, last_name)')
          .eq('centre_id', centreId).eq('status', 'pending').limit(5),
        sb().from('hmis_er_visits').select('id, triage_category, patient:hmis_patients!inner(first_name, last_name), arrival_time')
          .eq('centre_id', centreId).in('status', ['triaged', 'being_seen']).gte('arrival_time', ts).limit(5),
        sb().from('hmis_opd_visits').select('id, token_number, created_at, patient:hmis_patients!inner(first_name, last_name)')
          .eq('centre_id', centreId).eq('status', 'waiting').gte('created_at', ts).limit(5),
      ]);

      (labReady.data || []).forEach((l: any) => items.push({
        id: `lab-${l.id}`, type: 'lab_ready', title: 'Lab Result Ready',
        message: `${l.test_name || 'Test'} for ${l.patient?.first_name} ${l.patient?.last_name}`,
        href: '/lab', icon: FlaskConical, color: 'text-cyan-600 bg-cyan-50',
        time: new Date(l.created_at), read: false,
      }));

      (rxPending.data || []).forEach((r: any) => items.push({
        id: `rx-${r.id}`, type: 'rx_pending', title: 'Rx Pending Dispensing',
        message: `${r.patient?.first_name} ${r.patient?.last_name}`,
        href: '/pharmacy', icon: Pill, color: 'text-amber-600 bg-amber-50',
        time: new Date(r.created_at), read: false,
      }));

      (erActive.data || []).forEach((e: any) => items.push({
        id: `er-${e.id}`, type: 'er', title: `ER — ${(e.triage_category || '').toUpperCase()}`,
        message: `${e.patient?.first_name} ${e.patient?.last_name}`,
        href: '/emergency', icon: AlertTriangle, color: 'text-red-600 bg-red-50',
        time: new Date(e.arrival_time), read: false,
      }));

      (opdWaiting.data || []).forEach((o: any) => {
        const waitMin = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
        if (waitMin > 30) items.push({
          id: `opd-${o.id}`, type: 'opd_waiting', title: 'OPD Long Wait',
          message: `${o.patient?.first_name} waiting ${waitMin}m`,
          href: '/opd', icon: Clock, color: 'text-amber-600 bg-amber-50',
          time: new Date(o.created_at), read: false,
        });
      });
    } catch {}

    items.sort((a, b) => b.time.getTime() - a.time.getTime());
    setNotifications(items);
    setUnread(items.filter(n => !n.read).length);
  }, [centreId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => { const t = setInterval(loadNotifications, 30000); return () => clearInterval(t); }, [loadNotifications]);

  // Realtime
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('notif-bell-' + centreId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_lab_orders', filter: `centre_id=eq.${centreId}` }, loadNotifications)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_er_visits', filter: `centre_id=eq.${centreId}` }, loadNotifications)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_pharmacy_dispensing', filter: `centre_id=eq.${centreId}` }, loadNotifications)
      .subscribe();
    return () => sb().removeChannel(ch);
  }, [centreId, loadNotifications]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const timeAgo = (d: Date) => {
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
        <Bell size={18} className="text-gray-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
              {unread > 0 && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">{unread} new</span>}
            </div>
            {unread > 0 && <button onClick={markAllRead} className="text-[10px] text-teal-600 font-medium hover:text-teal-800">Mark all read</button>}
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">All clear</div>
            ) : notifications.map(n => {
              const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.lab_ready;
              const Icon = tc.icon;
              return (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-teal-50/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tc.color.split(' ')[1]}`}>
                    <Icon size={14} className={tc.color.split(' ')[0]} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">{n.message}</div>
                  </div>
                  <span className="text-[9px] text-gray-400 shrink-0 mt-0.5">{timeAgo(n.time)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
