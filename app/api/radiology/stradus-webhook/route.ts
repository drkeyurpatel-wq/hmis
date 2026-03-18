// app/api/radiology/stradus-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processStradusReport } from '@/lib/radiology/stradus-client';

// Stradus calls this endpoint when:
// 1. A new study is acquired (images stored)
// 2. A report is finalized
// 3. A report is verified
// 4. A report is amended
//
// Configure in Stradus: Settings → Integration → Webhook URL:
// https://hmis-brown.vercel.app/api/radiology/stradus-webhook
//
// Expected payload format (JSON):
// {
//   "event": "study_acquired" | "report_finalized" | "report_verified" | "report_amended",
//   "accessionNumber": "RAD-260318-0001",
//   "studyInstanceUID": "1.2.840.113619...",
//   "patientId": "SHJ-240001",
//   "modality": "CT",
//   "studyDescription": "CT Brain Plain",
//   "studyDate": "2026-03-18",
//   "seriesCount": 3,
//   "imageCount": 156,
//   "viewerUrl": "https://your-stradus.com/viewer?StudyInstanceUID=1.2.840...",
//   "report": {                          // only for report events
//     "findings": "...",
//     "impression": "...",
//     "technique": "...",
//     "clinicalHistory": "...",
//     "comparison": "...",
//     "isCritical": false,
//     "criticalValue": null,
//     "reportedBy": "Dr. Radiologist Name",
//     "reportedAt": "2026-03-18T14:30:00Z",
//     "verifiedBy": "Dr. Verifier Name",   // only for verified
//     "verifiedAt": "2026-03-18T15:00:00Z",
//     "status": "final",
//     "stradusReportId": "RPT-12345",
//     "rawText": "Full unstructured report text..."
//   }
// }

const WEBHOOK_SECRET = process.env.STRADUS_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // Verify webhook secret if configured
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get('x-webhook-secret') || req.headers.get('authorization');
    if (!authHeader || !authHeader.includes(WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await req.json();

    if (!body.accessionNumber) {
      return NextResponse.json({ error: 'accessionNumber is required' }, { status: 400 });
    }

    const result = await processStradusReport({
      accessionNumber: body.accessionNumber,
      studyInstanceUID: body.studyInstanceUID,
      patientId: body.patientId,
      modality: body.modality,
      studyDescription: body.studyDescription,
      studyDate: body.studyDate,
      seriesCount: body.seriesCount,
      imageCount: body.imageCount,
      viewerUrl: body.viewerUrl,
      report: body.report,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      studyId: result.studyId,
      reportId: result.reportId,
      message: body.report ? 'Study and report processed' : 'Study processed',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error: ' + err.message }, { status: 500 });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Health1 HMIS Radiology — Stradus Webhook Receiver',
    endpoints: {
      webhook: 'POST /api/radiology/stradus-webhook',
      events: ['study_acquired', 'report_finalized', 'report_verified', 'report_amended'],
    },
  });
}
