'use client';
import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ============================================================
// STANDALONE PATIENT REGISTRATION
// - Own route: /patients/register
// - Zero external hooks, zero subscriptions, zero useEffect
// - Only local useState — nothing can re-render this externally
// ============================================================

const GENDERS = [{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'other', l: 'Other' }];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
const STATES = ['Gujarat', 'Rajasthan', 'Maharashtra', 'Madhya Pradesh', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Other'];
const SCHEMES = [{ v: 'none', l: 'Self Pay (No Insurance)' }, { v: 'private', l: 'Private Insurance' }, { v: 'pmjay', l: 'PMJAY (Ayushman Bharat)' }, { v: 'cghs', l: 'CGHS' }, { v: 'echs', l: 'ECHS' }, { v: 'esi', l: 'ESI' }];

export default function NewPatientRegistration() {
  const router = useRouter();

  // ---- ALL STATE IS LOCAL — nothing external can touch it ----
  const [step, setStep] = useState(1); // 1=Demographics, 2=Contact, 3=ID/Insurance, 4=Emergency/Medical
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Demographics
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

  // Contact
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [state, setState] = useState('Gujarat');
  const [pincode, setPincode] = useState('');

  // ID
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');

  // Insurance
  const [scheme, setScheme] = useState('none');
  const [insurer, setInsurer] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [tpa, setTpa] = useState('');

  // Emergency contact
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('');

  // Medical
  const [allergies, setAllergies] = useState('');
  const [medHistory, setMedHistory] = useState('');

  // ---- SUBMIT ----
  const handleSubmit = async () => {
    // Validate
    if (!firstName.trim()) { setError('First name is required'); setStep(1); return; }
    if (!lastName.trim()) { setError('Last name is required'); setStep(1); return; }
    if (!gender) { setError('Gender is required'); setStep(1); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError('Valid phone number is required'); setStep(2); return; }

    setSaving(true);
    setError('');

    try {
      const supabase = createClient();

      // Get centre ID from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setSaving(false); return; }

      const { data: staffData } = await supabase.from('hmis_staff').select('primary_centre_id').eq('auth_user_id', user.id).single();
      const centreId = staffData?.primary_centre_id;
      if (!centreId) { setError('No centre assigned'); setSaving(false); return; }

      // Generate UHID
      const { data: uhid, error: seqErr } = await supabase.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'uhid' });
      if (seqErr || !uhid) { setError('UHID generation failed: ' + (seqErr?.message || 'Unknown error')); setSaving(false); return; }

      // Insert patient
      const { data: patient, error: insErr } = await supabase.from('hmis_patients').insert({
        uhid,
        registration_centre_id: centreId,
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        gender,
        date_of_birth: dob || null,
        age_years: age ? parseInt(age) : null,
        blood_group: bloodGroup || null,
        marital_status: marital || null,
        occupation: occupation || null,
        religion: religion || null,
        nationality,
        is_vip: isVip,
        phone_primary: phone.trim(),
        phone_secondary: phone2.trim() || null,
        email: email.trim() || null,
        address_line1: addr1.trim() || null,
        address_line2: addr2.trim() || null,
        city: city.trim() || null,
        state: state || null,
        pincode: pincode.trim() || null,
        id_type: idType || null,
        id_number: idNumber.trim() || null,
      }).select('id').single();

      if (insErr) { setError('Registration failed: ' + insErr.message); setSaving(false); return; }

      // Emergency contact
      if (ecName.trim() && ecPhone.trim() && patient) {
        await supabase.from('hmis_patient_contacts').insert({
          patient_id: patient.id, name: ecName.trim(),
          relationship: ecRelation || 'Other', phone: ecPhone.trim(), is_emergency: true,
        });
      }

      setSuccess(`Patient registered successfully! UHID: ${uhid}`);
      setTimeout(() => router.push('/patients'), 2000);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    }
    setSaving(false);
  };

  // ---- FIELD COMPONENTS (inline, no external deps) ----
  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";
  const selectCls = inputCls;

  // ---- SUCCESS STATE ----
  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-green-700 mb-2">{success}</h2>
        <p className="text-sm text-gray-500">Redirecting to patient list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">New Patient Registration</h1>
          <p className="text-xs text-gray-500">Step {step} of 4</p>
        </div>
        <button onClick={() => router.push('/patients')} className="px-3 py-2 bg-gray-100 text-sm rounded-lg">← Back to List</button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {[1, 2, 3, 4].map(s => (
          <button key={s} onClick={() => setStep(s)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${step === s ? 'bg-blue-600 text-white' : s < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {s === 1 ? 'Demographics' : s === 2 ? 'Contact' : s === 3 ? 'ID & Insurance' : 'Emergency & Medical'}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border p-6">

        {/* STEP 1: Demographics */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-gray-700 mb-3">Patient Demographics</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="First Name" required>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} placeholder="First name" autoFocus />
              </Field>
              <Field label="Middle Name">
                <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} className={inputCls} placeholder="Middle name" />
              </Field>
              <Field label="Last Name" required>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="Last name" />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Field label="Gender" required>
                <select value={gender} onChange={e => setGender(e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {GENDERS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                </select>
              </Field>
              <Field label="Date of Birth">
                <input type="date" value={dob} onChange={e => { setDob(e.target.value); if (e.target.value) { const a = Math.floor((Date.now() - new Date(e.target.value).getTime()) / 31557600000); setAge(String(a)); } }} className={inputCls} />
              </Field>
              <Field label="Age (years)">
                <input type="number" value={age} onChange={e => setAge(e.target.value)} className={inputCls} placeholder="Age" min="0" max="120" />
              </Field>
              <Field label="Blood Group">
                <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {BLOOD.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Field label="Marital Status">
                <select value={marital} onChange={e => setMarital(e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {MARITAL.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Occupation">
                <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} className={inputCls} placeholder="Occupation" />
              </Field>
              <Field label="Religion">
                <select value={religion} onChange={e => setReligion(e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Nationality">
                <input type="text" value={nationality} onChange={e => setNationality(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="rounded" />
              <span>VIP Patient</span>
            </label>
          </div>
        )}

        {/* STEP 2: Contact */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-gray-700 mb-3">Contact Information</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Phone (Primary)" required>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="9876543210" autoFocus />
              </Field>
              <Field label="Phone (Secondary)">
                <input type="tel" value={phone2} onChange={e => setPhone2(e.target.value)} className={inputCls} placeholder="Optional" />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="patient@email.com" />
              </Field>
            </div>
            <Field label="Address Line 1">
              <input type="text" value={addr1} onChange={e => setAddr1(e.target.value)} className={inputCls} placeholder="House/Flat No, Street" />
            </Field>
            <Field label="Address Line 2">
              <input type="text" value={addr2} onChange={e => setAddr2(e.target.value)} className={inputCls} placeholder="Area, Landmark" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City">
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
              </Field>
              <Field label="State">
                <select value={state} onChange={e => setState(e.target.value)} className={selectCls}>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Pincode">
                <input type="text" value={pincode} onChange={e => setPincode(e.target.value)} className={inputCls} placeholder="380015" maxLength={6} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 3: ID & Insurance */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-gray-700 mb-3">Identity Documents</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="ID Type">
                <select value={idType} onChange={e => setIdType(e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {ID_TYPES.map(t => <option key={t} value={t.toLowerCase().replace(/ /g, '_')}>{t}</option>)}
                </select>
              </Field>
              <Field label="ID Number">
                <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value)} className={inputCls} placeholder="ID number" />
              </Field>
            </div>

            <h2 className="font-bold text-sm text-gray-700 mt-6 mb-3">Insurance</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Scheme">
                <select value={scheme} onChange={e => setScheme(e.target.value)} className={selectCls}>
                  {SCHEMES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
              {scheme !== 'none' && <>
                <Field label="Insurer / Company">
                  <input type="text" value={insurer} onChange={e => setInsurer(e.target.value)} className={inputCls} placeholder="Insurance company" />
                </Field>
                <Field label="Policy Number">
                  <input type="text" value={policyNo} onChange={e => setPolicyNo(e.target.value)} className={inputCls} placeholder="Policy / member ID" />
                </Field>
                <Field label="TPA">
                  <input type="text" value={tpa} onChange={e => setTpa(e.target.value)} className={inputCls} placeholder="TPA name" />
                </Field>
              </>}
            </div>
          </div>
        )}

        {/* STEP 4: Emergency & Medical */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-gray-700 mb-3">Emergency Contact</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Name">
                <input type="text" value={ecName} onChange={e => setEcName(e.target.value)} className={inputCls} placeholder="Emergency contact name" autoFocus />
              </Field>
              <Field label="Phone">
                <input type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} className={inputCls} placeholder="Phone" />
              </Field>
              <Field label="Relationship">
                <input type="text" value={ecRelation} onChange={e => setEcRelation(e.target.value)} className={inputCls} placeholder="Spouse, Parent, etc." />
              </Field>
            </div>

            <h2 className="font-bold text-sm text-gray-700 mt-6 mb-3">Medical History</h2>
            <Field label="Known Allergies">
              <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} className={inputCls} placeholder="e.g., Penicillin, Sulfa drugs, Peanuts (comma separated)" />
            </Field>
            <Field label="Past Medical History">
              <textarea value={medHistory} onChange={e => setMedHistory(e.target.value)} rows={3} className={inputCls} placeholder="e.g., DM type 2 since 2018, HTN on medication, Appendectomy 2020..." />
            </Field>

            {/* Summary */}
            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <h3 className="text-xs font-bold text-blue-700 mb-2">Registration Summary</h3>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><b>Name:</b> {firstName} {middleName} {lastName}</div>
                <div><b>Gender:</b> {gender} {age ? `| Age: ${age}` : ''}</div>
                <div><b>Phone:</b> {phone}</div>
                <div><b>City:</b> {city}, {state}</div>
                {scheme !== 'none' && <div><b>Insurance:</b> {scheme.toUpperCase()} — {insurer}</div>}
                {ecName && <div><b>Emergency:</b> {ecName} ({ecRelation}) {ecPhone}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}
            className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg disabled:opacity-30">← Previous</button>

          <div className="text-xs text-gray-400">Step {step} of 4</div>

          {step < 4 ? (
            <button onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium">Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="px-8 py-2.5 bg-green-600 text-white text-sm rounded-lg font-bold disabled:opacity-40">
              {saving ? 'Registering...' : 'Register Patient'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
