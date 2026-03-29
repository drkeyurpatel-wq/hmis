// lib/config/hospital.ts
// Central hospital branding — single source of truth for all prints, headers, receipts
// UPDATE THIS FILE when deploying to a new centre

export interface HospitalInfo {
  name: string;
  shortName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  cin: string;
  pan: string;
  hfrId: string;
  nabh: string;
  logo: string;
}

export const HOSPITAL: HospitalInfo = {
  name: 'Health1 Super Speciality Hospitals Pvt. Ltd.',
  shortName: 'Health1',
  tagline: 'Super Speciality Hospital',
  address: 'Nr. Shilaj Circle, S.P. Ring Road, Shilaj, Ahmedabad - 380058',
  phone: '+91 79 4890 1234',
  email: 'info@health1.co.in',
  website: 'www.health1.co.in',
  gstin: '24AADCH7648R1ZD',
  cin: 'U85110GJ2019PTC109866',
  pan: 'AADCH7648R',
  hfrId: 'IN2410013685',
  nabh: '',
  logo: '/images/health1-logo.png',
};

// Per-centre overrides (for multi-centre deployments)
export const CENTRES: Record<string, Partial<HospitalInfo>> = {
  shilaj: {
    name: 'Health1 Super Speciality Hospitals Pvt. Ltd.',
    address: 'Nr. Shilaj Circle, S.P. Ring Road, Shilaj, Ahmedabad - 380058',
    phone: '+91 79 4890 1234',
  },
  vastral: {
    name: 'Health1 Hospital - Vastral',
    address: 'Vastral, Ahmedabad',
  },
  modasa: {
    name: 'Health1 Hospital - Modasa',
    address: 'Modasa, Gujarat',
  },
  gandhinagar: {
    name: 'Health1 Hospital - Gandhinagar',
    address: 'Gandhinagar, Gujarat',
  },
  udaipur: {
    name: 'Health1 Neurorth LLP',
    address: 'Udaipur, Rajasthan',
  },
};

/**
 * Get hospital info for printing, optionally with centre-specific overrides.
 */
export function getHospitalInfo(centreKey?: string): HospitalInfo {
  if (centreKey && CENTRES[centreKey]) {
    return { ...HOSPITAL, ...CENTRES[centreKey] };
  }
  return HOSPITAL;
}
