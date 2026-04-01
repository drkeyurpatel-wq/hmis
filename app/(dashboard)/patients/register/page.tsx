'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ReferralSource, ReferralSourceType } from '@/lib/referrals/types';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License', 'ABHA Number'];
const STATES = ['Gujarat', 'Rajasthan', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Other'];
const SCHEMES = ['Self Pay', 'Private Insurance', 'PMJAY', 'CGHS', 'ECHS', 'ESI'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];

const CI = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-h1-teal focus:ring-1 focus:ring-h1-teal bg-white';
const CL = 'block text-xs font-semibold text-gray-600 mb-1';
const CC = 'bg-white rounded-2xl border border-gray-200 shadow-sm p-6';

// Quick-add field configs per source type
const QUICK_ADD_FIELDS: Record<string, { label: string; field: string; required?: boolean }[]> = {
  doctor: [
    { label: 'Doctor Name', field: 'name', required: true },
    { label: 'Speciality', field: 'speciality' },
    { label: 'Clinic Name', field: 'clinic_name' },
    { label: 'Phone', field: 'phone' },
  ],
  hospital: [
    { label: 'Hospital/Clinic Name', field: 'name', required: true },
    { label: 'City', field: 'city' },
    { label: 'Phone', field: 'phone' },
  ],
  insurance_agent: [
    { label: 'Agent Name', field: 'name', required: true },
    { label: 'Company', field: 'company' },
    { label: 'Phone', field: 'phone' },
  ],
  campaign: [
    { label: 'Campaign Name', field: 'name', required: true },
  ],
  walkin_source: [
    { label: 'Source Name', field: 'name', required: true },
  ],
};

export default function PatientRegistrationPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // Step 1: Demographics
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

  // Step 2: Contact
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [stateVal, setStateVal] = useState('Gujarat');
  const [pincode, setPincode] = useState('');

  // Step 3: Referral Source
  const [refSourceTypes, setRefSourceTypes] = useState<ReferralSourceType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedTypeCode, setSelectedTypeCode] = useState('');
  const [refSearchTerm, setRefSearchTerm] = useState('');
  const [refSearchResults, setRefSearchResults] = useState<ReferralSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<ReferralSource | null>(null);
  const [refNotes, setRefNotes] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState<Record<string, string>>({});
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [refSearching, setRefSearching] = useState(false);
  const refSearchRef = useRef<HTMLInputElement>(null);

  // Step 4: ID & Insurance
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [scheme, setScheme] = useState('Self Pay');
  const [insurer, setInsurer] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [tpa, setTpa] = useState('');
  const [abhaNumber, setAbhaNumber] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');

  // Step 5: Emergency & Medical
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medHistory, setMedHistory] = useState('');

  // Load referral source types
  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb().from('referral_source_types').select('*').eq('is_active', true).order('label');
        if (data) setRefSourceTypes(data);
      } catch { /* types table may not exist yet */ }
    })();
  }, []);

  // Search referral sources with debounce
  useEffect(() => {
    if (refSearchTerm.length < 2 || !selectedTypeId) {
      setRefSearchResults([]);
      return;
    }
    setRefSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await sb()
          .from('referral_sources')
          .select('*, type:referral_source_types(code, label)')
          .eq('type_id', selectedTypeId)
          .eq('is_active', true)
          .ilike('name', `%${refSearchTerm}%`)
          .order('name')
          .limit(10);

        setRefSearchResults((data || []).map((s: any) => ({
          ...s,
          type_code: s.type?.code || '',
          type_label: s.type?.label || '',
        })));
      } catch { setRefSearchResults([]); }
      setRefSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [refSearchTerm, selectedTypeId]);

  const selectSourceType = useCallback((typeId: string, typeCode: string) => {
    setSelectedTypeId(typeId);
    setSelectedTypeCode(typeCode);
    setSelectedSource(null);
    setRefSearchTerm('');
    setRefSearchResults([]);
    setShowQuickAdd(false);
    setQuickAddData({});
  }, []);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAddData.name?.trim()) return;
    setQuickAddSaving(true);
    try {
      const supabase = sb();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setQuickAddSaving(false); return; }
      const { data: staff } = await supabase.from('hmis_staff').select('primary_centre_id').eq('auth_user_id', user.id).single();
      if (!staff?.primary_centre_id) { setQuickAddSaving(false); return; }

      const insertData: Record<string, any> = {
        centre_id: staff.primary_centre_id,
        type_id: selectedTypeId,
        name: quickAddData.name.trim(),
      };
      if (quickAddData.speciality) insertData.speciality = quickAddData.speciality.trim();
      if (quickAddData.clinic_name) insertData.clinic_name = quickAddData.clinic_name.trim();
      if (quickAddData.hospital_name) insertData.hospital_name = quickAddData.hospital_name.trim();
      if (quickAddData.company) insertData.company = quickAddData.company.trim();
      if (quickAddData.city) insertData.city = quickAddData.city.trim();
      if (quickAddData.phone) insertData.phone = quickAddData.phone.trim();

      const { data: newSource, error: insErr } = await supabase
        .from('referral_sources')
        .insert(insertData)
        .select('*, type:referral_source_types(code, label)')
        .single();

      if (insErr) {
        setError(insErr.message);
      } else if (newSource) {
        setSelectedSource({
          ...newSource,
          type_code: newSource.type?.code || '',
          type_label: newSource.type?.label || '',
        } as any);
        setShowQuickAdd(false);
        setQuickAddData({});
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to add referral source');
    }
    setQuickAddSaving(false);
  }, [quickAddData, selectedTypeId]);

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
      const { data: staff } = await supabase.from('hmis_staff').select('id, primary_centre_id').eq('auth_user_id', user.id).single();
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
        abha_number: abhaNumber.trim() || null, abha_address: abhaAddress.trim() || null,
      }).select('id').single();
      if (insErr) { setError(insErr.message); setSaving(false); return; }

      // Save emergency contact
      if (ecName.trim() && ecPhone.trim() && patient) {
        await supabase.from('hmis_patient_contacts').insert({
          patient_id: patient.id, name: ecName.trim(), relationship: ecRelation || 'Other',
          phone: ecPhone.trim(), is_emergency: true,
        });
      }

      // Save referral source linkage
      if (selectedSource && patient) {
        await supabase.from('patient_referrals').insert({
          centre_id: centreId,
          patient_id: patient.id,
          source_id: selectedSource.id,
          visit_type: 'opd',
          notes: refNotes.trim() || null,
          referred_by_staff_id: staff.id,
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
          <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <h2 className="text-lg font-bold">Patient Registered</h2>
          <div className="mt-3 text-xl font-mono bg-h1-teal-light text-h1-navy px-4 py-3 rounded-xl font-bold">{done}</div>
          <p className="mt-2 text-sm text-gray-500">{firstName} {lastName} — {phone}</p>
          {selectedSource && (
            <p className="mt-1 text-xs text-gray-400">Referred by: {selectedSource.name}</p>
          )}
          <div className="flex gap-3 mt-6 justify-center">
            <a href="/patients" className="px-4 py-2 bg-gray-100 text-sm rounded-lg cursor-pointer">← Patient List</a>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-h1-navy text-white text-sm rounded-lg cursor-pointer">Register Another</button>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = ['Demographics', 'Contact', 'Referral Source', 'ID & Insurance', 'Emergency & Medical'];
  const TOTAL_STEPS = STEPS.length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">New Patient Registration</h1>
          <p className="text-sm text-gray-500">Step {step} of {TOTAL_STEPS} — {STEPS[step - 1]}</p>
        </div>
        <a href="/patients" className="px-3 py-2 bg-gray-100 text-sm rounded-lg cursor-pointer">← Back</a>
      </div>

      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)} className={`flex-1 py-2 text-xs font-medium rounded-lg cursor-pointer ${step === i + 1 ? 'bg-h1-navy text-white' : i + 1 < step ? 'bg-h1-teal-light text-h1-navy' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right text-red-400 cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>}

      <div className={CC}>
        {/* Step 1: Demographics */}
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
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="rounded" /> VIP Patient</label>
        </div>}

        {/* Step 2: Contact */}
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

        {/* Step 3: Referral Source */}
        {step === 3 && <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-700">Referral Source</h3>
            <div className="group relative">
              <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <div className="hidden group-hover:block absolute left-5 top-0 z-10 w-48 p-2 bg-gray-800 text-white text-[10px] rounded-lg shadow-lg">
                How did this patient reach Health1? Select a referral source to track patient acquisition.
              </div>
            </div>
          </div>

          {/* Source Type Pills */}
          <div className="flex flex-wrap gap-2">
            {refSourceTypes.map(t => (
              <button
                key={t.id}
                onClick={() => selectSourceType(t.id, t.code)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors duration-200 cursor-pointer ${
                  selectedTypeId === t.id
                    ? 'bg-h1-navy text-white border-h1-navy'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-h1-teal hover:text-h1-teal'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Selected source display */}
          {selectedSource && (
            <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedSource.name}</p>
                <p className="text-[10px] text-gray-500">
                  {selectedSource.type_label}
                  {selectedSource.speciality && ` — ${selectedSource.speciality}`}
                  {selectedSource.phone && ` — ${selectedSource.phone}`}
                </p>
              </div>
              <button
                onClick={() => { setSelectedSource(null); setRefSearchTerm(''); }}
                className="text-gray-400 hover:text-red-500 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* Search combobox (shown when type selected and no source chosen) */}
          {selectedTypeId && !selectedSource && !showQuickAdd && (
            <div className="relative">
              <label className={CL}>Search {refSourceTypes.find(t => t.id === selectedTypeId)?.label || 'Source'}</label>
              <input
                ref={refSearchRef}
                className={CI}
                value={refSearchTerm}
                onChange={e => setRefSearchTerm(e.target.value)}
                placeholder="Type to search..."
              />
              {refSearching && (
                <div className="absolute right-3 top-8">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-h1-teal rounded-full animate-spin" />
                </div>
              )}

              {/* Search results dropdown */}
              {refSearchTerm.length >= 2 && refSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                  {refSearchResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSource(s);
                        setRefSearchTerm('');
                        setRefSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                    >
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {s.speciality && `${s.speciality} — `}
                        {s.city && `${s.city} — `}
                        {s.phone || ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* No results + quick add prompt */}
              {refSearchTerm.length >= 2 && !refSearching && refSearchResults.length === 0 && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">No matching sources found</p>
                  <button
                    onClick={() => {
                      setShowQuickAdd(true);
                      setQuickAddData({ name: refSearchTerm });
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-h1-navy text-white rounded-lg hover:bg-h1-navy/90 transition-colors cursor-pointer"
                  >
                    + Add New
                  </button>
                </div>
              )}

              {/* Always show quick add button below search */}
              {refSearchTerm.length < 2 && (
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="mt-2 text-xs text-h1-teal font-medium hover:underline cursor-pointer"
                >
                  + Add new referral source
                </button>
              )}
            </div>
          )}

          {/* Quick Add inline form */}
          {showQuickAdd && selectedTypeCode && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-800">Add New {refSourceTypes.find(t => t.id === selectedTypeId)?.label}</h4>
                <button onClick={() => { setShowQuickAdd(false); setQuickAddData({}); }} className="text-blue-400 hover:text-blue-600 cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(QUICK_ADD_FIELDS[selectedTypeCode] || QUICK_ADD_FIELDS.walkin_source).map(f => (
                  <div key={f.field} className={f.field === 'name' && (selectedTypeCode === 'campaign' || selectedTypeCode === 'walkin_source') ? 'col-span-2' : ''}>
                    <label className={CL}>{f.label}{f.required ? ' *' : ''}</label>
                    <input
                      className={`${CI} bg-white`}
                      value={quickAddData[f.field] || ''}
                      onChange={e => setQuickAddData(prev => ({ ...prev, [f.field]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleQuickAdd}
                disabled={quickAddSaving || !quickAddData.name?.trim()}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {quickAddSaving ? 'Adding...' : 'Add & Select'}
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={CL}>Referral Notes (optional)</label>
            <textarea
              className={CI}
              rows={2}
              maxLength={200}
              value={refNotes}
              onChange={e => setRefNotes(e.target.value)}
              placeholder="Any additional context about the referral"
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{refNotes.length}/200</p>
          </div>

          {!selectedSource && !selectedTypeId && (
            <p className="text-xs text-gray-400 italic">If no source is selected, this will be recorded as a walk-in patient.</p>
          )}
        </div>}

        {/* Step 4: ID & Insurance */}
        {step === 4 && <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Identity Documents</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CL}>ID Type</label><select className={CI} value={idType} onChange={e => setIdType(e.target.value)}><option value="">Select</option>{ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={CL}>ID Number</label><input className={CI} value={idNumber} onChange={e => setIdNumber(e.target.value)} /></div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-green-50 border border-orange-200 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">ABHA / ABDM <span className="text-[9px] font-normal bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Ayushman Bharat</span></h3>
            <p className="text-[10px] text-gray-500 mb-3">Link patient&apos;s ABHA Health Account (optional — can be done later)</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={CL}>ABHA Number</label><input className={CI} value={abhaNumber} onChange={e => setAbhaNumber(e.target.value)} placeholder="XX-XXXX-XXXX-XXXX" maxLength={17} /></div>
              <div><label className={CL}>ABHA Address (PHR)</label><input className={CI} value={abhaAddress} onChange={e => setAbhaAddress(e.target.value)} placeholder="username@abdm" /></div>
            </div>
          </div>
          <h3 className="text-sm font-bold text-gray-700 mt-4">Insurance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CL}>Scheme</label><select className={CI} value={scheme} onChange={e => setScheme(e.target.value)}>{SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            {scheme !== 'Self Pay' && <div><label className={CL}>Insurer</label><input className={CI} value={insurer} onChange={e => setInsurer(e.target.value)} /></div>}
            {scheme !== 'Self Pay' && <div><label className={CL}>Policy Number</label><input className={CI} value={policyNo} onChange={e => setPolicyNo(e.target.value)} /></div>}
            {scheme !== 'Self Pay' && <div><label className={CL}>TPA</label><input className={CI} value={tpa} onChange={e => setTpa(e.target.value)} /></div>}
          </div>
        </div>}

        {/* Step 5: Emergency & Medical */}
        {step === 5 && <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Emergency Contact</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CL}>Name</label><input className={CI} value={ecName} onChange={e => setEcName(e.target.value)} /></div>
            <div><label className={CL}>Phone</label><input className={CI} type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} /></div>
            <div><label className={CL}>Relationship</label><input className={CI} value={ecRelation} onChange={e => setEcRelation(e.target.value)} /></div>
          </div>
          <h3 className="text-sm font-bold text-gray-700 mt-4">Medical History</h3>
          <div><label className={CL}>Known Allergies</label><input className={CI} value={allergies} onChange={e => setAllergies(e.target.value)} /></div>
          <div><label className={CL}>Past Medical History</label><textarea className={CI} rows={3} value={medHistory} onChange={e => setMedHistory(e.target.value)} /></div>
          <div className="bg-h1-teal-light rounded-h1 p-4 mt-4">
            <h3 className="text-xs font-bold text-h1-navy mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><b>Name:</b> {firstName} {middleName} {lastName}</div>
              <div><b>Gender:</b> {gender} {age ? `| Age: ${age}` : ''}</div>
              <div><b>Phone:</b> {phone}</div>
              <div><b>City:</b> {city}, {stateVal}</div>
              {selectedSource && <div className="col-span-2"><b>Referred by:</b> {selectedSource.name} ({selectedSource.type_label})</div>}
            </div>
          </div>
        </div>}

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg disabled:opacity-30 cursor-pointer">← Previous</button>
          <span className="text-xs text-gray-400">Step {step} of {TOTAL_STEPS}</span>
          {step < TOTAL_STEPS ? (
            <button onClick={() => setStep(step + 1)} className="px-6 py-2.5 bg-h1-navy text-white text-sm rounded-lg font-medium cursor-pointer">Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="px-8 py-2.5 bg-h1-success text-white text-sm rounded-lg font-bold disabled:opacity-50 cursor-pointer">{saving ? 'Registering...' : 'Register Patient'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
