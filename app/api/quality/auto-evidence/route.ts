// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';

// Auto-evidence collection: maps NABH OEs to HMIS data sources
const EVIDENCE_MAPPINGS: Record<string, { table: string; filter?: string; description: string }> = {
  'IPC.2': { table: 'hmis_hand_hygiene_audit', description: 'Hand hygiene audit records' },
  'IPC.5': { table: 'quality_ipc_surveillance', description: 'HAI surveillance events' },
  'IPC.6': { table: 'quality_antibiotic_consumption', description: 'Antibiotic consumption DDD data' },
  'PSQ.1': { table: 'quality_incidents', description: 'Incident reports with CAPA' },
  'PSQ.2': { table: 'quality_incidents', filter: "severity='EXTREME'", description: 'High-severity incidents with RCA' },
  'PSQ.3': { table: 'quality_sentinel_events', description: 'Sentinel event reports' },
  'PSQ.4': { table: 'quality_ipsg_compliance', description: 'IPSG compliance data' },
  'PSQ.6': { table: 'quality_audit_runs', description: 'Clinical audit results' },
  'FMS.2': { table: 'quality_safety_drills', filter: "drill_type='FIRE'", description: 'Fire safety drill records' },
  'HRM.11': { table: 'quality_staff_credentials', description: 'Medical staff credentialing records' },
  'HRM.12': { table: 'quality_staff_credentials', description: 'Nursing staff credentials' },
  'MOM.1': { table: 'quality_medication_safety_reports', description: 'MSO medication safety reports' },
};

export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const evidence: Record<string, { standard: string; count: number; description: string; has_data: boolean }> = {};

  for (const [stdCode, mapping] of Object.entries(EVIDENCE_MAPPINGS)) {
    let query = db.from(mapping.table).select('id', { count: 'exact' }).eq('centre_id', centreId);
    const { count } = await query;
    evidence[stdCode] = {
      standard: stdCode,
      count: count || 0,
      description: mapping.description,
      has_data: (count || 0) > 0,
    };
  }

  const covered = Object.values(evidence).filter(e => e.has_data).length;
  return NextResponse.json({
    total_mapped: Object.keys(evidence).length,
    with_evidence: covered,
    coverage_pct: Math.round(covered / Object.keys(evidence).length * 100),
    mappings: evidence,
  });
}
