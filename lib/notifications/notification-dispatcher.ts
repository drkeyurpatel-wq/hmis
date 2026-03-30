// lib/notifications/notification-dispatcher.ts
// Multi-channel dispatcher with proper result tracking
// Notifications should never block clinical workflow — all errors are caught and logged.

import { sendAppointmentReminder, sendOPDTokenConfirmation, sendLabResultsReady, sendPharmacyReady, sendDischargeAlert, sendPaymentReceipt, sendFollowUpReminder } from './whatsapp';
import { smsAppointmentReminder, smsOPDToken, smsLabReady, smsPharmacyReady, smsDischargeAlert, smsPaymentReceipt, smsFollowUpReminder } from './sms';
import { type NotificationResult } from './notification-status';
import { sb } from '@/lib/supabase/browser';

interface DispatchResult {
  whatsapp?: NotificationResult;
  sms?: NotificationResult;
  anySuccess: boolean;
}

// ── Channel preference check ──
async function getEnabledChannels(centreId: string | undefined, eventType: string): Promise<{ whatsapp: boolean; sms: boolean }> {
  const defaults = { whatsapp: true, sms: false };
  if (!centreId || !sb()) return defaults;
  const { data } = await sb().from('hmis_notification_templates').select('whatsapp_enabled, sms_enabled')
    .eq('centre_id', centreId).eq('event_type', eventType).eq('is_active', true).maybeSingle();
  if (data) return { whatsapp: data.whatsapp_enabled ?? true, sms: data.sms_enabled ?? false };
  return defaults;
}

async function dispatch(centreId: string | undefined, eventType: string,
  waFn: () => Promise<NotificationResult>,
  smsFn: () => Promise<NotificationResult>,
): Promise<DispatchResult> {
  const channels = await getEnabledChannels(centreId, eventType);
  const result: DispatchResult = { anySuccess: false };

  if (channels.whatsapp) {
    try { result.whatsapp = await waFn(); if (result.whatsapp.success) result.anySuccess = true; } catch { result.whatsapp = { channel: 'whatsapp', success: false, error: 'Dispatch exception', timestamp: new Date().toISOString() }; }
  }
  if (channels.sms) {
    try { result.sms = await smsFn(); if (result.sms.success) result.anySuccess = true; } catch { result.sms = { channel: 'sms', success: false, error: 'Dispatch exception', timestamp: new Date().toISOString() }; }
  }
  return result;
}

// ── Public API ──

export async function notifyAppointmentReminder(centreId: string | undefined, phone: string, name: string, date: string, time: string, doctor: string) {
  return dispatch(centreId, 'appointment_reminder',
    () => sendAppointmentReminder(phone, name, date, time, doctor, centreId),
    () => smsAppointmentReminder(phone, name, date, time, doctor, centreId));
}
export async function notifyOPDToken(centreId: string | undefined, phone: string, name: string, token: string, doctor: string) {
  return dispatch(centreId, 'opd_token',
    () => sendOPDTokenConfirmation(phone, name, token, doctor, centreId),
    () => smsOPDToken(phone, name, token, doctor, centreId));
}
export async function notifyLabReady(centreId: string | undefined, phone: string, name: string, test: string) {
  return dispatch(centreId, 'lab_ready',
    () => sendLabResultsReady(phone, name, test, centreId),
    () => smsLabReady(phone, name, test, centreId));
}
export async function notifyPharmacyReady(centreId: string | undefined, phone: string, name: string) {
  return dispatch(centreId, 'pharmacy_ready',
    () => sendPharmacyReady(phone, name, centreId),
    () => smsPharmacyReady(phone, name, centreId));
}
export async function notifyDischarge(centreId: string | undefined, phone: string, name: string) {
  return dispatch(centreId, 'discharge_summary',
    () => sendDischargeAlert(phone, name, centreId),
    () => smsDischargeAlert(phone, name, centreId));
}
export async function notifyPaymentReceipt(centreId: string | undefined, phone: string, name: string, amount: string, billNo: string) {
  return dispatch(centreId, 'payment_receipt',
    () => sendPaymentReceipt(phone, name, amount, billNo, centreId),
    () => smsPaymentReceipt(phone, name, amount, billNo, centreId));
}
export async function notifyFollowUp(centreId: string | undefined, phone: string, name: string, date: string, doctor: string) {
  return dispatch(centreId, 'follow_up_reminder',
    () => sendFollowUpReminder(phone, name, date, doctor, centreId),
    () => smsFollowUpReminder(phone, name, date, doctor, centreId));
}
