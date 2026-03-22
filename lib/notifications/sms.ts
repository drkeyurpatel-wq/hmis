// lib/notifications/sms.ts
// MSG91 SMS gateway integration for Health1 HMIS
// API docs: https://docs.msg91.com/reference/send-sms
//
// Configuration: Store in hmis_integration_config or .env:
//   MSG91_AUTH_KEY (from MSG91 dashboard)
//   MSG91_SENDER_ID (6-char DLT-registered sender, e.g. HELTH1)
//   MSG91_ROUTE (4 = transactional, 1 = promotional)

import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const MSG91_API = 'https://control.msg91.com/api/v5/flow/';

// ============================================================
// CONFIG LOADER — from DB or env
// ============================================================
interface MSG91Config {
  authKey: string;
  senderId: string;
}

async function getConfig(): Promise<MSG91Config | null> {
  // Try DB first
  if (sb()) {
    const { data } = await sb()
      .from('hmis_integration_config')
      .select('config_json')
      .eq('provider', 'msg91')
      .eq('is_active', true)
      .maybeSingle();
    if (data?.config_json) {
      const cfg = data.config_json;
      if (cfg.auth_key && cfg.sender_id) {
        return { authKey: cfg.auth_key, senderId: cfg.sender_id };
      }
    }
  }
  // Fallback to env
  const authKey = process.env.MSG91_AUTH_KEY || '';
  const senderId = process.env.MSG91_SENDER_ID || 'HELTH1';
  if (!authKey) return null;
  return { authKey, senderId };
}

// ============================================================
// PHONE FORMATTING
// ============================================================
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  if (cleaned.startsWith('0')) cleaned = '91' + cleaned.slice(1);
  return cleaned;
}

// ============================================================
// CORE SEND — MSG91 Flow API
// ============================================================
export async function sendSMS(
  phone: string,
  templateId: string,
  variables: Record<string, string>
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const config = await getConfig();
  if (!config) {
    console.warn('[SMS] MSG91 not configured. Set MSG91_AUTH_KEY in environment or hmis_integration_config. Recipient:', phone, 'Template:', templateId);
    return { success: false, error: 'MSG91 not configured. Set MSG91_AUTH_KEY in environment or hmis_integration_config.' };
  }

  try {
    const body = {
      template_id: templateId,
      short_url: '0',
      recipients: [{
        mobiles: formatPhone(phone),
        ...variables,
      }],
    };

    const response = await fetch(MSG91_API, {
      method: 'POST',
      headers: {
        'authkey': config.authKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.type === 'success' || data.message === 'success') {
      return { success: true, requestId: data.request_id };
    }
    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// SMS TEMPLATE IDs — register these in MSG91 DLT portal
// ============================================================
// Store template IDs in hmis_integration_config.config_json.templates
// or use these defaults (replace with real DLT-approved template IDs)
const DEFAULT_TEMPLATES: Record<string, string> = {
  appointment_reminder: 'h1_sms_appointment',
  lab_ready: 'h1_sms_lab_ready',
  pharmacy_ready: 'h1_sms_pharmacy_ready',
  discharge_summary: 'h1_sms_discharge',
  payment_receipt: 'h1_sms_payment',
  opd_token: 'h1_sms_opd_token',
  follow_up_reminder: 'h1_sms_followup',
  otp: 'h1_sms_otp',
};

async function getTemplateId(eventType: string): Promise<string> {
  if (sb()) {
    const { data } = await sb()
      .from('hmis_integration_config')
      .select('config_json')
      .eq('provider', 'msg91')
      .eq('is_active', true)
      .maybeSingle();
    if (data?.config_json?.templates?.[eventType]) {
      return data.config_json.templates[eventType];
    }
  }
  return DEFAULT_TEMPLATES[eventType] || eventType;
}

// ============================================================
// TEMPLATE MESSAGE SENDERS
// ============================================================

export async function smsAppointmentReminder(phone: string, patientName: string, doctorName: string, date: string, time: string, centreName: string) {
  const templateId = await getTemplateId('appointment_reminder');
  return sendSMS(phone, templateId, {
    patient_name: patientName, doctor_name: doctorName,
    date, time, centre_name: centreName,
  });
}

export async function smsLabReady(phone: string, patientName: string, testNames: string, collectionPoint: string) {
  const templateId = await getTemplateId('lab_ready');
  return sendSMS(phone, templateId, {
    patient_name: patientName, test_names: testNames, collection_point: collectionPoint,
  });
}

export async function smsPharmacyReady(phone: string, patientName: string, medicineCount: string, pharmacyCounter: string) {
  const templateId = await getTemplateId('pharmacy_ready');
  return sendSMS(phone, templateId, {
    patient_name: patientName, medicine_count: medicineCount, pharmacy_counter: pharmacyCounter,
  });
}

export async function smsDischargeAlert(phone: string, patientName: string, ipdNumber: string, dischargeDate: string, followUpDate: string) {
  const templateId = await getTemplateId('discharge_summary');
  return sendSMS(phone, templateId, {
    patient_name: patientName, ipd_number: ipdNumber,
    discharge_date: dischargeDate, follow_up_date: followUpDate,
  });
}

export async function smsPaymentReceipt(phone: string, patientName: string, receiptNumber: string, amount: string, paymentMode: string) {
  const templateId = await getTemplateId('payment_receipt');
  return sendSMS(phone, templateId, {
    patient_name: patientName, receipt_number: receiptNumber,
    amount, payment_mode: paymentMode,
  });
}

export async function smsOPDToken(phone: string, patientName: string, tokenNumber: string, doctorName: string, estimatedWait: string) {
  const templateId = await getTemplateId('opd_token');
  return sendSMS(phone, templateId, {
    patient_name: patientName, token_number: tokenNumber,
    doctor_name: doctorName, estimated_wait: estimatedWait,
  });
}

export async function smsFollowUpReminder(phone: string, patientName: string, doctorName: string, date: string, centreName: string, advice: string) {
  const templateId = await getTemplateId('follow_up_reminder');
  return sendSMS(phone, templateId, {
    patient_name: patientName, doctor_name: doctorName,
    date, centre_name: centreName, advice,
  });
}

export async function smsOTP(phone: string, otp: string) {
  const templateId = await getTemplateId('otp');
  return sendSMS(phone, templateId, { otp });
}
