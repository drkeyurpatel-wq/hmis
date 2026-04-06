// ============================================================
// HMIS Go-Live Migration: MedPay → HMIS
//
// Single idempotent script that seeds HMIS with real production
// data from MedPay. Run on a clean HMIS database after wiping
// demo/seed data.
//
// What it migrates:
//   doctors (199)     → hmis_staff
//   contracts (199)   → hmis_doctor_contracts
//   doctor_aliases (383) → hmis_doctor_aliases
//   doctor_centres (191) → centre linkages
//   fixed_payouts (18)   → hmis_fixed_payouts
//   department_map (20)  → already seeded via migration
//
// What it skips:
//   billing_rows (119K)  → HMIS generates natively
//   medpay_users          → HMIS has own auth
//   settlements/payslips  → historical archive stays in MedPay
//
// Usage:
//   npx tsx scripts/go-live-seed.ts
//
// Prerequisites:
//   MEDPAY_SUPABASE_URL + MEDPAY_SUPABASE_KEY in .env
//   HMIS_SUPABASE_URL + HMIS_SUPABASE_KEY in .env
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---- Centre mapping: MedPay text names → HMIS centre UUIDs ----
const CENTRE_MAP: Record<string, string> = {
  'Shilaj':   'c0000001-0000-0000-0000-000000000001',
  'Vastral':  'c0000001-0000-0000-0000-000000000002',
  'Modasa':   'c0000001-0000-0000-0000-000000000003',
  'Gandhinagar': 'c0000001-0000-0000-0000-000000000004',
  'Udaipur':  'c0000001-0000-0000-0000-000000000005',
  // Himmatnagar — add UUID when centre is created in HMIS
};

// Default centre for doctors without explicit centre assignment
const DEFAULT_CENTRE = CENTRE_MAP['Shilaj'];

interface MigrationReport {
  doctors_migrated: number;
  contracts_migrated: number;
  aliases_migrated: number;
  fixed_payouts_migrated: number;
  errors: string[];
  doctor_map: Record<number, string>;  // medpay_doctor_id → hmis_staff_id
}

