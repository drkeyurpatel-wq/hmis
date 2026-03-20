'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToCSV } from '@/lib/utils/data-export';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { formatDate, calculateAge, getInitials, cn } from '@/lib/utils';
import { validatePatientRegistration, getFieldError, type ValidationError } from '@/lib/utils/validation';
import {
  Search, Plus, Phone, MapPin, ChevronRight, X, User, Heart,
  Shield, AlertCircle, Camera, FileText, Clock, Filter,
  CreditCard, UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/types/database';

const genderOptions = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const maritalStatuses = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const idTypes = [{ value: 'aadhaar', label: 'Aadhaar Card' }, { value: 'pan', label: 'PAN Card' }, { value: 'passport', label: 'Passport' }, { value: 'voter_id', label: 'Voter ID' }, { value: 'driving_license', label: 'Driving License' }];
const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
const payorSchemes = [{ value: 'private', label: 'Private Insurance' }, { value: 'pmjay', label: 'PMJAY (Ayushman Bharat)' }, { value: 'cghs', label: 'CGHS' }, { value: 'esi', label: 'ESI' }, { value: 'none', label: 'No Insurance (Self-pay)' }];
const relationships = ['Spouse', 'Parent', 'Child', 'Sibling', 'Relative', 'Friend', 'Other'];
const severities = ['mild', 'moderate', 'severe'];
const indianStates = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];

// ARCHITECTURE: PatientsPage is a thin switch.
// When registering → ONLY RegisterModal exists (no list, no effects, no subscriptions).
// When browsing → ONLY PatientsList exists (no modal).
// They NEVER coexist. This prevents any cross-contamination.

export default function PatientsPage() {
  const [mode, setMode] = useState<'list' | 'register'>('list');

  if (mode === 'register') {
    return <RegisterModal
      onClose={() => setMode('list')}
      onSuccess={() => setMode('list')}
    />;
  }

  return <PatientsList onRegister={() => setMode('register')} />;
}

