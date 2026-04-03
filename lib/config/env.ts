// lib/config/env.ts
// Centralized environment variable validation.
// Import this in layout.tsx or instrumentation.ts to validate at startup.
//
// Usage:
//   import { env, validateEnv } from '@/lib/config/env';
//   validateEnv(); // logs warnings for missing vars
//   const url = env.SUPABASE_URL; // typed access

export const env = {
  // Core — required for app to function
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // App
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',

  // Integrations — optional but warn if missing in production
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || process.env.NEXT_PUBLIC_WHATSAPP_API_URL || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN || '',
  CRON_SECRET: process.env.CRON_SECRET || '',

  // H1 Revenue
  REVENUE_WORKER_URL: process.env.REVENUE_WORKER_URL || '',
  REVENUE_SYNC_API_KEY: process.env.REVENUE_SYNC_API_KEY || '',

  // MedPay
  MEDPAY_SUPABASE_URL: process.env.MEDPAY_SUPABASE_URL || '',
  MEDPAY_SERVICE_ROLE_KEY: process.env.MEDPAY_SERVICE_ROLE_KEY || '',

  // VPMS
  VPMS_SUPABASE_URL: process.env.VPMS_SUPABASE_URL || '',
  VPMS_SUPABASE_KEY: process.env.VPMS_SUPABASE_SERVICE_KEY || '',

  // ABDM
  ABDM_CLIENT_ID: process.env.ABDM_CLIENT_ID || '',
  ABDM_CLIENT_SECRET: process.env.ABDM_CLIENT_SECRET || '',

  // PACS
  PACS_VIEWER_URL: process.env.NEXT_PUBLIC_PACS_VIEWER_URL || '',
} as const;

interface EnvCheck {
  key: keyof typeof env;
  required: boolean;
  label: string;
}

const checks: EnvCheck[] = [
  { key: 'SUPABASE_URL', required: true, label: 'Supabase URL' },
  { key: 'SUPABASE_ANON_KEY', required: true, label: 'Supabase Anon Key' },
  { key: 'APP_URL', required: true, label: 'App URL (for emails/links)' },
  { key: 'RESEND_API_KEY', required: false, label: 'Resend (email)' },
  { key: 'MSG91_AUTH_KEY', required: false, label: 'MSG91 (SMS)' },
  { key: 'WHATSAPP_API_URL', required: false, label: 'WhatsApp API' },
  { key: 'CRON_SECRET', required: false, label: 'Cron Secret' },
];

export interface EnvStatus {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
}

/**
 * Validates environment variables and logs warnings.
 * Returns a list of statuses for admin display.
 */
export function validateEnv(): EnvStatus[] {
  const results: EnvStatus[] = checks.map(c => ({
    key: c.key,
    label: c.label,
    configured: !!env[c.key],
    required: c.required,
  }));

  const missing = results.filter(r => !r.configured);
  const missingRequired = missing.filter(r => r.required);
  const missingOptional = missing.filter(r => !r.required);

  if (missingRequired.length > 0) {
    console.error(`[CONFIG] Missing required env vars: ${missingRequired.map(r => r.key).join(', ')}`);
  }

  if (missingOptional.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn(`[CONFIG] Optional integrations not configured: ${missingOptional.map(r => r.label).join(', ')}`);
  }

  return results;
}

/**
 * Returns integration health statuses for admin UI.
 */
export function getIntegrationStatuses(): Record<string, { configured: boolean; label: string }> {
  return {
    supabase: { configured: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY, label: 'Supabase' },
    email: { configured: !!env.RESEND_API_KEY, label: 'Email (Resend)' },
    sms: { configured: !!env.MSG91_AUTH_KEY, label: 'SMS (MSG91)' },
    whatsapp: { configured: !!env.WHATSAPP_API_URL && !!env.WHATSAPP_ACCESS_TOKEN, label: 'WhatsApp' },
    revenue: { configured: !!env.REVENUE_WORKER_URL && !!env.REVENUE_SYNC_API_KEY, label: 'H1 Revenue' },
    medpay: { configured: !!env.MEDPAY_SUPABASE_URL && !!env.MEDPAY_SERVICE_ROLE_KEY, label: 'MedPay' },
    vpms: { configured: !!env.VPMS_SUPABASE_URL && !!env.VPMS_SUPABASE_KEY, label: 'VPMS' },
    abdm: { configured: !!env.ABDM_CLIENT_ID && !!env.ABDM_CLIENT_SECRET, label: 'ABDM/ABHA' },
    pacs: { configured: !!env.PACS_VIEWER_URL, label: 'PACS/Stradus' },
  };
}
