#!/usr/bin/env node
// scripts/import-synthea.mjs
// Import Synthea-generated CSV into HMIS Supabase test_* tables
//
// Prerequisites:
//   1. Run: bash scripts/generate-synthea.sh
//   2. Run: sql/synthea_test_data.sql in Supabase SQL editor
//   3. Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Usage: node scripts/import-synthea.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CSV_DIR = '/tmp/synthea-output/csv';
const CENTRES = ['shilaj', 'vastral', 'modasa', 'udaipur', 'gandhinagar'];

// ─── Init ────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!existsSync(CSV_DIR)) {
  console.error(`❌ Synthea output not found at ${CSV_DIR}`);
  console.error('   Run: bash scripts/generate-synthea.sh');
  process.exit(1);
}

const supabase = createClient(url, key);

// ─── Simple CSV parser (no dependency needed) ────────────────────
function parseCSV(filename) {
  const filepath = join(CSV_DIR, filename);
  if (!existsSync(filepath)) {
    console.warn(`  ⚠ ${filename} not found`);
    return [];
  }
  const lines = readFileSync(filepath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || null; });
    return row;
  });
}

// ─── Batch insert helper ─────────────────────────────────────────
async function batchInsert(table, rows, batchSize = 100) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ❌ ${table} batch ${i}: ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }
  return inserted;
}

// ─── Import ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Health1 — Synthea → HMIS Supabase Import       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Source: ${CSV_DIR}`);
  console.log('');

  // Patients
  const patients = parseCSV('patients.csv').map(r => ({
    synthea_id: r.Id,
    first_name: r.FIRST || 'Unknown',
    last_name: r.LAST || 'Unknown',
    date_of_birth: r.BIRTHDATE || null,
    gender: r.GENDER === 'M' ? 'male' : 'female',
    phone: null,
    address: [r.ADDRESS, r.CITY, r.STATE, r.ZIP].filter(Boolean).join(', '),
    marital_status: r.MARITAL || null,
    centre_id: CENTRES[Math.floor(Math.random() * CENTRES.length)],
  }));
  console.log(`Patients: ${patients.length}`);
  const pInserted = await batchInsert('test_patients', patients);
  console.log(`  ✅ ${pInserted} inserted\n`);

  // Encounters
  const encounters = parseCSV('encounters.csv').map(r => ({
    synthea_id: r.Id,
    synthea_patient_id: r.PATIENT,
    encounter_class: r.ENCOUNTERCLASS || null,
    code: r.CODE || null,
    description: r.DESCRIPTION || null,
    start_date: r.START || null,
    end_date: r.STOP || null,
    centre_id: CENTRES[Math.floor(Math.random() * CENTRES.length)],
  }));
  console.log(`Encounters: ${encounters.length}`);
  const eInserted = await batchInsert('test_encounters', encounters);
  console.log(`  ✅ ${eInserted} inserted\n`);

  // Conditions
  const conditions = parseCSV('conditions.csv').map(r => ({
    synthea_patient_id: r.PATIENT,
    encounter_id: r.ENCOUNTER || null,
    code: r.CODE,
    description: r.DESCRIPTION,
    onset_date: r.START || null,
    resolved_date: r.STOP || null,
  }));
  console.log(`Conditions: ${conditions.length}`);
  const cInserted = await batchInsert('test_conditions', conditions, 200);
  console.log(`  ✅ ${cInserted} inserted\n`);

  // Observations (vitals + labs) — filter to numeric only
  const observations = parseCSV('observations.csv')
    .filter(r => r.TYPE === 'numeric' && r.VALUE && !isNaN(parseFloat(r.VALUE)))
    .map(r => ({
      synthea_patient_id: r.PATIENT,
      encounter_id: r.ENCOUNTER || null,
      date: r.DATE || null,
      code: r.CODE,
      description: r.DESCRIPTION,
      value: parseFloat(r.VALUE),
      unit: r.UNITS || '',
    }));
  console.log(`Observations: ${observations.length} (numeric only)`);
  const oInserted = await batchInsert('test_observations', observations, 500);
  console.log(`  ✅ ${oInserted} inserted\n`);

  // Medications
  const medications = parseCSV('medications.csv').map(r => ({
    synthea_patient_id: r.PATIENT,
    encounter_id: r.ENCOUNTER || null,
    code: r.CODE,
    description: r.DESCRIPTION,
    start_date: r.START || null,
    stop_date: r.STOP || null,
    reason_code: r.REASONCODE || null,
    reason_description: r.REASONDESCRIPTION || null,
  }));
  console.log(`Medications: ${medications.length}`);
  const mInserted = await batchInsert('test_medications', medications, 200);
  console.log(`  ✅ ${mInserted} inserted\n`);

  console.log('══════════════════════════════════════════════════');
  console.log('  Import complete!');
  console.log('  To clear: SELECT clear_synthea_test_data();');
  console.log('══════════════════════════════════════════════════');
}

main().catch(console.error);