function PatientsList({ onRegister }: { onRegister: () => void }) {
  const { activeCentreId } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterGender, setFilterGender] = useState('');

  const loadPatients = useCallback(async () => {
    if (!activeCentreId) return;
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from('hmis_patients').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(50);
    if (search.trim()) query = query.or(`uhid.ilike.%${search}%,phone_primary.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    if (filterGender) query = query.eq('gender', filterGender);
    const { data } = await query;
    setPatients(data || []);
    setLoading(false);
  }, [activeCentreId, search, filterGender]);

  useEffect(() => { const t = setTimeout(loadPatients, 300); return () => clearTimeout(t); }, [loadPatients]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{patients.length} registered patients</p>
        </div>
        <button onClick={() => exportToCSV(patients.map(p => ({ uhid: p.uhid, first_name: p.first_name, last_name: p.last_name, gender: p.gender, age: p.age_years, phone: p.phone_primary, city: p.city, registered: p.created_at?.split("T")[0] })), "patients")} className="px-3 py-2 bg-gray-100 text-sm rounded-lg border">Export CSV</button>
          <button onClick={onRegister} className="flex items-center gap-2 px-4 py-2.5 bg-health1-teal text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-all shadow-sm hover:shadow-md">
          <UserPlus size={16} /> New registration
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UHID, name, phone, Aadhaar..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-sm" />
        </div>
        <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 outline-none">
          <option value="">All genders</option>
          {genderOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full mr-3" /> Loading...
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <User size={32} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium">No patients found</p>
            <button onClick={() => exportToCSV(patients.map(p => ({ uhid: p.uhid, first_name: p.first_name, last_name: p.last_name, gender: p.gender, age: p.age_years, phone: p.phone_primary, city: p.city, registered: p.created_at?.split("T")[0] })), "patients")} className="px-3 py-2 bg-gray-100 text-sm rounded-lg border">Export CSV</button>
          <button onClick={onRegister} className="mt-2 text-sm text-brand-600 hover:underline font-medium">Register first patient</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                  <span className="text-sm font-bold text-brand-700">{getInitials(`${p.first_name} ${p.last_name}`)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{p.first_name} {p.middle_name || ''} {p.last_name}</p>
                    <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{p.uhid}</span>
                    {p.is_vip && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">VIP</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '⚧'} {p.date_of_birth ? `${calculateAge(p.date_of_birth)}y` : p.age_years ? `${p.age_years}y` : ''} {p.blood_group ? `· ${p.blood_group}` : ''}</span>
                    <span className="flex items-center gap-1"><Phone size={10} />{p.phone_primary}</span>
                    {p.city && <span className="flex items-center gap-1"><MapPin size={10} />{p.city}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type RegSection = 'demographics' | 'contact' | 'identity' | 'insurance' | 'emergency' | 'medical';

function RegisterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { activeCentreId } = useAuthStore();
  const [section, setSection] = useState<RegSection>('demographics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([]);
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', gender: '', date_of_birth: '',
    age_years: '', blood_group: '', marital_status: '', occupation: '', religion: '',
    nationality: 'Indian', is_vip: false,
    phone_primary: '', phone_secondary: '', email: '',
    address_line1: '', address_line2: '', city: 'Ahmedabad', state: 'Gujarat', pincode: '',
    id_type: '', id_number: '',
    insurance_scheme: 'none', insurer_name: '', policy_number: '', tpa_name: '', sum_insured: '',
    ec_name: '', ec_relationship: '', ec_phone: '', ec_is_emergency: true,
    allergies: [] as { allergen: string; severity: string }[],
    medical_history: '',
  });
  const u = (f: string, v: unknown) => setForm(prev => ({ ...prev, [f]: v }));

  const sections: { key: RegSection; label: string; icon: typeof User }[] = [
    { key: 'demographics', label: 'Demographics', icon: User },
    { key: 'contact', label: 'Contact & address', icon: Phone },
    { key: 'identity', label: 'ID documents', icon: FileText },
    { key: 'insurance', label: 'Insurance', icon: Shield },
    { key: 'emergency', label: 'Emergency contact', icon: Heart },
    { key: 'medical', label: 'Medical history', icon: AlertCircle },
  ];

  async function handleSubmit() {
    const { valid, errors } = validatePatientRegistration(form);
    setFieldErrors(errors);
    if (!valid) {
      setError(errors.map(e => e.message).join('. '));
      // Navigate to section with first error
      const firstField = errors[0]?.field;
      if (['first_name','last_name','gender','age_years','blood_group','date_of_birth'].includes(firstField)) setSection('demographics');
      else if (['phone_primary','email','address_line1','city','pincode'].includes(firstField)) setSection('contact');
      return;
    }
    setSaving(true); setError('');
    const supabase = createClient();
    const { data: uhid, error: seqErr } = await supabase.rpc('hmis_next_sequence', { p_centre_id: activeCentreId, p_type: 'uhid' });
    if (seqErr || !uhid) { setError('UHID generation failed'); setSaving(false); return; }

    const { data: patient, error: insErr } = await supabase.from('hmis_patients').insert({
      uhid, registration_centre_id: activeCentreId,
      first_name: form.first_name, middle_name: form.middle_name || null, last_name: form.last_name,
      gender: form.gender, date_of_birth: form.date_of_birth || null,
      age_years: form.age_years ? parseInt(form.age_years) : null,
      blood_group: form.blood_group || null, marital_status: form.marital_status || null,
      occupation: form.occupation || null, religion: form.religion || null,
      nationality: form.nationality, is_vip: form.is_vip,
      phone_primary: form.phone_primary, phone_secondary: form.phone_secondary || null, email: form.email || null,
      address_line1: form.address_line1 || null, address_line2: form.address_line2 || null,
      city: form.city || null, state: form.state || null, pincode: form.pincode || null,
      id_type: form.id_type || null, id_number: form.id_number || null,
    }).select('id').single();

    if (insErr) { setError(insErr.message); setSaving(false); return; }
    if (form.ec_name && form.ec_phone && patient) {
      await supabase.from('hmis_patient_contacts').insert({ patient_id: patient.id, name: form.ec_name, relationship: form.ec_relationship || 'Other', phone: form.ec_phone, is_emergency: form.ec_is_emergency });
    }
    onSuccess();
  }

  const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">{children}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
  );
  const Inp = ({ n, p, t, v }: { n: string; p?: string; t?: string; v: string }) => (
    <input type={t || 'text'} value={v} onChange={e => u(n, e.target.value)} placeholder={p} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white placeholder:text-gray-400" />
  );
  const Sel = ({ n, v, opts, ph }: { n: string; v: string; opts: { value: string; label: string }[]; ph?: string }) => (
    <select value={v} onChange={e => u(n, e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"><option value="">{ph || 'Select...'}</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-8 overflow-y-auto pb-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-health1-teal/5 to-transparent">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">New patient registration</h2>
            <p className="text-xs text-gray-500 mt-0.5">All fields marked * are mandatory</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 border-b border-gray-100 flex gap-1 overflow-x-auto py-2 bg-gray-50/50">
          {sections.map((s) => { const Icon = s.icon; return (
            <button key={s.key} onClick={() => setSection(s.key)} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all', section === s.key ? 'bg-white text-brand-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60')}>
              <Icon size={13} />{s.label}
            </button>
          ); })}
        </div>

        <div className="px-6 py-5 min-h-[340px]">
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}

          {section === 'demographics' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors cursor-pointer flex-shrink-0">
                  <Camera size={20} /><span className="text-[10px] mt-1 font-medium">Photo</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div><Lbl req>First name</Lbl><Inp n="first_name" v={form.first_name} p="First" /></div>
                  <div><Lbl>Middle name</Lbl><Inp n="middle_name" v={form.middle_name} p="Middle" /></div>
                  <div><Lbl req>Last name</Lbl><Inp n="last_name" v={form.last_name} p="Last" /></div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Lbl req>Gender</Lbl><Sel n="gender" v={form.gender} opts={genderOptions} /></div>
                <div><Lbl>Date of birth</Lbl><Inp n="date_of_birth" v={form.date_of_birth} t="date" /></div>
                <div><Lbl>Age (if no DOB)</Lbl><Inp n="age_years" v={form.age_years} t="number" p="Years" /></div>
                <div><Lbl>Blood group</Lbl><Sel n="blood_group" v={form.blood_group} opts={bloodGroups.map(b => ({ value: b, label: b }))} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Lbl>Marital status</Lbl><Sel n="marital_status" v={form.marital_status} opts={maritalStatuses.map(m => ({ value: m.toLowerCase(), label: m }))} /></div>
                <div><Lbl>Occupation</Lbl><Inp n="occupation" v={form.occupation} p="e.g. Teacher" /></div>
                <div><Lbl>Religion</Lbl><Sel n="religion" v={form.religion} opts={religions.map(r => ({ value: r, label: r }))} /></div>
                <div><Lbl>Nationality</Lbl><Inp n="nationality" v={form.nationality} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={form.is_vip} onChange={e => u('is_vip', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                <span className="text-sm font-medium text-gray-700">VIP patient</span>
              </label>
            </div>
          )}

          {section === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Lbl req>Primary phone</Lbl><Inp n="phone_primary" v={form.phone_primary} t="tel" p="9876543210" /></div>
                <div><Lbl>Secondary phone</Lbl><Inp n="phone_secondary" v={form.phone_secondary} t="tel" p="Optional" /></div>
              </div>
              <div><Lbl>Email</Lbl><Inp n="email" v={form.email} t="email" p="patient@email.com" /></div>
              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Residential address</p>
              <div><Lbl>Address line 1</Lbl><Inp n="address_line1" v={form.address_line1} p="House/flat, street, locality" /></div>
              <div><Lbl>Address line 2</Lbl><Inp n="address_line2" v={form.address_line2} p="Area, landmark" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Lbl>City</Lbl><Inp n="city" v={form.city} /></div>
                <div><Lbl>State</Lbl><select value={form.state} onChange={e => u('state', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none bg-white">{indianStates.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><Lbl>Pincode</Lbl><Inp n="pincode" v={form.pincode} p="380058" /></div>
              </div>
            </div>
          )}

          {section === 'identity' && (
            <div className="space-y-4">
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-xs text-amber-800 font-medium">Government ID helps with insurance claims, PMJAY, and patient identification. Data is encrypted at rest.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Lbl>ID document type</Lbl><Sel n="id_type" v={form.id_type} opts={idTypes} ph="Select ID type" /></div>
                <div><Lbl>ID number</Lbl><Inp n="id_number" v={form.id_number} p={form.id_type === 'aadhaar' ? 'XXXX XXXX XXXX' : 'Document number'} /></div>
              </div>
              <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-400 hover:border-brand-400 transition-colors cursor-pointer">
                <FileText size={24} className="mx-auto mb-2" />
                <p className="text-sm font-medium">Upload ID document scan</p>
                <p className="text-xs mt-1">JPG, PNG, or PDF up to 5 MB</p>
              </div>
            </div>
          )}

          {section === 'insurance' && (
            <div className="space-y-4">
              <div><Lbl>Insurance scheme</Lbl><Sel n="insurance_scheme" v={form.insurance_scheme} opts={payorSchemes} /></div>
              {form.insurance_scheme !== 'none' && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><Lbl>Insurance company</Lbl><Inp n="insurer_name" v={form.insurer_name} p="e.g. Star Health" /></div>
                  <div><Lbl>Policy number</Lbl><Inp n="policy_number" v={form.policy_number} p="Policy/member ID" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Lbl>TPA (if applicable)</Lbl><Inp n="tpa_name" v={form.tpa_name} p="e.g. Medi Assist" /></div>
                  <div><Lbl>Sum insured (₹)</Lbl><Inp n="sum_insured" v={form.sum_insured} t="number" p="500000" /></div>
                </div>
                <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-400 hover:border-brand-400 transition-colors cursor-pointer">
                  <CreditCard size={24} className="mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload insurance card</p>
                  <p className="text-xs mt-1">Front & back · JPG, PNG, or PDF</p>
                </div>
              </>)}
              {form.insurance_scheme === 'pmjay' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-emerald-800 font-medium">PMJAY — eligible for cashless treatment up to ₹5,00,000 per family per year.</p>
                </div>
              )}
            </div>
          )}

          {section === 'emergency' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Person to contact in case of emergency or as next of kin.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Lbl>Contact name</Lbl><Inp n="ec_name" v={form.ec_name} p="Full name" /></div>
                <div><Lbl>Relationship</Lbl><Sel n="ec_relationship" v={form.ec_relationship} opts={relationships.map(r => ({ value: r.toLowerCase(), label: r }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Lbl>Phone number</Lbl><Inp n="ec_phone" v={form.ec_phone} t="tel" p="9876543210" /></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.ec_is_emergency} onChange={e => u('ec_is_emergency', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
                    <span className="text-sm text-gray-700">Primary emergency contact</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {section === 'medical' && (
            <div className="space-y-4">
              <div>
                <Lbl>Known allergies</Lbl>
                <div className="space-y-2">
                  {form.allergies.map((a, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={a.allergen} onChange={e => { const al = [...form.allergies]; al[i].allergen = e.target.value; u('allergies', al); }} placeholder="Allergen (e.g. Penicillin)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      <select value={a.severity} onChange={e => { const al = [...form.allergies]; al[i].severity = e.target.value; u('allergies', al); }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-white">
                        {severities.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => u('allergies', form.allergies.filter((_, j) => j !== i))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => u('allergies', [...form.allergies, { allergen: '', severity: 'mild' }])} className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={12} /> Add allergy</button>
                </div>
              </div>
              <hr className="border-gray-100" />
              <div>
                <Lbl>Past medical / surgical history</Lbl>
                <textarea value={form.medical_history} onChange={e => u('medical_history', e.target.value)} rows={4} placeholder="e.g. DM type 2 (2018), Appendectomy (2020), HTN on medication..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex gap-1">{sections.map(s => <div key={s.key} className={cn('w-2 h-2 rounded-full', section === s.key ? 'bg-brand-500' : 'bg-gray-300')} />)}</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            {section !== 'medical' ? (
              <button onClick={() => { const idx = sections.findIndex(s => s.key === section); if (idx < sections.length - 1) setSection(sections[idx + 1].key); }} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 shadow-sm">Next</button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} className="px-6 py-2.5 bg-health1-teal text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 shadow-sm">{saving ? 'Registering...' : 'Register patient'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
