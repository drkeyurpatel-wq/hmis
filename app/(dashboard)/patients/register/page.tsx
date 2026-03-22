'use client';
import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License'];
const STATES = ['Gujarat', 'Rajasthan', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Other'];
const SCHEMES = ['Self Pay', 'Private Insurance', 'PMJAY', 'CGHS', 'ECHS', 'ESI'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];

const CI = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-teal-500 bg-white';
const CL = 'block text-xs font-semibold text-gray-600 mb-1';
const CC = 'bg-white rounded-2xl border border-gray-200 shadow-sm p-6';

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function PatientRegistrationPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

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
  const [stateVal, setStateVal] = useState('Gujarat');
  const [pincode, setPincode] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [scheme, setScheme] = useState('Self Pay');
  const [insurer, setInsurer] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [tpa, setTpa] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medHistory, setMedHistory] = useState('');

  const handleSubmit = async () => {
    if (!firstName.trim()) { setError('First name is required'); setStep(1); return; }
    if (!lastName.trim()) { setError('Last name is required'); setStep(1); return; }
    if (!gender) { setError('Gender is required'); setStep(1); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError('Valid phone (10+ digits) is required'); setStep(2); return; }
    setSaving(true);
    setError('');
    try {
      const supabase = sb();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setSaving(false); return; }
      const { data: staff } = await supabase.from('hmis_staff').select('primary_centre_id').eq('auth_user_id', user.id).single();
      if (!staff?.primary_centre_id) { setError('No centre assigned'); setSaving(false); return; }
      const centreId = staff.primary_centre_id;
      const { data: uhid, error: seqErr } = await supabase.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'uhid' });
      if (seqErr || !uhid) { setError('UHID generation failed'); setSaving(false); return; }
      const { data: patient, error: insErr } = await supabase.from('hmis_patients').insert({
        uhid, registration_centre_id: centreId,
        first_name: firstName.trim(), middle_name: middleName.trim() || null, last_name: lastName.trim(),
        gender: gender.toLowerCase(), date_of_birth: dob || null, age_years: age ? parseInt(age) : null,
        blood_group: bloodGroup || null, marital_status: marital || null,
        occupation: occupation || null, religion: religion || null, nationality,
        is_vip: isVip, phone_primary: phone.trim(), phone_secondary: phone2.trim() || null,
        email: email.trim() || null, address_line1: addr1.trim() || null, address_line2: addr2.trim() || null,
        city: city.trim() || null, state: stateVal || null, pincode: pincode.trim() || null,
        id_type: idType || null, id_number: idNumber.trim() || null,
      }).select('id').single();
      if (insErr) { setError(insErr.message); setSaving(false); return; }
      if (ecName.trim() && ecPhone.trim() && patient) {
        await supabase.from('hmis_patient_contacts').insert({
          patient_id: patient.id, name: ecName.trim(), relationship: ecRelation || 'Other',
          phone: ecPhone.trim(), is_emergency: true,
        });
      }
      setDone(uhid);
    } catch (e: any) { setError(e?.message || 'Unknown error'); }
    setSaving(false);
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className={CC}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-bold">Patient Registered</h2>
          <div className="mt-3 text-xl font-mono bg-blue-50 text-teal-700 px-4 py-3 rounded-xl font-bold">{done}</div>
          <p className="mt-2 text-sm text-gray-500">{firstName} {lastName} — {phone}</p>
          <div className="flex gap-3 mt-6 justify-center">
            <a href="/patients" className="px-4 py-2 bg-gray-100 text-sm rounded-lg">← Patient List</a>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Register Another</button>
          </div>
        </div>
      </div>
    );
  }

  const ST = ['Demographics', 'Contact', 'ID & Insurance', 'Emergency & Medical'];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">New Patient Registration</h1>
          <p className="text-sm text-gray-500">Step {step} of 4 — {ST[step - 1]}</p>
        </div>
        <a href="/patients" className="px-3 py-2 bg-gray-100 text-sm rounded-lg">← Back</a>
      </div>

      <div className="flex gap-1 mb-6">
        {ST.map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)} className={`flex-1 py-2 text-xs font-medium rounded-lg ${step === i + 1 ? 'bg-teal-600 text-white' : i + 1 < step ? 'bg-blue-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right text-red-400">✕</button></div>}

      <div className={CC}>
        {step === 1 && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CL}>First Name *</label><input className={CI} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div><label className={CL}>Middle Name</label><input className={CI} value={middleName} onChange={e => setMiddleName(e.target.value)} /></div>
            <div><label className={CL}>Last Name *</label><input className={CI} value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><label className={CL}>Gender *</label><select className={CI} value={gender} onChange={e => setGender(e.target.value)}><option value="">Select</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><label className={CL}>Date of Birth</label><input className={CI} type="date" value={dob} onChange={e => { setDob(e.target.value); if (e.target.value) setAge(String(Math.floor((Date.now() - new Date(e.target.value).getTime()) / 31557600000))); }} /></div>
            <div><label className={CL}>Age (years)</label><input className={CI} type="number" value={age} onChange={e => setAge(e.target.value)} min="0" max="120" /></div>
            <div><label className={CL}>Blood Group</label><select className={CI} value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}><option value="">Select</option>{BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><label className={CL}>Marital Status</label><select className={CI} value={marital} onChange={e => setMarital(e.target.value)}><option value="">Select</option>{MARITAL.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className={CL}>Occupation</label><input className={CI} value={occupation} onChange={e => setOccupation(e.target.value)} /></div>
            <div><label className={CL}>Religion</label><select className={CI} value={religion} onChange={e => setReligion(e.target.value)}><option value="">Select</option>{RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label className={CL}>Nationality</label><input className={CI} value={nationality} onChange={e => setNationality(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="rounded" /> VIP Patient</label>
        </div>}

        {step === 2 && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CL}>Phone (Primary) *</label><input className={CI} type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><label className={CL}>Phone (Secondary)</label><input className={CI} type="tel" value={phone2} onChange={e => setPhone2(e.target.value)} /></div>
            <div><label className={CL}>Email</label><input className={CI} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>
          <div><label className={CL}>Address Line 1</label><input className={CI} value={addr1} onChange={e => setAddr1(e.target.value)} /></div>
          <div><label className={CL}>Address Line 2</label><input className={CI} value={addr2} onChange={e => setAddr2(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CL}>City</label><input className={CI} value={city} onChange={e => setCity(e.target.value)} /></div>
            <div><label className={CL}>State</label><select className={CI} value={stateVal} onChange={e => setStateVal(e.target.value)}>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={CL}>Pincode</label><input className={CI} value={pincode} onChange={e => setPincode(e.target.value)} maxLength={6} /></div>
          </div>
        </div>}

        {step === 3 && <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Identity Documents</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CL}>ID Type</label><select className={CI} value={idType} onChange={e => setIdType(e.target.value)}><option value="">Select</option>{ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={CL}>ID Number</label><input className={CI} value={idNumber} onChange={e => setIdNumber(e.target.value)} /></div>
          </div>
          <h3 className="text-sm font-bold text-gray-700 mt-4">Insurance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CL}>Scheme</label><select className={CI} value={scheme} onChange={e => setScheme(e.target.value)}>{SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            {scheme !== 'Self Pay' && <div><label className={CL}>Insurer</label><input className={CI} value={insurer} onChange={e => setInsurer(e.target.value)} /></div>}
            {scheme !== 'Self Pay' && <div><label className={CL}>Policy Number</label><input className={CI} value={policyNo} onChange={e => setPolicyNo(e.target.value)} /></div>}
            {scheme !== 'Self Pay' && <div><label className={CL}>TPA</label><input className={CI} value={tpa} onChange={e => setTpa(e.target.value)} /></div>}
          </div>
        </div>}

        {step === 4 && <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Emergency Contact</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CL}>Name</label><input className={CI} value={ecName} onChange={e => setEcName(e.target.value)} /></div>
            <div><label className={CL}>Phone</label><input className={CI} type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} /></div>
            <div><label className={CL}>Relationship</label><input className={CI} value={ecRelation} onChange={e => setEcRelation(e.target.value)} /></div>
          </div>
          <h3 className="text-sm font-bold text-gray-700 mt-4">Medical History</h3>
          <div><label className={CL}>Known Allergies</label><input className={CI} value={allergies} onChange={e => setAllergies(e.target.value)} /></div>
          <div><label className={CL}>Past Medical History</label><textarea className={CI} rows={3} value={medHistory} onChange={e => setMedHistory(e.target.value)} /></div>
          <div className="bg-blue-50 rounded-lg p-4 mt-4">
            <h3 className="text-xs font-bold text-teal-700 mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><b>Name:</b> {firstName} {middleName} {lastName}</div>
              <div><b>Gender:</b> {gender} {age ? `| Age: ${age}` : ''}</div>
              <div><b>Phone:</b> {phone}</div>
              <div><b>City:</b> {city}, {stateVal}</div>
            </div>
          </div>
        </div>}

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg disabled:opacity-30">← Previous</button>
          <span className="text-xs text-gray-400">Step {step} of 4</span>
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="px-8 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-bold disabled:opacity-50">{saving ? 'Registering...' : 'Register Patient'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
