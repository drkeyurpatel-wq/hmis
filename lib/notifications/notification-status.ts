// lib/notifications/notification-status.ts
// Standardized notification result type — no silent failures

export type NotificationChannel = 'sms' | 'whatsapp' | 'email' | 'push';

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: 'not_configured' | 'invalid_phone' | 'rate_limited' | 'api_error' | 'template_not_found' | 'network_error';
  timestamp: string;
}

export interface NotificationLog {
  patient_id?: string;
  phone: string;
  channel: NotificationChannel;
  event_type: string;
  template_name?: string;
  result: NotificationResult;
}

// Validate Indian phone number
export function validatePhone(phone: string): { valid: boolean; formatted: string; error?: string } {
  const clean = phone.replace(/[\s\-\(\)+]/g, '');
  if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
    return { valid: true, formatted: `91${clean}` };
  }
  if (clean.length === 12 && clean.startsWith('91') && /^91[6-9]\d{9}$/.test(clean)) {
    return { valid: true, formatted: clean };
  }
  return { valid: false, formatted: clean, error: `Invalid Indian phone: ${phone}` };
}

// Log notification to DB (fire-and-forget)
export async function logNotification(sb: any, centreId: string, log: NotificationLog): Promise<void> {
  if (!sb) return;
  try {
    await sb.from('hmis_notification_log').insert({
      centre_id: centreId,
      patient_id: log.patient_id || null,
      channel: log.channel,
      event_type: log.event_type,
      recipient: log.phone,
      template_name: log.template_name || null,
      status: log.result.success ? 'sent' : 'failed',
      error_message: log.result.error || null,
      external_id: log.result.messageId || null,
      sent_at: log.result.timestamp,
    });
  } catch { /* logging should never throw */ }
}
