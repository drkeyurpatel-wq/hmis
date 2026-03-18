// app/api/radiology/link-study/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { linkStudyManually } from '@/lib/radiology/stradus-client';

// POST: Manually link a Stradus study URL to a patient
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ['centreId', 'patientId', 'accessionNumber', 'modality', 'studyDescription', 'studyDate', 'stradusUrl'];
    const missing = required.filter(f => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing fields: ${missing.join(', ')}` }, { status: 400 });
    }

    const result = await linkStudyManually({
      centreId: body.centreId,
      patientId: body.patientId,
      accessionNumber: body.accessionNumber,
      modality: body.modality,
      studyDescription: body.studyDescription,
      studyDate: body.studyDate,
      stradusUrl: body.stradusUrl,
      studyInstanceUid: body.studyInstanceUid,
      orderId: body.orderId,
      admissionId: body.admissionId,
      referringDoctorId: body.referringDoctorId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, studyId: result.studyId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
