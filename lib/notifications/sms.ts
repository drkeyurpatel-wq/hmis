// lib/notifications/sms.ts
// MSG91 SMS integration — hardened for production
// Config: hmis_integration_config (provider='msg91') or env vars

import { createClient } from '@/lib/supabase/client';
import { validatePhone, type NotificationResult, logNotification } from './notification-status';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const MSG91_API = 'https://control.msg91.com/api/v5/flow/';

interface MSG91Config { authKey: string; senderId: string; }

async function getConfig(): Promise<MSG91Config | null> {
  if (sb()) {
    const { data } = await sb()!.from('hmis_integration_config').select('config_json')
      .eq('provider', 'msg91').eq('is_active', true).maybeSingle();
    if (data?.config_json?.auth_key && data?.config_json?.sender_id) {
      return { authKey: data.config_json.auth_key, senderId: data.config_json.sender_id };
    }
  }
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  if (authKey && senderId) return { authKey, senderId };
  return null;
}

async function sendSMS(phone: string, templateId: string, variables: Record<string, string>, centreId?: string): Promise<NotificationResult> {
  const result: NotificationResult = { channel: 'sms', success: false, timestamp: new Date().toISOString() };

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    result.error = phoneCheck.error; result.errorCode = 'invalid_phone';
    return result;
  }

  const config = await getConfig();
  if (!config) {
    result.error = 'MSG91 not configured. Set MSG91_AUTH_KEY + MSG91_SENDER_ID in env or hmis_integration_config.';
    result.errorCode = 'not_configured';
    return result;
  }

  try {
    const body: any = { flow_id: templateId, sender: config.senderId, mobiles: phoneCheck.formatted, ...variables };
    const res = await fetch(MSG91_API, {
      method: 'POST',
      headers: { authkey: config.authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      result.success = true;
      result.messageId = data.request_id || data.message;
    } else {
      const errText = await res.text().catch(() => 'Unknown');
      result.error = `MSG91 ${res.status}: ${errText}`;
      result.errorCode = res.status === 429 ? 'rate_limited' : 'api_error';
    }
  } catch (e: any) {
    result.error = e.message || 'Network error';
    result.errorCode = 'network_error';
  }

  if (centreId) logNotification(sb(), centreId, { phone: phoneCheck.formatted, channel: 'sms', event_type: templateId, template_name: templateId, result });
  return result;
}

// ── Event-specific wrappers ──

export async function smsAppointmentReminder(phone: string, name: string, date: string, time: string, doctor: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_APPOINTMENT || 'appointment_reminder', { name, date, time, doctor }, centreId);
}
export async function smsOPDToken(phone: string, name: string, token: string, doctor: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_OPD_TOKEN || 'opd_token', { name, token, doctor }, centreId);
}
export async function smsLabReady(phone: string, name: string, test: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_LAB_READY || 'lab_ready', { name, test }, centreId);
}
export async function smsPharmacyReady(phone: string, name: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_PHARMACY_READY || 'pharmacy_ready', { name }, centreId);
}
export async function smsDischargeAlert(phone: string, name: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_DISCHARGE || 'discharge_alert', { name }, centreId);
}
export async function smsPaymentReceipt(phone: string, name: string, amount: string, billNo: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_PAYMENT || 'payment_receipt', { name, amount, bill_no: billNo }, centreId);
}
export async function smsFollowUpReminder(phone: string, name: string, date: string, doctor: string, centreId?: string) {
  return sendSMS(phone, process.env.MSG91_TPL_FOLLOWUP || 'follow_up', { name, date, doctor }, centreId);
}
