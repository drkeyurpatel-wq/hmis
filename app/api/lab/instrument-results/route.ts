// app/api/lab/instrument-results/route.ts
// Inbound API: Mindray BC-5000 (or any HL7/ASTM instrument) sends results → HMIS stores
import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getDb() { return createClient(supabaseUrl, supabaseKey); }

// HL7 v2.3.1 ORU^R01 parser (Mindray BC-5000 format)
function parseHL7(raw: string): { patientId: string; sampleId: string; results: any[] } | null {
  try {
    const segments = raw.split(/\r?\n/).filter(Boolean);
    let patientId = ''; let sampleId = '';
    const results: any[] = [];

    for (const seg of segments) {
      const fields = seg.split('|');
      const type = fields[0];

      if (type === 'PID') {
        patientId = fields[3]?.split('^')[0] || ''; // PID-3: Patient ID (UHID)
      }
      if (type === 'OBR') {
        sampleId = fields[3]?.split('^')[0] || ''; // OBR-3: Filler Order Number (barcode)
      }
      if (type === 'OBX') {
        // OBX-3: Observation ID, OBX-5: Value, OBX-6: Units, OBX-7: Ref Range, OBX-8: Abnormal flag
        const obsId = fields[3]?.split('^')[0] || '';
        const obsName = fields[3]?.split('^')[1] || obsId;
        const value = fields[5] || '';
        const unit = fields[6] || '';
        const refRange = fields[7] || '';
        const flag = fields[8] || ''; // H=High, L=Low, HH=Critical High, LL=Critical Low, N=Normal

        if (value) {
          results.push({
            parameterCode: obsId, parameterName: obsName,
            value, unit, referenceRange: refRange,
            flag, isAbnormal: ['H', 'L', 'A'].includes(flag),
            isCritical: ['HH', 'LL', 'CC'].includes(flag),
          });
        }
      }
    }

    return patientId || sampleId ? { patientId, sampleId, results } : null;
  } catch { return null; }
}

// ASTM/LIS2-A2 parser (alternative format from some Mindray models)
function parseASTM(raw: string): { patientId: string; sampleId: string; results: any[] } | null {
  try {
    const records = raw.split(/\r?\n/).filter(Boolean);
    let patientId = ''; let sampleId = '';
    const results: any[] = [];

    for (const rec of records) {
      const type = rec.charAt(0);
      const fields = rec.substring(2).split('|');

      if (type === 'P') { // Patient record
        patientId = fields[2]?.split('^')[0] || '';
      }
      if (type === 'O') { // Order record
        sampleId = fields[1]?.split('^')[0] || '';
      }
      if (type === 'R') { // Result record
        const testId = fields[1]?.split('^');
        results.push({
          parameterCode: testId?.[3] || testId?.[0] || '',
          parameterName: testId?.[4] || testId?.[1] || '',
          value: fields[2] || '', unit: fields[3] || '',
          referenceRange: fields[4] || '', flag: fields[5] || '',
          isAbnormal: ['H', 'L', 'A'].includes(fields[5] || ''),
          isCritical: ['HH', 'LL'].includes(fields[5] || ''),
        });
      }
    }

    return patientId || sampleId ? { patientId, sampleId, results } : null;
  } catch { return null; }
}

