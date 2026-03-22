// lib/notifications/notification-dispatcher.ts
// Multi-channel dispatcher: checks hmis_notification_preferences then sends via WhatsApp + SMS.
// Silent-fail: notifications should never block clinical workflow.

import {
  sendDischargeAlert,
  sendLabResultsReady,
  sendPharmacyReady,
  sendOPDTokenConfirmation,
  sendPaymentReceipt,
  sendAppointmentReminder,
  sendFollowUpReminder,
} from './whatsapp';

import {
  smsDischargeAlert,
  smsLabReady,
  smsPharmacyReady,
  smsOPDToken,
  smsPaymentReceipt,
  smsAppointmentReminder,
  smsFollowUpReminder,
} from './sms';

import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

async function safe(fn: () => Promise<any>): Promise<void> {
  try { await fn(); } catch (e) { console.warn('[NOTIFY]', e); }
}

// ============================================================
// PREFERENCE CHECK — which channels are enabled for this event?
// ============================================================
async function getEnabledChannels(centreId: string | undefined, eventType: string): Promise<{ whatsapp: boolean; sms: boolean }> {
  const defaults = { whatsapp: true, sms: false };
  if (!centreId || !sb()) return defaults;

  const { data } = await sb()
    .from('hmis_notification_preferences')
    .select('channel, is_enabled')
    .eq('centre_id', centreId)
    .eq('event_type', eventType);

  if (!data || data.length === 0) return defaults;

  const channels = { whatsapp: true, sms: false };
  for (const row of data) {
    if (row.channel === 'whatsapp') channels.whatsapp = row.is_enabled;
    if (row.channel === 'sms') channels.sms = row.is_enabled;
  }
  return channels;
}

// ---- CLINICAL EVENT DISPATCHERS ----

export async function notifyDischarge(params: {
  phone: string; patientName: string; ipdNumber: string;
  dischargeDate: string; followUpDate?: string; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'discharge_summary');
  if (ch.whatsapp) await safe(() => sendDischargeAlert(
    params.phone, params.patientName, params.ipdNumber,
    params.dischargeDate, params.followUpDate || 'As advised',
  ));
  if (ch.sms) await safe(() => smsDischargeAlert(
    params.phone, params.patientName, params.ipdNumber,
    params.dischargeDate, params.followUpDate || 'As advised',
  ));
}

export async function notifyLabResults(params: {
  phone: string; patientName: string; testNames: string[]; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'lab_ready');
  if (ch.whatsapp) await safe(() => sendLabResultsReady(
    params.phone, params.patientName,
    params.testNames.join(', '), 'Lab Reception',
  ));
  if (ch.sms) await safe(() => smsLabReady(
    params.phone, params.patientName,
    params.testNames.join(', '), 'Lab Reception',
  ));
}

export async function notifyPharmacyReady(params: {
  phone: string; patientName: string; medicineCount: number; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'pharmacy_ready');
  if (ch.whatsapp) await safe(() => sendPharmacyReady(
    params.phone, params.patientName,
    String(params.medicineCount), 'Pharmacy Counter',
  ));
  if (ch.sms) await safe(() => smsPharmacyReady(
    params.phone, params.patientName,
    String(params.medicineCount), 'Pharmacy Counter',
  ));
}

export async function notifyOPDToken(params: {
  phone: string; patientName: string; tokenNumber: string;
  doctorName: string; estimatedWait: string; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'opd_token');
  if (ch.whatsapp) await safe(() => sendOPDTokenConfirmation(
    params.phone, params.patientName, params.tokenNumber,
    params.doctorName, params.estimatedWait,
  ));
  if (ch.sms) await safe(() => smsOPDToken(
    params.phone, params.patientName, params.tokenNumber,
    params.doctorName, params.estimatedWait,
  ));
}

export async function notifyPayment(params: {
  phone: string; patientName: string; receiptNumber: string;
  amount: number; paymentMode: string; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'payment_receipt');
  const amtStr = `₹${Math.round(params.amount).toLocaleString('en-IN')}`;
  if (ch.whatsapp) await safe(() => sendPaymentReceipt(
    params.phone, params.patientName, params.receiptNumber,
    amtStr, params.paymentMode,
  ));
  if (ch.sms) await safe(() => smsPaymentReceipt(
    params.phone, params.patientName, params.receiptNumber,
    amtStr, params.paymentMode,
  ));
}

export async function notifyAppointmentReminder(params: {
  phone: string; patientName: string; doctorName: string;
  date: string; time: string; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'appointment_reminder');
  const centre = 'Health1 Super Speciality Hospital';
  if (ch.whatsapp) await safe(() => sendAppointmentReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, params.time, centre,
  ));
  if (ch.sms) await safe(() => smsAppointmentReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, params.time, centre,
  ));
}

export async function notifyFollowUp(params: {
  phone: string; patientName: string; doctorName: string;
  date: string; advice?: string; centreId?: string;
}): Promise<void> {
  if (!params.phone) return;
  const ch = await getEnabledChannels(params.centreId, 'follow_up_reminder');
  const centre = 'Health1 Super Speciality Hospital';
  if (ch.whatsapp) await safe(() => sendFollowUpReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, centre, params.advice || '',
  ));
  if (ch.sms) await safe(() => smsFollowUpReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, centre, params.advice || '',
  ));
}
