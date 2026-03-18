// app/api/radiology/stradus-webhook/route.ts
// Receives radiology reports FROM Stradus PACS/RIS → stores in HMIS
//
// Stradus calls this endpoint when a radiologist finalizes or amends a report.
// Supports both HL7 ORU^R01 messages and JSON payloads.
//
// Endpoint: POST /api/radiology/stradus-webhook
// Headers:
//   Content-Type: application/hl7-v2 | application/json
//   X-Stradus-Signature: sha256=<hmac> (optional, for signature verification)
//   X-Stradus-Event: report.finalized | report.amended | report.addendum

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseHl7OruMessage, parseJsonReport, verifyWebhookSignature, type StradusReport } from '@/lib/radiology/stradus-client';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  try {
    const contentType = request.headers.get('content-type') || '';
    const event = request.headers.get('x-stradus-event') || 'report.finalized';
    const signature = request.headers.get('x-stradus-signature') || '';
    const rawBody = await request.text();

    // Optional signature verification
    const webhookSecret = process.env.STRADUS_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const valid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        console.error('[Stradus Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse the report based on content type
    let report: StradusReport | null = null;

    if (contentType.includes('hl7') || contentType.includes('text/plain')) {
      // HL7 ORU^R01 message
      report = parseHl7OruMessage(rawBody);
    } else if (contentType.includes('json')) {
      // JSON payload
      try {
        const json = JSON.parse(rawBody);
        report = parseJsonReport(json);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    } else {
      // Try JSON first, then HL7
      try {
        report = parseJsonReport(JSON.parse(rawBody));
      } catch {
        report = parseHl7OruMessage(rawBody);
      }
    }

    if (!report) {
      return NextResponse.json({ error: 'Could not parse report from payload' }, { status: 400 });
    }

    if (!report.accessionNumber && !report.studyInstanceUid) {
      return NextResponse.json({ error: 'Report must have accession number or study UID' }, { status: 400 });
    }

    console.log(`[Stradus Webhook] Received ${event}: accession=${report.accessionNumber}, study=${report.studyInstanceUid}, status=${report.reportStatus}`);

    // Find the matching radiology order
    let orderQuery = sb.from('hmis_radiology_orders').select('id, patient_id, status, accession_number');

    if (report.accessionNumber) {
      orderQuery = orderQuery.eq('accession_number', report.accessionNumber);
    } else if (report.studyInstanceUid) {
      orderQuery = orderQuery.eq('pacs_study_uid', report.studyInstanceUid);
    }

    const { data: orders, error: orderErr } = await orderQuery.limit(1);
    if (orderErr) {
      console.error('[Stradus Webhook] Order lookup error:', orderErr);
      return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      // Try matching by patient ID (UHID) + accession
      if (report.patientId) {
        const { data: patientOrders } = await sb.from('hmis_radiology_orders')
          .select('id, patient_id, status, accession_number, patient:hmis_patients!inner(uhid)')
          .eq('patient.uhid', report.patientId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (patientOrders && patientOrders.length > 0) {
          // Take the most recent unfinished order for this patient
          const match = patientOrders.find((o: any) => ['ordered', 'scheduled', 'in_progress'].includes(o.status));
          if (match) {
            orders?.push(match);
          }
        }
      }

      if (!orders || orders.length === 0) {
        console.warn(`[Stradus Webhook] No matching order found for accession=${report.accessionNumber}`);
        // Store as orphan report for manual matching later
        await sb.from('hmis_radiology_reports').insert({
          radiology_order_id: null as any, // Will need manual linking
          findings: report.findings,
          impression: report.impression,
          technique: report.technique,
          clinical_history: report.clinicalHistory,
          comparison: report.comparison,
          is_critical: report.isCritical,
          pacs_study_uid: report.studyInstanceUid || null,
          status: report.reportStatus === 'final' ? 'finalized' : report.reportStatus,
        }).then(({ error }) => {
          if (error) console.error('[Stradus Webhook] Orphan report insert error:', error);
        });

        return NextResponse.json({
          status: 'orphan',
          message: 'No matching order found. Report stored for manual matching.',
          accession: report.accessionNumber,
        }, { status: 202 });
      }
    }

    const order = orders[0];

    // Check if this is an addendum to an existing report
    const isAddendum = event === 'report.addendum' || report.reportStatus === 'addendum' || report.reportStatus === 'corrected';

    // Find existing report for this order
    const { data: existingReports } = await sb.from('hmis_radiology_reports')
      .select('id').eq('radiology_order_id', order.id).order('created_at', { ascending: false }).limit(1);

    // Find or create a "system" staff record for Stradus
    let reportedByStaffId: string | null = null;
    if (report.reportingRadiologist) {
      // Try to match by name
      const { data: staffMatch } = await sb.from('hmis_staff')
        .select('id').ilike('full_name', `%${report.reportingRadiologist}%`).limit(1);
      if (staffMatch?.[0]) reportedByStaffId = staffMatch[0].id;
    }

    // Build report record
    const reportData: any = {
      findings: report.findings,
      impression: report.impression,
      technique: report.technique || null,
      clinical_history: report.clinicalHistory || null,
      comparison: report.comparison || null,
      is_critical: report.isCritical,
      pacs_study_uid: report.studyInstanceUid || null,
      is_ai_assisted: false,
      status: report.reportStatus === 'final' ? 'finalized' : report.reportStatus === 'corrected' ? 'amended' : report.reportStatus,
    };

    if (reportedByStaffId) reportData.reported_by = reportedByStaffId;

    if (isAddendum && existingReports?.[0]) {
      // Add as addendum
      reportData.radiology_order_id = order.id;
      reportData.is_addendum = true;
      reportData.parent_report_id = existingReports[0].id;
      const { error: insErr } = await sb.from('hmis_radiology_reports').insert(reportData);
      if (insErr) {
        console.error('[Stradus Webhook] Addendum insert error:', insErr);
        return NextResponse.json({ error: 'Failed to store addendum' }, { status: 500 });
      }
    } else if (existingReports?.[0]) {
      // Update existing report
      const { error: updErr } = await sb.from('hmis_radiology_reports')
        .update(reportData).eq('id', existingReports[0].id);
      if (updErr) {
        console.error('[Stradus Webhook] Report update error:', updErr);
        return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
      }
    } else {
      // Insert new report
      reportData.radiology_order_id = order.id;
      reportData.is_addendum = false;
      if (!reportData.reported_by) {
        // Need a reported_by — use a system placeholder
        reportData.reported_by = reportedByStaffId; // May be null, handled by DB
      }
      const { error: insErr } = await sb.from('hmis_radiology_reports').insert(reportData);
      if (insErr) {
        console.error('[Stradus Webhook] Report insert error:', insErr);
        return NextResponse.json({ error: 'Failed to store report: ' + insErr.message }, { status: 500 });
      }
    }

    // Update order status + PACS study UID
    const orderUpdate: any = { updated_at: new Date().toISOString() };
    if (report.studyInstanceUid) orderUpdate.pacs_study_uid = report.studyInstanceUid;
    if (['ordered', 'scheduled', 'in_progress'].includes(order.status)) {
      orderUpdate.status = 'reported';
      orderUpdate.reported_at = new Date().toISOString();
      // Calculate TAT
      const { data: orderFull } = await sb.from('hmis_radiology_orders').select('created_at').eq('id', order.id).single();
      if (orderFull) orderUpdate.tat_minutes = Math.round((Date.now() - new Date(orderFull.created_at).getTime()) / 60000);
    }

    await sb.from('hmis_radiology_orders').update(orderUpdate).eq('id', order.id);

    // If critical finding, log it
    if (report.isCritical) {
      console.warn(`[Stradus Webhook] CRITICAL FINDING: order=${order.id}, accession=${report.accessionNumber}`);
      // Future: send notification to ordering physician
    }

    return NextResponse.json({
      status: 'ok',
      orderId: order.id,
      accession: report.accessionNumber,
      reportStatus: report.reportStatus,
      isCritical: report.isCritical,
    });

  } catch (err: any) {
    console.error('[Stradus Webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — health check and webhook info
export async function GET() {
  return NextResponse.json({
    service: 'Health1 HMIS Radiology Webhook',
    accepts: ['application/json', 'application/hl7-v2', 'text/plain'],
    events: ['report.finalized', 'report.amended', 'report.addendum'],
    headers: {
      'X-Stradus-Event': 'Event type (optional)',
      'X-Stradus-Signature': 'HMAC-SHA256 signature (optional)',
    },
    status: 'active',
  });
}
