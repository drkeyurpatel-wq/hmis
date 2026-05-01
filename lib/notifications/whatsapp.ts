// lib/notifications/whatsapp.ts
// WhatsApp Business API integration — hardened for production
// Config: env WHATSAPP_API_URL + WHATSAPP_ACCESS_TOKEN

import { validatePhone, type NotificationResult, logNotification } from './notification-status';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as never; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function getConfig(): { apiUrl: string; token: string } | null {
  const apiUrl = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || process.env.WHATSAPP_API_URL || '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
  if (!apiUrl || !token) return null;
  return { apiUrl, token };
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/[\s\-\(\)+]/g, '');
  if (clean.length === 10) return `91${clean}`;
  return clean;
}

async function sendTemplate(phone: string, templateName: string, params: string[], language: string = 'en', centreId?: string): Promise<NotificationResult> {
  const result: NotificationResult = { channel: 'whatsapp', success: false, timestamp: new Date().toISOString() };

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    result.error = phoneCheck.error; result.errorCode = 'invalid_phone';
    return result;
  }

  const config = getConfig();
  if (!config) {
    result.error = 'WhatsApp API not configured. Set WHATSAPP_API_URL + WHATSAPP_ACCESS_TOKEN.';
    result.errorCode = 'not_configured';
    return result;
  }

  try {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneCheck.formatted,
        type: 'template',
        template: {
          name: templateName, language: { code: language },
          components: params.length > 0 ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: p })) }] : [],
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      result.success = true;
      result.messageId = data.messages?.[0]?.id;
    } else {
      const err = await res.json().catch(() => ({ error: { message: 'Unknown' } }));
      result.error = `WhatsApp ${res.status}: ${err.error?.message || 'Unknown error'}`;
      result.errorCode = res.status === 429 ? 'rate_limited' : 'api_error';
    }
  } catch (e: any) {
    result.error = e.message || 'Network error';
    result.errorCode = 'network_error';
  }

  if (centreId) logNotification(sb(), centreId, { phone: phoneCheck.formatted, channel: 'whatsapp', event_type: templateName, template_name: templateName, result });
  return result;
}

// ── Event-specific wrappers ──

export async function sendAppointmentReminder(phone: string, name: string, date: string, time: string, doctor: string, centreId?: string) {
  return sendTemplate(phone, 'appointment_reminder', [name, date, time, doctor], 'en', centreId);
}
export async function sendOPDTokenConfirmation(phone: string, name: string, token: string, doctor: string, centreId?: string) {
  return sendTemplate(phone, 'opd_token_confirmation', [name, token, doctor], 'en', centreId);
}
export async function sendLabResultsReady(phone: string, name: string, test: string, centreId?: string) {
  return sendTemplate(phone, 'lab_results_ready', [name, test], 'en', centreId);
}
export async function sendPharmacyReady(phone: string, name: string, centreId?: string) {
  return sendTemplate(phone, 'pharmacy_ready', [name], 'en', centreId);
}
export async function sendDischargeAlert(phone: string, name: string, centreId?: string) {
  return sendTemplate(phone, 'discharge_alert', [name], 'en', centreId);
}
export async function sendPaymentReceipt(phone: string, name: string, amount: string, billNo: string, centreId?: string) {
  return sendTemplate(phone, 'payment_receipt', [name, amount, billNo], 'en', centreId);
}
export async function sendFollowUpReminder(phone: string, name: string, date: string, doctor: string, centreId?: string) {
  return sendTemplate(phone, 'follow_up_reminder', [name, date, doctor], 'en', centreId);
}
