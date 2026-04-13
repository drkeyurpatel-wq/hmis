// lib/routes.ts
// Typed route constants — single source of truth for all internal app routes.
// Use these instead of hardcoded strings to catch broken links at compile time.
//
// Usage:
//   import { routes } from '@/lib/routes';
//   router.push(routes.patients.detail(patientId));

export const routes = {
  home: '/',
  patients: {
    list: '/patients',
    detail: (id: string) => `/patients/${id}`,
    register: '/patients/register',
  },
  opd: '/opd',
  ipd: {
    list: '/ipd',
    detail: (id: string) => `/ipd/${id}`,
  },
  billing: {
    home: '/billing',
    encounter: (id: string) => `/billing?encounter=${id}`,
    serviceMaster: '/billing?tab=service_master',
    insurance: '/billing?tab=insurance',
  },
  lab: '/lab',
  radiology: {
    list: '/radiology',
    detail: (id: string) => `/radiology/${id}`,
  },
  pharmacy: '/pharmacy',
  emergency: '/emergency',
  ot: {
    list: '/ot',
    detail: (id: string) => `/ot/${id}`,
  },
  appointments: '/appointments',
  reports: '/reports',
  settings: '/settings',
  bloodBank: '/blood-bank',
  telemedicine: '/telemedicine',
  documents: '/documents',
  insurance: '/insurance',
  crm: '/crm',
  vpms: '/vpms',
  nursing: '/nursing-station',
  homecare: '/homecare',
  dietary: '/dietary',
  housekeeping: '/housekeeping',
  biomedical: '/biomedical',
  linen: '/linen',
  mortuary: '/mortuary',
  dialysis: '/dialysis',
  cathlab: '/cathlab',
  endoscopy: '/endoscopy',
  physiotherapy: '/physiotherapy',
  visitors: '/visitors',
  referrals: {
    dashboard: '/referrals',
    detail: (id: string) => `/referrals/${id}`,
    sources: '/referrals/sources',
    fees: '/referrals/fees',
    payCalculator: '/referrals/pay-calculator',
  },
  handover: '/handover',
  voiceNotes: '/voice-notes',
  pulse: '/pulse',
  emrMobile: '/emr-mobile',
  emrV2: '/emr-v2',
  portal: {
    home: '/portal',
    login: '/portal/login',
  },
} as const;
