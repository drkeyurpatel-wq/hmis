// app/api/notify/route.ts
// WhatsApp notification API — dispatches templates based on event type
// Checks hmis_notification_preferences to see if the event is enabled for the centre

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  sendAppointmentReminder,
  sendLabResultsReady,
  sendPharmacyReady,
  sendDischargeAlert,
} from '@/lib/notifications/whatsapp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminSb() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

type EventType = 'appointment_reminder' | 'lab_ready' | 'pharmacy_ready' | 'discharge_summary';

const VALID_TYPES: EventType[] = ['appointment_reminder', 'lab_ready', 'pharmacy_ready', 'discharge_summary'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, phone, data, centre_id } = body as {
      type: EventType;
      phone: string;
      data: Record<string, any>;
      centre_id?: string;
    };

    // Validate required fields
    if (!type || !phone || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, phone, data' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate phone — at least 10 digits
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Check notification preferences if centre_id provided
    if (centre_id) {
      const sb = adminSb();
      if (sb) {
        const { data: pref } = await sb
          .from('hmis_notification_preferences')
          .select('is_enabled')
          .eq('centre_id', centre_id)
          .eq('event_type', type)
          .eq('channel', 'whatsapp')
          .maybeSingle();

        if (pref && !pref.is_enabled) {
          return NextResponse.json(
            { success: false, skipped: true, reason: 'Notification disabled for this centre/event' },
            { status: 200 }
          );
        }
      }
    }

    // Dispatch to the appropriate WhatsApp template
    let result: { success: boolean; messageId?: string; error?: string };

    switch (type) {
      case 'appointment_reminder':
        result = await sendAppointmentReminder(
          phone,
          data.patient_name || 'Patient',
          data.date || '',
          data.time || '',
          data.doctor_name || 'Doctor',
          centre_id
        );
        break;

      case 'lab_ready':
        result = await sendLabResultsReady(
          phone,
          data.patient_name || 'Patient',
          Array.isArray(data.test_names) ? data.test_names.join(', ') : (data.test_names || ''),
          centre_id
        );
        break;

      case 'pharmacy_ready':
        result = await sendPharmacyReady(
          phone,
          data.patient_name || 'Patient',
          centre_id
        );
        break;

      case 'discharge_summary':
        result = await sendDischargeAlert(
          phone,
          data.patient_name || 'Patient',
          centre_id
        );
        break;

      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    }

    // Log to DB
    const sb = adminSb();
    if (sb) {
      await sb.from('hmis_notification_log').insert({
        centre_id: centre_id || null,
        event_type: type,
        channel: 'whatsapp',
        phone: cleanPhone,
        status: result.success ? 'sent' : 'failed',
        message_id: result.messageId || null,
        error_message: result.error || null,
      }).then(() => {});  // fire-and-forget
    }

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
  } catch (err: any) {
    console.error('[notify] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
