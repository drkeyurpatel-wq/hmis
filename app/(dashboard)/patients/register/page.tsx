'use client';

// ============================================================
// PATIENT REGISTRATION — BUILT FROM SCRATCH
// RULES:
//   1. ZERO useEffect
//   2. ZERO useCallback / useMemo
//   3. ZERO external hooks (no useAuthStore, no custom hooks)
//   4. ZERO subscriptions
//   5. ONLY useState for form fields
//   6. Supabase called ONLY on submit button click
//   7. Nothing in this file can cause a re-render except typing
// ============================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Inline constants — no imports
const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License'];
const STATES = ['Gujarat','Rajasthan','Maharashtra','Madhya Pradesh','Delhi','Karnataka','Tamil Nadu','Uttar Pradesh','West Bengal','Andhra Pradesh','Bihar','Chhattisgarh','Goa','Haryana','Himachal Pradesh','Jharkhand','Kerala','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Sikkim','Telangana','Tripura','Uttarakhand'];
const SCHEMES = ['Self Pay','Private Insurance','PMJAY','CGHS','ECHS','ESI'];
const RELIGIONS = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Other'];

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PatientRegistrationPage() {
  const router = useRouter();

  // --- form state (ALL local, nothing external) ---
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [marital, setMarital] = useState('');
  const [occupation, setOccupation] = useState('');
  const [religion, setReligion] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [isVip, setIsVip] = useState(false);

  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [state, setState] = useState('Gujarat');
  const [pincode, setPincode] = useState('');

  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [scheme, setScheme] = useState('Self Pay');
  const [insurer, setInsurer] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [tpa, setTpa] = useState('');

  const [ecName, setEcName] = useState('');
  const [ecRelation, setEcRelation] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [medHistory, setMedHistory] = useState('');
  const [allergies, setAllergies] = useState('');

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successUhid, setSuccessUhid] = useState('');

  // --- SUBMIT (only Supabase call in the entire page) ---
  async function handleSubmit() {
    if (!firstName.trim()) { setError('First name is required'); setStep(1); return; }
    if (!lastName.trim()) { setError('Last name is required'); setStep(1); return; }
    if (!gender) { setError('Gender is required'); setStep(1); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError('Valid phone number is required'); setStep(2); return; }

    setSaving(true);
    setError('');

    try {
      const sb = supabase();

      // Get user's centre
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError('Not logged in'); setSaving(false); return; }

      const { data: staff } = await sb.from('hmis_staff').select('primary_centre_id').eq('auth_user_id', user.id).single();
      if (!staff) { setError('Staff profile not found'); setSaving(false); return; }

      const centreId = staff.primary_centre_id;

      // Generate UHID
      const { data: uhid, error: seqErr } = await sb.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'uhid' });
      if (seqErr || !uhid) { setError('UHID generation failed: ' + (seqErr?.message || 'Unknown')); setSaving(false); return; }

      // Insert patient
      const { error: insErr } = await sb.from('hmis_patients').insert({
        uhid,
        registration_centre_id: centreId,
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        gender: gender.toLowerCase(),
        date_of_birth: dob || null,
        age_years: age ? parseInt(age) : null,
        blood_group: bloodGroup || null,
        marital_status: marital || null,
        occupation: occupation || null,
        religion: religion || null,
        nationality: nationality || 'Indian',
        is_vip: isVip,
        phone_primary: phone.trim(),
        phone_secondary: phone2.trim() || null,
        email: email.trim() || null,
        address_line1: addr1.trim() || null,
        address_line2: addr2.trim() || null,
        city: city.trim() || null,
        state: state || null,
        pincode: pincode.trim() || null,
        id_type: idType ? idType.toLowerCase().replace(/ /g, '_') : null,
        id_number: idNumber.trim() || null,
      });

      if (insErr) { setError('Registration failed: ' + insErr.message); setSaving(false); return; }

      setSuccessUhid(uhid);
      setSaving(false);
    } catch (err: any) {
      setError('Error: ' + (err?.message || 'Unknown'));
      setSaving(false);
    }
  }

  // --- STYLES (inline, no Tailwind dependencies that could break) ---
  const card = 'bg-white rounded-2xl border border-gray-200 shadow-sm p-6';
  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const input = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';
  const select = input;
  const btn = 'px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors';
  const btnPrimary = btn + ' bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';
  const btnSecondary = btn + ' bg-gray-100 text-gray-700 hover:bg-gray-200';

  // --- SUCCESS SCREEN ---
  if (successUhid) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className={card + ' text-center'}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Patient Registered</h2>
          <div className="mt-3 text-lg font-mono bg-blue-50 text-blue-700 px-4 py-3 rounded-xl font-bold">{successUhid}</div>
          <p className="mt-2 text-sm text-gray-500">{firstName} {lastName} — {phone}</p>
          <div className="flex gap-3 mt-6 justify-center">
            <button onClick={() => router.push('/patients')} className={btnSecondary}>← Patient List</button>
            <button onClick={() => {
              setSuccessUhid(''); setFirstName(''); setMiddleName(''); setLastName('');
              setGender(''); setDob(''); setAge(''); setBloodGroup(''); setMarital('');
              setOccupation(''); setReligion(''); setNationality('Indian'); setIsVip(false);
              setPhone(''); setPhone2(''); setEmail(''); setAddr1(''); setAddr2('');
              setCity('Ahmedabad'); setState('Gujarat'); setPincode('');
              setIdType(''); setIdNumber(''); setScheme('Self Pay'); setInsurer('');
              setPolicyNo(''); setTpa(''); setEcName(''); setEcRelation('');
              setEcPhone(''); setMedHistory(''); setAllergies(''); setStep(1);
            }} className={btnPrimary}>Register Another</button>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP INDICATOR ---
  const steps = ['Demographics', 'Contact', 'ID & Insurance', 'Emergency & Medical'];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Patient Registration</h1>
          <p className="text-sm text-gray-500">Step {step} of 4 — {steps[step - 1]}</p>
        </div>
        <button onClick={() => router.push('/patients')} className={btnSecondary}>← Back</button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${step === i + 1 ? 'bg-blue-600 text-white' : i + 1 < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

      {/* STEP 1: Demographics */}
      {step === 1 && <div className={card}>
        <div className="grid grid-cols-3 gap-4">
          <div><label className={label}>First Name *</label>
            <input className={input} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" autoFocus /></div>
          <div><label className={label}>Middle Name</label>
            <input className={input} value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Middle name" /></div>
          <div><label className={label}>Last Name *</label>
            <input className={input} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" /></div>

          <div><label className={label}>Gender *</label>
            <select className={select} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select></div>
          <div><label className={label}>Date of Birth</label>
            <input className={input} type="date" value={dob} onChange={e => {
              setDob(e.target.value);
              if (e.target.value) { const a = Math.floor((Date.now() - new Date(e.target.value).getTime()) / 31557600000); setAge(String(a)); }
            }} /></div>
          <div><label className={label}>Age (years)</label>
            <input className={input} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Age" min="0" max="120" /></div>

          <div><label className={label}>Blood Group</label>
            <select className={select} value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
              <option value="">Select</option>
              {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
            </select></div>
          <div><label className={label}>Marital Status</label>
            <select className={select} value={marital} onChange={e => setMarital(e.target.value)}>
              <option value="">Select</option>
              {MARITAL.map(m => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className={label}>Religion</label>
            <select className={select} value={religion} onChange={e => setReligion(e.target.value)}>
              <option value="">Select</option>
              {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select></div>

          <div><label className={label}>Occupation</label>
            <input className={input} value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Occupation" /></div>
          <div><label className={label}>Nationality</label>
            <input className={input} value={nationality} onChange={e => setNationality(e.target.value)} /></div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="rounded" /> VIP Patient
            </label>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={() => setStep(2)} className={btnPrimary}>Next → Contact Details</button>
        </div>
      </div>}

      {/* STEP 2: Contact */}
      {step === 2 && <div className={card}>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={label}>Phone Number *</label>
            <input className={input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" maxLength={13} /></div>
          <div><label className={label}>Alternate Phone</label>
            <input className={input} value={phone2} onChange={e => setPhone2(e.target.value)} placeholder="Optional" /></div>
          <div className="col-span-2"><label className={label}>Email</label>
            <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /></div>
          <div className="col-span-2"><label className={label}>Address Line 1</label>
            <input className={input} value={addr1} onChange={e => setAddr1(e.target.value)} placeholder="House/Flat, Street" /></div>
          <div className="col-span-2"><label className={label}>Address Line 2</label>
            <input className={input} value={addr2} onChange={e => setAddr2(e.target.value)} placeholder="Area, Landmark" /></div>
          <div><label className={label}>City</label>
            <input className={input} value={city} onChange={e => setCity(e.target.value)} /></div>
          <div><label className={label}>State</label>
            <select className={select} value={state} onChange={e => setState(e.target.value)}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label className={label}>Pincode</label>
            <input className={input} value={pincode} onChange={e => setPincode(e.target.value)} placeholder="6 digits" maxLength={6} /></div>
        </div>
        <div className="flex justify-between mt-6">
          <button onClick={() => setStep(1)} className={btnSecondary}>← Back</button>
          <button onClick={() => setStep(3)} className={btnPrimary}>Next → ID & Insurance</button>
        </div>
      </div>}

      {/* STEP 3: ID & Insurance */}
      {step === 3 && <div className={card}>
        <h3 className="font-bold text-sm text-gray-700 mb-3">Identity Document</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><label className={label}>ID Type</label>
            <select className={select} value={idType} onChange={e => setIdType(e.target.value)}>
              <option value="">Select</option>
              {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label className={label}>ID Number</label>
            <input className={input} value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="Document number" /></div>
        </div>
        <h3 className="font-bold text-sm text-gray-700 mb-3">Insurance</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={label}>Scheme</label>
            <select className={select} value={scheme} onChange={e => setScheme(e.target.value)}>
              {SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          {scheme !== 'Self Pay' && <>
            <div><label className={label}>Insurer Name</label>
              <input className={input} value={insurer} onChange={e => setInsurer(e.target.value)} placeholder="Insurance company" /></div>
            <div><label className={label}>Policy Number</label>
              <input className={input} value={policyNo} onChange={e => setPolicyNo(e.target.value)} placeholder="Policy / Card number" /></div>
            <div><label className={label}>TPA</label>
              <input className={input} value={tpa} onChange={e => setTpa(e.target.value)} placeholder="Third party administrator" /></div>
          </>}
        </div>
        <div className="flex justify-between mt-6">
          <button onClick={() => setStep(2)} className={btnSecondary}>← Back</button>
          <button onClick={() => setStep(4)} className={btnPrimary}>Next → Emergency & Medical</button>
        </div>
      </div>}

      {/* STEP 4: Emergency & Medical */}
      {step === 4 && <div className={card}>
        <h3 className="font-bold text-sm text-gray-700 mb-3">Emergency Contact</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div><label className={label}>Contact Name</label>
            <input className={input} value={ecName} onChange={e => setEcName(e.target.value)} placeholder="Name" /></div>
          <div><label className={label}>Relationship</label>
            <input className={input} value={ecRelation} onChange={e => setEcRelation(e.target.value)} placeholder="Spouse, Parent..." /></div>
          <div><label className={label}>Phone</label>
            <input className={input} value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="Phone number" /></div>
        </div>
        <h3 className="font-bold text-sm text-gray-700 mb-3">Medical History</h3>
        <div className="grid grid-cols-1 gap-4">
          <div><label className={label}>Known Allergies</label>
            <input className={input} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g., Penicillin, Sulfa drugs, Iodine..." /></div>
          <div><label className={label}>Medical History</label>
            <textarea className={input + ' resize-none'} rows={3} value={medHistory} onChange={e => setMedHistory(e.target.value)} placeholder="DM, HTN, previous surgeries, chronic conditions..." />
        </div>

        {/* Summary before submit */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs">
          <div className="font-bold text-gray-700 mb-2">Review</div>
          <div className="grid grid-cols-2 gap-1">
            <div><b>Name:</b> {firstName} {middleName} {lastName}</div>
            <div><b>Gender:</b> {gender || '—'}</div>
            <div><b>Age:</b> {age || '—'} {dob ? `(DOB: ${dob})` : ''}</div>
            <div><b>Phone:</b> {phone || '—'}</div>
            <div><b>City:</b> {city}</div>
            <div><b>Blood:</b> {bloodGroup || '—'}</div>
            {idType && <div><b>ID:</b> {idType} — {idNumber}</div>}
            {scheme !== 'Self Pay' && <div><b>Insurance:</b> {scheme} — {insurer}</div>}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setStep(3)} className={btnSecondary}>← Back</button>
          <button onClick={handleSubmit} disabled={saving} className={btnPrimary + ' min-w-[200px]'}>
            {saving ? 'Registering...' : '✓ Register Patient'}
          </button>
        </div>
      </div>}
    </div>
  );
}