// JSON format (modern instruments / middleware)
function parseJSON(body: any): { patientId: string; sampleId: string; results: any[] } | null {
  try {
    return {
      patientId: body.patient_id || body.patientId || body.uhid || '',
      sampleId: body.sample_id || body.sampleId || body.barcode || body.accession || '',
      results: (body.results || body.observations || []).map((r: any) => ({
        parameterCode: r.code || r.parameter_code || r.test_code || '',
        parameterName: r.name || r.parameter_name || r.test_name || '',
        value: String(r.value || r.result || ''),
        unit: r.unit || r.units || '',
        referenceRange: r.reference_range || r.ref_range || r.normal_range || '',
        flag: r.flag || r.abnormal_flag || '',
        isAbnormal: r.is_abnormal === true || ['H', 'L', 'A'].includes(r.flag || ''),
        isCritical: r.is_critical === true || ['HH', 'LL'].includes(r.flag || ''),
      })),
    };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const { error: authError } = requireApiKey(req);
  if (authError) return authError;

  const db = getDb();

  try {
    const contentType = req.headers.get('content-type') || '';
    let parsed: { patientId: string; sampleId: string; results: any[] } | null = null;
    let format = 'unknown';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      parsed = parseJSON(body);
      format = 'json';
    } else {
      const raw = await req.text();
      if (raw.includes('MSH|')) { parsed = parseHL7(raw); format = 'hl7'; }
      else if (raw.includes('H|\\^&')) { parsed = parseASTM(raw); format = 'astm'; }
      else {
        // Try JSON anyway
        try { parsed = parseJSON(JSON.parse(raw)); format = 'json'; } catch (e) { console.error(e); }
      }
    }

    if (!parsed || parsed.results.length === 0) {
      return NextResponse.json({ error: 'Could not parse instrument data', format }, { status: 400 });
    }

    // Find matching lab order by sample barcode or patient UHID
    let labOrderId: string | null = null;
    let patientDbId: string | null = null;

    if (parsed.sampleId) {
      const { data: order } = await db.from('hmis_lab_orders')
        .select('id, patient_id').ilike('id', `%${parsed.sampleId}%`).limit(1).maybeSingle();
      if (order) { labOrderId = order.id; patientDbId = order.patient_id; }
    }

    // Fallback: try sample_barcode if it exists as a column
    if (!labOrderId && parsed.sampleId) {
      const { data: order } = await db.from('hmis_lab_orders')
        .select('id, patient_id').eq('id', parsed.sampleId).maybeSingle();
      if (order) { labOrderId = order.id; patientDbId = order.patient_id; }
    }

    // Fallback: try patient UHID
    if (!labOrderId && parsed.patientId) {
      const { data: patient } = await db.from('hmis_patients')
        .select('id').eq('uhid', parsed.patientId).maybeSingle();
      if (patient) {
        patientDbId = patient.id;
        // Find most recent pending lab order for this patient
        const { data: order } = await db.from('hmis_lab_orders')
          .select('id').eq('patient_id', patient.id)
          .in('status', ['ordered', 'sample_collected', 'processing'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (order) labOrderId = order.id;
      }
    }

    // Store results
    const storedResults: any[] = [];
    let hasCritical = false;

    for (const r of parsed.results) {
      const insert: any = {
        lab_order_id: labOrderId, patient_id: patientDbId,
        parameter_code: r.parameterCode, parameter_name: r.parameterName,
        result_value: r.value, unit: r.unit, reference_range: r.referenceRange,
        instrument_flag: r.flag, is_abnormal: r.isAbnormal, is_critical: r.isCritical,
        source: 'instrument', instrument_format: format,
        received_at: new Date().toISOString(),
      };

      const { data, error } = await db.from('hmis_lab_instrument_results')
        .insert(insert).select('id').maybeSingle();

      if (!error && data) storedResults.push(data.id);
      if (r.isCritical) hasCritical = true;
    }

    // Update lab order status if matched
    if (labOrderId && storedResults.length > 0) {
      await db.from('hmis_lab_orders').update({
        status: 'processing', updated_at: new Date().toISOString(),
      }).eq('id', labOrderId);
    }

    return NextResponse.json({
      success: true, format, matched: !!labOrderId,
      labOrderId, patientId: patientDbId,
      resultsStored: storedResults.length, hasCritical,
      message: hasCritical ? 'CRITICAL VALUES — immediate notification required' : 'Results received',
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// GET — health check
export async function GET(req: NextRequest) {
  const { error: authError } = requireApiKey(req);
  if (authError) return authError;

  return NextResponse.json({
    status: 'ready', endpoint: '/api/lab/instrument-results',
    accepts: ['HL7 v2.3.1 ORU^R01', 'ASTM/LIS2-A2', 'JSON'],
    instrument: 'Mindray BC-5000 (TCP 5100, MLLP)',
  });
}
