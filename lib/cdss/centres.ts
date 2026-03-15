// lib/cdss/centres.ts
// Health1 centre configuration for Rx PDF, referral letters, and analytics

export interface CentreConfig {
  id: string;
  name: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  tagline: string;
}

export const H1_CENTRES: CentreConfig[] = [
  {
    id: 'shilaj', name: 'Health1 Super Speciality Hospital — Shilaj',
    shortName: 'Shilaj (Flagship)',
    address: 'Shilaj Circle, SG Highway, Ahmedabad 380058',
    phone: '+91 79 6190 1111', email: 'info@health1hospitals.com',
    city: 'Ahmedabad', state: 'Gujarat',
    tagline: '330 Beds • Cathlab • Cuvis Robot • SSI Mantra 3.0',
  },
  {
    id: 'vastral', name: 'Health1 Super Speciality Hospital — Vastral',
    shortName: 'Vastral',
    address: 'Vastral, Ahmedabad 382418',
    phone: '+91 79 6190 2222', email: 'vastral@health1hospitals.com',
    city: 'Ahmedabad', state: 'Gujarat',
    tagline: '111 Beds • Multi-Speciality',
  },
  {
    id: 'modasa', name: 'Health1 Super Speciality Hospital — Modasa',
    shortName: 'Modasa',
    address: 'Modasa, Aravalli 383315',
    phone: '+91 2774 290090', email: 'modasa@health1hospitals.com',
    city: 'Modasa', state: 'Gujarat',
    tagline: '51 Beds • District Referral Centre',
  },
  {
    id: 'gandhinagar', name: 'Health1 Super Speciality Hospital — Gandhinagar',
    shortName: 'Gandhinagar',
    address: 'Gandhinagar 382010',
    phone: '+91 79 6190 3333', email: 'gandhinagar@health1hospitals.com',
    city: 'Gandhinagar', state: 'Gujarat',
    tagline: '225 Beds • O&M Model',
  },
  {
    id: 'udaipur', name: 'Health1 Neurorth Hospital — Udaipur',
    shortName: 'Udaipur',
    address: 'Udaipur 313001',
    phone: '+91 294 2900 100', email: 'udaipur@health1hospitals.com',
    city: 'Udaipur', state: 'Rajasthan',
    tagline: '51 Beds • Neuro + Ortho Speciality',
  },
];

export function getCentre(id: string): CentreConfig | undefined {
  return H1_CENTRES.find(c => c.id === id);
}