export async function runMigration(
  medpay: SupabaseClient,
  hmis: SupabaseClient
): Promise<MigrationReport> {
  const report: MigrationReport = {
    doctors_migrated: 0,
    contracts_migrated: 0,
    aliases_migrated: 0,
    fixed_payouts_migrated: 0,
    errors: [],
    doctor_map: {},
  };

  // ============================================
  // PHASE 1: Migrate doctors → hmis_staff
  // ============================================
  console.log('Phase 1: Migrating doctors...');

  const { data: mpDoctors, error: docErr } = await medpay
    .from('doctors')
    .select('*')
    .order('id');

  if (docErr || !mpDoctors) {
    report.errors.push(`Failed to fetch MedPay doctors: ${docErr?.message}`);
    return report;
  }

  const { data: mpCentres } = await medpay
    .from('doctor_centres')
    .select('doctor_id, centre');

  const centresByDoctor = new Map<number, string[]>();
  for (const dc of mpCentres || []) {
    if (!centresByDoctor.has(dc.doctor_id)) centresByDoctor.set(dc.doctor_id, []);
    centresByDoctor.get(dc.doctor_id)!.push(dc.centre);
  }

  for (const doc of mpDoctors) {
    const centres = centresByDoctor.get(doc.id) || ['Shilaj'];
    const primaryCentre = CENTRE_MAP[centres[0]] || DEFAULT_CENTRE;

    const staffRow = {
      employee_code: `DR${String(doc.id).padStart(4, '0')}`,
      full_name: doc.name,
      display_name: doc.display_name || null,
      designation: 'Consultant',
      staff_type: 'doctor',
      primary_centre_id: primaryCentre,
      phone: doc.phone || null,
      email: doc.email || null,
      specialisation: doc.specialty || null,
      is_active: doc.active ?? true,
      pan: doc.pan || null,
      tds_pct: doc.tds_pct ?? 10,
      photo_url: doc.photo_url || null,
      bio: doc.bio || null,
      languages: doc.languages || null,
      experience_years: doc.experience_years || null,
      portal_enabled: doc.portal_enabled ?? false,
      portal_phone: doc.portal_phone || null,
      portal_email: doc.portal_email || null,
      medpay_doctor_id: doc.id,
      metadata: {
        medpay_migrated: true,
        medpay_migrated_at: new Date().toISOString(),
        medpay_notes: doc.notes || null,
      },
    };

    const { data: inserted, error: insErr } = await hmis
      .from('hmis_staff')
      .insert(staffRow)
      .select('id')
      .single();

    if (insErr) {
      report.errors.push(`Doctor ${doc.name} (MP#${doc.id}): ${insErr.message}`);
      continue;
    }

    report.doctor_map[doc.id] = inserted.id;
    report.doctors_migrated++;
  }

  console.log(`  → ${report.doctors_migrated} doctors migrated`);

  // ============================================
  // PHASE 2: Migrate contracts → hmis_doctor_contracts
  // ============================================
  console.log('Phase 2: Migrating contracts...');

  const { data: mpContracts, error: contErr } = await medpay
    .from('contracts')
    .select('*')
    .order('id');

  if (contErr || !mpContracts) {
    report.errors.push(`Failed to fetch MedPay contracts: ${contErr?.message}`);
    return report;
  }

  for (const c of mpContracts) {
    const hmisDocId = report.doctor_map[c.doctor_id];
    if (!hmisDocId) {
      report.errors.push(`Contract MP#${c.id}: doctor MP#${c.doctor_id} not found in map`);
      continue;
    }

    // Determine centre — use doctor's primary centre
    const centres = centresByDoctor.get(c.doctor_id) || ['Shilaj'];
    const centreId = CENTRE_MAP[centres[0]] || DEFAULT_CENTRE;

    const contractRow = {
      centre_id: centreId,
      doctor_id: hmisDocId,
      contract_type: c.contract_type || 'FFS',
      ipd_method: c.ipd_method || 'net_pct',
      is_visiting: c.is_visiting || false,
      partner_doctor_id: c.partner_doctor_id ? (report.doctor_map[c.partner_doctor_id] || null) : null,

      cash_base_method: c.cash_base_method || 'A',
      cash_self_pct: c.cash_self_pct ?? 100,
      cash_other_pct: c.cash_other_pct ?? 100,
      cash_b_pct: c.cash_b_pct,

      tpa_base_method: c.tpa_base_method || 'A',
      tpa_self_pct: c.tpa_self_pct ?? 100,
      tpa_other_pct: c.tpa_other_pct ?? 100,
      tpa_b_pct: c.tpa_b_pct,

      pmjay_base_method: c.pmjay_base_method || 'na',
      pmjay_pct: c.pmjay_pct ?? 0,
      pmjay_self_pct: c.pmjay_self_pct ?? 0,
      pmjay_other_pct: c.pmjay_other_pct ?? 0,
      pmjay_b_pct: c.pmjay_b_pct ?? 0,

      govt_base_method: c.govt_base_method || 'na',
      govt_self_pct: c.govt_self_pct ?? 100,
      govt_other_pct: c.govt_other_pct ?? 100,
      govt_b_pct: c.govt_b_pct,

      opd_non_govt_pct: c.opd_non_govt_pct ?? 80,
      opd_govt_pct: c.opd_govt_pct ?? 100,
      ward_procedure_pct: c.ward_procedure_pct,

      mgm_amount: c.mgm_amount ?? 0,
      mgm_threshold: c.mgm_threshold ?? 0,
      incentive_pct: c.incentive_pct ?? 0,

      retainer_amount: c.retainer_amount ?? 0,
      retainer_mode: c.retainer_mode || 'fixed',
      retainer_pool_pct: c.retainer_pool_pct ?? 0,

      hospital_fixed_amount: c.hospital_fixed_amount ?? 0,
      hospital_pct: c.hospital_pct ?? 0,
      rb_hospital_fixed: c.rb_hospital_fixed ?? 0,
      rb_includes_robotic: c.rb_includes_robotic ?? false,

      fixed_pkg_basic: c.fixed_pkg_basic ?? 0,
      fixed_pkg_cashless: c.fixed_pkg_cashless ?? 0,
      fixed_pkg_premium: c.fixed_pkg_premium ?? 0,

      expense_dr_pct: c.expense_dr_pct ?? 50,
      expense_deductions: c.expense_deductions || [],

      hold_config: c.hold_config || {},
      payout_rules: c.payout_rules || null,
      departments: c.departments || [],
      centre_overrides: c.centre_overrides || {},

      tds_pct: c.tds_pct ?? 10,
      effective_from: c.effective_from || null,
      effective_to: c.effective_to || null,
      is_active: true,
      notes: c.notes || null,

      migration_review: true,  // Flag for manual review
      medpay_contract_id: c.id,
    };

    const { error: cInsErr } = await hmis
      .from('hmis_doctor_contracts')
      .insert(contractRow);

    if (cInsErr) {
      report.errors.push(`Contract MP#${c.id} for ${c.doctor_id}: ${cInsErr.message}`);
      continue;
    }

    report.contracts_migrated++;
  }

  console.log(`  → ${report.contracts_migrated} contracts migrated`);

  // ============================================
  // PHASE 3: Migrate aliases → hmis_doctor_aliases
  // ============================================
  console.log('Phase 3: Migrating aliases...');

  const { data: mpAliases } = await medpay
    .from('doctor_aliases')
    .select('*');

  for (const alias of mpAliases || []) {
    const hmisDocId = report.doctor_map[alias.doctor_id];
    if (!hmisDocId) continue;

    const { error: aErr } = await hmis
      .from('hmis_doctor_aliases')
      .insert({ doctor_id: hmisDocId, alias: alias.alias });

    if (aErr) {
      // Duplicate alias — skip silently
      if (!aErr.message.includes('duplicate')) {
        report.errors.push(`Alias "${alias.alias}": ${aErr.message}`);
      }
      continue;
    }

    report.aliases_migrated++;
  }

  console.log(`  → ${report.aliases_migrated} aliases migrated`);

  // ============================================
  // PHASE 4: Migrate fixed payouts → hmis_fixed_payouts
  // ============================================
  console.log('Phase 4: Migrating fixed payouts...');

  const { data: mpFixed } = await medpay
    .from('fixed_payouts')
    .select('*')
    .eq('active', true);

  for (const fp of mpFixed || []) {
    const hmisDocId = fp.doctor_id ? (report.doctor_map[fp.doctor_id] || null) : null;

    const { error: fpErr } = await hmis
      .from('hmis_fixed_payouts')
      .insert({
        doctor_id: hmisDocId,
        centre_id: fp.centre ? (CENTRE_MAP[fp.centre] || null) : null,
        package_name: fp.package_name,
        payor: fp.payor || 'ALL',
        specialty: fp.specialty || null,
        amount_from: fp.amount_from ?? 0,
        amount_to: fp.amount_to ?? 0,
        doctor_payout: fp.doctor_payout,
        is_active: true,
        notes: fp.notes || null,
        medpay_fixed_id: fp.id,
      });

    if (fpErr) {
      report.errors.push(`Fixed payout "${fp.package_name}": ${fpErr.message}`);
      continue;
    }

    report.fixed_payouts_migrated++;
  }

  console.log(`  → ${report.fixed_payouts_migrated} fixed payouts migrated`);

  // ============================================
  // DONE — print reconciliation report
  // ============================================
  console.log('\n========== MIGRATION REPORT ==========');
  console.log(`Doctors:       ${report.doctors_migrated} / ${mpDoctors.length}`);
  console.log(`Contracts:     ${report.contracts_migrated} / ${mpContracts.length}`);
  console.log(`Aliases:       ${report.aliases_migrated} / ${(mpAliases || []).length}`);
  console.log(`Fixed Payouts: ${report.fixed_payouts_migrated} / ${(mpFixed || []).length}`);
  console.log(`Errors:        ${report.errors.length}`);

  if (report.errors.length > 0) {
    console.log('\nErrors:');
    report.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  console.log('======================================\n');

  return report;
}

// ---- CLI entry point ----
async function main() {
  const medpay = createClient(
    process.env.MEDPAY_SUPABASE_URL!,
    process.env.MEDPAY_SUPABASE_KEY!
  );

  const hmis = createClient(
    process.env.HMIS_SUPABASE_URL!,
    process.env.HMIS_SUPABASE_KEY!
  );

  console.log('Starting MedPay → HMIS go-live migration...\n');
  const report = await runMigration(medpay, hmis);

  // Write report to file
  const fs = await import('fs');
  fs.writeFileSync(
    `migration-report-${new Date().toISOString().substring(0, 10)}.json`,
    JSON.stringify(report, null, 2)
  );

  console.log('Migration report saved.');
  process.exit(report.errors.length > 0 ? 1 : 0);
}

// Only run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
