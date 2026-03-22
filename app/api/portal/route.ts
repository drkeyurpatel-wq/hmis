// app/api/portal/route.ts
// Patient Portal API — OTP-based auth, data access for patients

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminSb() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function generateOTP(): string { return Math.floor(100000 + Math.random() * 900000).toString(); }
function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }

export async function POST(request: NextRequest) {
  const sb = adminSb();
  if (!sb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ============================================================
      // SEND OTP
      // ============================================================
      case 'send_otp': {
        const { phone } = body;
        if (!phone || phone.length < 10) return NextResponse.json({ error: 'Valid phone required' }, { status: 400 });
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);

        // Find patient by phone
        const { data: patient } = await sb.from('hmis_patients').select('id, first_name, phone_primary')
          .or(`phone_primary.ilike.%${cleanPhone}%`).eq('is_active', true).limit(1).single();
        if (!patient) return NextResponse.json({ error: 'No patient found with this phone number' }, { status: 404 });

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        await sb.from('hmis_portal_tokens').insert({
          patient_id: patient.id, phone: cleanPhone, otp_code: otp, otp_expires_at: expiresAt,
        });

        // Send OTP via WhatsApp Cloud API (if configured)
        const WHATSAPP_API = process.env.WHATSAPP_API_URL;
        const WHATSAPP_TOKEN = process.env.WHATSAPP_API_TOKEN;
        if (WHATSAPP_API && WHATSAPP_TOKEN) {
          try {
            await fetch(WHATSAPP_API, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: 'whatsapp', to: `91${cleanPhone}`,
                type: 'template', template: { name: 'otp_verification', language: { code: 'en' },
                  components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }] },
              }),
            });
          } catch { /* Silent fail — OTP still stored in DB for verification */ }
        } else {
        }

        return NextResponse.json({
          success: true,
          message: 'OTP sent to your phone',
          patientName: patient.first_name,
        });
      }

      // ============================================================
      // VERIFY OTP
      // ============================================================
      case 'verify_otp': {
        const { phone, otp } = body;
        if (!phone || !otp) return NextResponse.json({ error: 'Phone and OTP required' }, { status: 400 });
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);

        const { data: token } = await sb.from('hmis_portal_tokens')
          .select('*').eq('phone', cleanPhone).eq('otp_code', otp).eq('is_verified', false)
          .gte('otp_expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).single();

        if (!token) return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });

        const sessionToken = generateToken();
        const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24hr

        await sb.from('hmis_portal_tokens').update({
          is_verified: true, session_token: sessionToken, session_expires_at: sessionExpiry,
        }).eq('id', token.id);

        // Log access
        await sb.from('hmis_portal_access_log').insert({ patient_id: token.patient_id, action: 'login' });

        return NextResponse.json({ success: true, sessionToken, patientId: token.patient_id, expiresAt: sessionExpiry });
      }

      // ============================================================
      // FETCH PATIENT DATA (requires session token)
      // ============================================================
      case 'get_data': {
        const { sessionToken, dataType } = body;
        if (!sessionToken) return NextResponse.json({ error: 'Session token required' }, { status: 401 });

        // Validate session
        const { data: session } = await sb.from('hmis_portal_tokens')
          .select('patient_id').eq('session_token', sessionToken).eq('is_verified', true)
          .gte('session_expires_at', new Date().toISOString()).limit(1).single();
        if (!session) return NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });

        const pid = session.patient_id;

        switch (dataType) {
          case 'profile': {
            const { data } = await sb.from('hmis_patients')
              .select('id, uhid, first_name, last_name, age_years, gender, date_of_birth, blood_group, phone_primary, email, address_line1, city, pincode')
              .eq('id', pid).single();
            return NextResponse.json({ data });
          }

          case 'lab_reports': {
            const { data } = await sb.from('hmis_lab_orders')
              .select('id, test:hmis_lab_test_master(test_code, test_name), status, created_at, reported_at, results:hmis_lab_results(parameter_name, result_value, unit, normal_range_min, normal_range_max, is_abnormal, is_critical)')
              .eq('patient_id', pid).in('status', ['completed']).order('created_at', { ascending: false }).limit(20);
            await sb.from('hmis_portal_access_log').insert({ patient_id: pid, action: 'view_report' });
            return NextResponse.json({ data: data || [] });
          }

          case 'prescriptions': {
            const { data } = await sb.from('hmis_emr_encounters')
              .select('id, encounter_date, prescriptions, diagnoses, advice, follow_up, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
              .eq('patient_id', pid).order('encounter_date', { ascending: false }).limit(10);
            await sb.from('hmis_portal_access_log').insert({ patient_id: pid, action: 'view_prescription' });
            return NextResponse.json({ data: data || [] });
          }

          case 'bills': {
            const { data } = await sb.from('hmis_bills')
              .select('id, bill_date, gross_amount, discount, net_amount, paid_amount, balance, status, items:hmis_bill_items(description, quantity, unit_rate, amount)')
              .eq('patient_id', pid).order('bill_date', { ascending: false }).limit(20);
            await sb.from('hmis_portal_access_log').insert({ patient_id: pid, action: 'view_bill' });
            return NextResponse.json({ data: data || [] });
          }

          case 'vitals_history': {
            const { data } = await sb.from('hmis_vitals')
              .select('temperature, pulse, bp_systolic, bp_diastolic, resp_rate, spo2, weight_kg, blood_sugar, recorded_at')
              .eq('patient_id', pid).order('recorded_at', { ascending: false }).limit(30);
            await sb.from('hmis_portal_access_log').insert({ patient_id: pid, action: 'view_vitals' });
            return NextResponse.json({ data: data || [] });
          }

          case 'discharge_summaries': {
            const { data } = await sb.from('hmis_admissions')
              .select('id, ipd_number, admission_date, discharge_date, discharge_type, discharge_summary, department:hmis_departments(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
              .eq('patient_id', pid).not('discharge_date', 'is', null).order('discharge_date', { ascending: false }).limit(10);
            await sb.from('hmis_portal_access_log').insert({ patient_id: pid, action: 'view_discharge' });
            return NextResponse.json({ data: data || [] });
          }

          case 'appointments': {
            const { data } = await sb.from('hmis_portal_appointments')
              .select('*').eq('patient_id', pid).order('created_at', { ascending: false }).limit(10);
            return NextResponse.json({ data: data || [] });
          }

          default:
            return NextResponse.json({ error: 'Unknown dataType' }, { status: 400 });
        }
      }

      // ============================================================
      // BOOK APPOINTMENT
      // ============================================================
      case 'book_appointment': {
        const { sessionToken, preferredDate, preferredTime, department, doctorPreference, reason } = body;
        if (!sessionToken || !preferredDate) return NextResponse.json({ error: 'Session and date required' }, { status: 400 });

        const { data: session } = await sb.from('hmis_portal_tokens')
          .select('patient_id').eq('session_token', sessionToken).eq('is_verified', true)
          .gte('session_expires_at', new Date().toISOString()).limit(1).single();
        if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

        await sb.from('hmis_portal_appointments').insert({
          patient_id: session.patient_id, preferred_date: preferredDate,
          preferred_time: preferredTime, department, doctor_preference: doctorPreference, reason,
        });

        return NextResponse.json({ success: true, message: 'Appointment request submitted' });
      }

      // ============================================================
      // SUBMIT FEEDBACK
      // ============================================================
      case 'submit_feedback': {
        const { sessionToken, feedbackType, rating, message } = body;
        if (!sessionToken || !message) return NextResponse.json({ error: 'Session and message required' }, { status: 400 });

        const { data: session } = await sb.from('hmis_portal_tokens')
          .select('patient_id').eq('session_token', sessionToken).eq('is_verified', true)
          .gte('session_expires_at', new Date().toISOString()).limit(1).single();
        if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

        await sb.from('hmis_portal_feedback').insert({
          patient_id: session.patient_id, feedback_type: feedbackType || 'general', rating, message,
        });

        return NextResponse.json({ success: true, message: 'Thank you for your feedback' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[PORTAL]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
