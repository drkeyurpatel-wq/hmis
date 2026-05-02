// app/api/alerts/check/route.ts
// Server-side alert scanner — scans for overdue meds and deteriorating patients
// Can be called by Vercel Cron or manually from admin

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminSb() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Inline the server-side alert generators (can't use client imports in API routes)

async function scanOverdueMeds(sb: any, centreId: string) {
  const alerts: any[] = [];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: overdue } = await sb
    .from('hmis_mar')
    .select('id, admission_id, scheduled_time, med:hmis_ipd_medication_orders!inner(drug_name, dose, admission:hmis_admissions!inner(centre_id, patient_id, patient:hmis_patients!inner(first_name, last_name)))')
    .eq('med.admission.centre_id', centreId)
    .eq('status', 'scheduled')
    .lte('scheduled_time', twoHoursAgo)
    .limit(50);

  if (!overdue) return alerts;

  for (const m of overdue) {
    const pt = m.med?.admission?.patient;
    const patientName = pt ? `${pt.first_name} ${pt.last_name || ''}`.trim() : 'Patient';
    alerts.push({
      centre_id: centreId,
      patient_id: m.med?.admission?.patient_id,
      admission_id: m.admission_id,
      alert_type: 'overdue_med',
      severity: 'warning',
      title: `Overdue Med: ${m.med?.drug_name} — ${patientName}`,
      description: `${m.med?.drug_name} ${m.med?.dose} was due at ${new Date(m.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} but not administered`,
      data: { drug: m.med?.drug_name, dose: m.med?.dose, scheduledTime: m.scheduled_time, marId: m.id },
    });
  }
  return alerts;
}

async function scanDeterioration(sb: any, centreId: string) {
  const alerts: any[] = [];

  const { data: admissions } = await sb
    .from('hmis_admissions')
    .select('id, patient_id, patient:hmis_patients!inner(first_name, last_name)')
    .eq('centre_id', centreId)
    .eq('status', 'active')
    .limit(100);

  if (!admissions) return alerts;

  for (const adm of admissions) {
    const { data: vitals } = await sb
      .from('hmis_icu_charts')
      .select('hr, bp_sys, spo2, recorded_at')
      .eq('admission_id', adm.id)
      .order('recorded_at', { ascending: false })
      .limit(3);

    if (!vitals || vitals.length < 3) continue;

    const [v1, v2, v3] = vitals;
    const reasons: string[] = [];

    if (v1.hr && v2.hr && v3.hr && v1.hr > v2.hr && v2.hr > v3.hr && v1.hr > 110)
      reasons.push(`HR rising: ${v3.hr}→${v2.hr}→${v1.hr}`);
    if (v1.bp_sys && v2.bp_sys && v3.bp_sys && v1.bp_sys < v2.bp_sys && v2.bp_sys < v3.bp_sys && v1.bp_sys < 100)
      reasons.push(`BP falling: ${v3.bp_sys}→${v2.bp_sys}→${v1.bp_sys}`);
    if (v1.spo2 && v2.spo2 && v3.spo2 && v1.spo2 < v2.spo2 && v2.spo2 < v3.spo2 && v1.spo2 < 94)
      reasons.push(`SpO2 falling: ${v3.spo2}→${v2.spo2}→${v1.spo2}`);

    if (reasons.length > 0) {
      const patientName = `${adm.patient?.first_name} ${adm.patient?.last_name || ''}`.trim();
      alerts.push({
        centre_id: centreId,
        patient_id: adm.patient_id,
        admission_id: adm.id,
        alert_type: 'deteriorating',
        severity: 'critical',
        title: `Deteriorating — ${patientName}`,
        description: reasons.join('; '),
        data: { vitals: vitals.map((v: any) => ({ hr: v.hr, bp_sys: v.bp_sys, spo2: v.spo2, at: v.recorded_at })) },
      });
    }
  }
  return alerts;
}

async function persistAlerts(sb: any, alerts: any[]): Promise<number> {
  if (alerts.length === 0) return 0;
  let created = 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  for (const a of alerts) {
    const { data: existing } = await sb
      .from('hmis_clinical_alerts')
      .select('id')
      .eq('patient_id', a.patient_id)
      .eq('alert_type', a.alert_type)
      .eq('status', 'active')
      .gte('created_at', oneHourAgo)
      .limit(1);

    if (existing && existing.length > 0) continue;
    await sb.from('hmis_clinical_alerts').insert(a);
    created++;
  }
  return created;
}

export async function GET(request: NextRequest) {
  // Accept either user auth or CRON_SECRET for Vercel cron
  const cronSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const isCron = cronSecret === process.env.CRON_SECRET && process.env.CRON_SECRET;
  const { error: authError } = isCron ? { error: null } : await requireAuth(request);
  if (authError) return authError;

  const sb = adminSb();
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  try {
    // Get all active centres
    const { data: centres } = await sb.from('hmis_centres').select('id, name').eq('is_active', true);
    if (!centres) return NextResponse.json({ error: 'No centres found' }, { status: 404 });

    let totalCreated = 0;
    const results: any[] = [];

    for (const centre of centres) {
      const medAlerts = await scanOverdueMeds(sb, centre.id);
      const detAlerts = await scanDeterioration(sb, centre.id);
      const all = [...medAlerts, ...detAlerts];
      const created = await persistAlerts(sb, all);
      totalCreated += created;
      results.push({ centre: centre.name, scanned: all.length, created });
    }

    return NextResponse.json({
      success: true,
      totalCreated,
      centres: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[ALERTS] Scan error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
