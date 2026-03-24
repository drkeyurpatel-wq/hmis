// components/ui/health-icon.tsx
// Healthcare-specific icons from healthicons.org (CC0 / Public Domain)
// Source: github.com/resolvetosavelives/healthicons
//
// SETUP (one-time):
//   Run: bash scripts/download-health-icons.sh
//   This downloads ~200 curated icons into public/health-icons/
'use client';

import React from 'react';

interface HealthIconProps {
  /** Icon path relative to health-icons folder, e.g., "specialties/neurology" */
  name: string;
  /** Size in px (default 20) */
  size?: number;
  /** Style: outline or filled (default outline) */
  variant?: 'outline' | 'filled';
  /** Additional classes */
  className?: string;
  /** Alt text */
  alt?: string;
}

export default function HealthIcon({
  name,
  size = 20,
  variant = 'outline',
  className = '',
  alt,
}: HealthIconProps) {
  const src = `/health-icons/${variant}/${name}.svg`;
  return (
    <img
      src={src}
      alt={alt || name.split('/').pop() || 'icon'}
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 ${className}`}
      loading="lazy"
      style={{ minWidth: size, minHeight: size }}
    />
  );
}

// ─── Department → Icon Mapping ───────────────────────────────────
// Maps Health1's 100 HRMS departments to healthicons.org icon paths

export const DEPARTMENT_ICON_MAP: Record<string, string> = {
  // Clinical
  'Cardiology':         'specialties/cardiology',
  'Neurology':          'specialties/neurology',
  'Neurosurgery':       'specialties/neurology',
  'Orthopedics':        'specialties/orthopedics',
  'General Surgery':    'procedures/surgery',
  'General Medicine':   'people/doctor',
  'Emergency':          'places/emergency-post',
  'ICU':                'devices/ventilator',
  'NICU':               'people/baby-0203m',
  'Pediatrics':         'people/baby-0306m',
  'Obstetrics':         'specialties/obstetrics',
  'Gynecology':         'specialties/gynecology',
  'Nephrology':         'body/kidney',
  'Urology':            'body/kidney',
  'Pulmonology':        'body/lungs',
  'Gastroenterology':   'body/stomach',
  'ENT':                'body/ear',
  'Ophthalmology':      'body/eye',
  'Dermatology':        'body/skin',
  'Psychiatry':         'specialties/mental-health',
  'Anesthesiology':     'medications/intravenous',
  'Radiology':          'diagnostics/x-ray',
  'Pathology':          'diagnostics/microscope',
  'Physiotherapy':      'specialties/physiotherapy',
  'CVTS':               'body/heart',
  'Oncology':           'conditions/malaria-testing',
  'Dental':             'specialties/dental',
  'Dialysis':           'devices/renal',

  // Diagnostics & Support
  'Pharmacy':           'places/pharmacy-alt',
  'Laboratory':         'diagnostics/lab',
  'Blood Bank':         'blood/blood-bag',
  'OT':                 'procedures/surgery',
  'Cathlab':            'devices/stethoscope',
  'OPD':                'places/clinic',
  'IPD':                'places/hospital',
  'Endoscopy':          'procedures/endoscopy',

  // Admin
  'Administration':     'people/health-worker-form',
  'Finance':            'objects/coins',
  'HR':                 'people/community-health-worker',
  'IT':                 'devices/computer',
  'Housekeeping':       'places/cleaning',
  'Dietary':            'food/nutritional-supplement',
  'Security':           'people/military-worker',
  'Biomedical':         'devices/stethoscope-alt',
  'Maintenance':        'objects/tools',
  'Transport':          'vehicles/ambulance',
  'CSSD':               'devices/sterilization',
  'Linen':              'objects/cloth',
  'Mortuary':           'places/mortuary',
  'MRD':                'objects/health-data',
};

// Fallback icon when department not mapped
export const DEFAULT_DEPARTMENT_ICON = 'places/hospital';

// ─── Helper: get icon for a department name ──────────────────────
export function getDepartmentIcon(name: string): string {
  return DEPARTMENT_ICON_MAP[name] || DEFAULT_DEPARTMENT_ICON;
}
