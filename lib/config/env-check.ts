// lib/config/env-check.ts
// Runtime validation of critical env vars — call on app startup

const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const REQUIRED_FOR_FEATURES: Record<string, string[]> = {
  'Revenue Sync': ['REVENUE_WORKER_URL', 'REVENUE_SYNC_API_KEY'],
  'MedPay Integration': ['MEDPAY_SUPABASE_URL', 'MEDPAY_SERVICE_ROLE_KEY'],
  'VPMS Integration': ['VPMS_SUPABASE_URL', 'VPMS_SUPABASE_SERVICE_KEY'],
  'Cron Jobs': ['CRON_SECRET'],
  'WhatsApp Alerts': ['WHATSAPP_API_URL', 'WHATSAPP_ACCESS_TOKEN'],
};

export function validateEnvVars(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of REQUIRED_SERVER_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  for (const [feature, vars] of Object.entries(REQUIRED_FOR_FEATURES)) {
    const featureMissing = vars.filter(v => !process.env[v]);
    if (featureMissing.length > 0) {
      warnings.push(`${feature}: missing ${featureMissing.join(', ')}`);
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}
