// lib/notifications/whatsapp.ts
// WhatsApp Business API integration for Health1
// Supports: appointment reminders, lab results ready, discharge alerts, payment receipts
//
// Configuration: Set these in Supabase environment or .env:
//   WHATSAPP_API_URL (e.g., https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages)
//   WHATSAPP_ACCESS_TOKEN (from Meta Business Suite)
//   WHATSAPP_PHONE_ID (WhatsApp Business Phone Number ID)

const WHATSAPP_API = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

interface WhatsAppMessage {
  to: string;           // phone number with country code (e.g., 919876543210)
  templateName: string;
  templateParams: string[];
  language?: string;
}

// ============================================================
// CORE SEND FUNCTION
// ============================================================
async function sendWhatsAppTemplate(msg: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_API || !WHATSAPP_TOKEN) {
    console.log('[WhatsApp] Not configured — message would be sent to:', msg.to, 'Template:', msg.templateName, 'Params:', msg.templateParams);
    return { success: false, error: 'WhatsApp API not configured. Set WHATSAPP_API_URL and WHATSAPP_ACCESS_TOKEN in environment.' };
  }

  try {
    const response = await fetch(WHATSAPP_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(msg.to),
        type: 'template',
        template: {
          name: msg.templateName,
          language: { code: msg.language || 'en' },
          components: [{
            type: 'body',
            parameters: msg.templateParams.map(p => ({ type: 'text', text: p })),
          }],
        },
      }),
    });

    const data = await response.json();
    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || 'Unknown error' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// PHONE FORMATTING
// ============================================================
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  // If 10 digits, prepend 91 (India)
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  // Remove leading 0
  if (cleaned.startsWith('0')) cleaned = '91' + cleaned.slice(1);
  return cleaned;
}

// ============================================================
// TEMPLATE MESSAGES
// ============================================================

// Template: h1_appointment_reminder
// Params: patient_name, doctor_name, date, time, centre_name
export async function sendAppointmentReminder(phone: string, patientName: string, doctorName: string, date: string, time: string, centreName: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_appointment_reminder',
    templateParams: [patientName, doctorName, date, time, centreName],
  });
}

// Template: h1_opd_token
// Params: patient_name, token_number, doctor_name, estimated_wait
export async function sendOPDTokenConfirmation(phone: string, patientName: string, tokenNumber: string, doctorName: string, estimatedWait: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_opd_token',
    templateParams: [patientName, tokenNumber, doctorName, estimatedWait],
  });
}

// Template: h1_lab_results_ready
// Params: patient_name, test_names, collection_point
export async function sendLabResultsReady(phone: string, patientName: string, testNames: string, collectionPoint: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_lab_results_ready',
    templateParams: [patientName, testNames, collectionPoint],
  });
}

// Template: h1_discharge_alert
// Params: patient_name, ipd_number, discharge_date, follow_up_date
export async function sendDischargeAlert(phone: string, patientName: string, ipdNumber: string, dischargeDate: string, followUpDate: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_discharge_alert',
    templateParams: [patientName, ipdNumber, dischargeDate, followUpDate],
  });
}

// Template: h1_payment_receipt
// Params: patient_name, receipt_number, amount, payment_mode
export async function sendPaymentReceipt(phone: string, patientName: string, receiptNumber: string, amount: string, paymentMode: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_payment_receipt',
    templateParams: [patientName, receiptNumber, amount, paymentMode],
  });
}

// Template: h1_pharmacy_ready
// Params: patient_name, medicine_count, pharmacy_counter
export async function sendPharmacyReady(phone: string, patientName: string, medicineCount: string, pharmacyCounter: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_pharmacy_ready',
    templateParams: [patientName, medicineCount, pharmacyCounter],
  });
}

// Template: h1_follow_up_reminder
// Params: patient_name, doctor_name, date, centre_name, advice
export async function sendFollowUpReminder(phone: string, patientName: string, doctorName: string, date: string, centreName: string, advice: string) {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: 'h1_follow_up_reminder',
    templateParams: [patientName, doctorName, date, centreName, advice],
  });
}

// ============================================================
// PLAIN TEXT FALLBACK (for testing without approved templates)
// ============================================================
export async function sendPlainMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!WHATSAPP_API || !WHATSAPP_TOKEN) {
    console.log('[WhatsApp] Plain msg to', phone, ':', message);
    return { success: false, error: 'Not configured' };
  }

  try {
    const response = await fetch(WHATSAPP_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(phone),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await response.json();
    return data.messages?.[0]?.id ? { success: true } : { success: false, error: data.error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// BATCH SEND (for daily appointment reminders)
// ============================================================
export async function sendBatchReminders(
  appointments: { phone: string; patientName: string; doctorName: string; date: string; time: string; centreName: string }[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const appt of appointments) {
    const result = await sendAppointmentReminder(appt.phone, appt.patientName, appt.doctorName, appt.date, appt.time, appt.centreName);
    if (result.success) sent++;
    else { failed++; if (result.error) errors.push(`${appt.patientName}: ${result.error}`); }
    // Rate limit: 1 msg per 100ms
    await new Promise(r => setTimeout(r, 100));
  }

  return { sent, failed, errors };
}

// ============================================================
// TEMPLATE REGISTRATION GUIDE
// ============================================================
// Register these templates in Meta Business Suite → WhatsApp Manager → Message Templates:
//
// 1. h1_appointment_reminder (Utility)
//    "Hello {{1}}, this is a reminder for your appointment with {{2}} on {{3}} at {{4}} at {{5}}. Please arrive 15 minutes early."
//
// 2. h1_opd_token (Utility)
//    "Hello {{1}}, your OPD token is {{2}}. You will see {{3}}. Estimated wait: {{4}}."
//
// 3. h1_lab_results_ready (Utility)
//    "Hello {{1}}, your lab results for {{2}} are ready. Please collect from {{3}}."
//
// 4. h1_discharge_alert (Utility)
//    "Hello {{1}}, patient with IPD# {{2}} is being discharged on {{3}}. Follow-up on {{4}}."
//
// 5. h1_payment_receipt (Utility)
//    "Hello {{1}}, payment received. Receipt: {{2}}, Amount: Rs.{{3}}, Mode: {{4}}. Thank you."
//
// 6. h1_pharmacy_ready (Utility)
//    "Hello {{1}}, your {{2}} medicines are ready for pickup at {{3}}."
//
// 7. h1_follow_up_reminder (Utility)
//    "Hello {{1}}, reminder: your follow-up with {{2}} is on {{3}} at {{4}}. {{5}}"
