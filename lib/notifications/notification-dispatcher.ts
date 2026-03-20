// lib/notifications/notification-dispatcher.ts
// Calls the right WhatsApp template for each clinical event.
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

async function safe(fn: () => Promise<any>): Promise<void> {
  try { await fn(); } catch (e) { console.warn('[NOTIFY]', e); }
}

// ---- CLINICAL EVENT DISPATCHERS ----

export async function notifyDischarge(params: {
  phone: string; patientName: string; ipdNumber: string;
  dischargeDate: string; followUpDate?: string;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendDischargeAlert(
    params.phone, params.patientName, params.ipdNumber,
    params.dischargeDate, params.followUpDate || 'As advised',
  ));
}

export async function notifyLabResults(params: {
  phone: string; patientName: string; testNames: string[];
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendLabResultsReady(
    params.phone, params.patientName,
    params.testNames.join(', '), 'Lab Reception',
  ));
}

export async function notifyPharmacyReady(params: {
  phone: string; patientName: string; medicineCount: number;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendPharmacyReady(
    params.phone, params.patientName,
    String(params.medicineCount), 'Pharmacy Counter',
  ));
}

export async function notifyOPDToken(params: {
  phone: string; patientName: string; tokenNumber: string;
  doctorName: string; estimatedWait: string;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendOPDTokenConfirmation(
    params.phone, params.patientName, params.tokenNumber,
    params.doctorName, params.estimatedWait,
  ));
}

export async function notifyPayment(params: {
  phone: string; patientName: string; receiptNumber: string;
  amount: number; paymentMode: string;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendPaymentReceipt(
    params.phone, params.patientName, params.receiptNumber,
    `₹${Math.round(params.amount).toLocaleString('en-IN')}`, params.paymentMode,
  ));
}

export async function notifyAppointmentReminder(params: {
  phone: string; patientName: string; doctorName: string;
  date: string; time: string;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendAppointmentReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, params.time, 'Health1 Super Speciality Hospital',
  ));
}

export async function notifyFollowUp(params: {
  phone: string; patientName: string; doctorName: string;
  date: string; advice?: string;
}): Promise<void> {
  if (!params.phone) return;
  await safe(() => sendFollowUpReminder(
    params.phone, params.patientName, params.doctorName,
    params.date, 'Health1 Super Speciality Hospital', params.advice || '',
  ));
}
