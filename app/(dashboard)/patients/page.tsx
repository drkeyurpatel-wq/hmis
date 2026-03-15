'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { formatDate, calculateAge, getInitials } from '@/lib/utils';
import { Search, Plus, Phone, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/types/database';

export default function PatientsPage() {
  const { activeCentreId } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  const loadPatients = useCallback(async () => {
    if (!activeCentreId) return;
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('hmis_patients')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (search.trim()) {
      query = query.or(
        `uhid.ilike.%${search}%,phone_primary.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    const { data } = await query;
    setPatients(data || []);
    setLoading(false);
  }, [activeCentreId, search]);

  useEffect(() => {
    const debounce = setTimeout(loadPatients, 300);
    return () => clearTimeout(debounce);
  }, [loadPatients]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2 bg-health1-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          Register patient
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by UHID, name, or phone number..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-sm"
        />
      </div>

      {/* Patient list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading patients...
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-gray-400">
            <p>No patients found</p>
            <button
              onClick={() => setShowRegister(true)}
              className="mt-2 text-brand-600 hover:underline"
            >
              Register first patient
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.map((patient) => (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-brand-700">
                    {getInitials(`${patient.first_name} ${patient.last_name}`)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {patient.first_name} {patient.middle_name || ''} {patient.last_name}
                    </p>
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {patient.uhid}
                    </span>
                    {patient.is_vip && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500">
                      {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O'}
                      {patient.date_of_birth
                        ? ` · ${calculateAge(patient.date_of_birth)}y`
                        : patient.age_years
                        ? ` · ${patient.age_years}y`
                        : ''}
                      {patient.blood_group ? ` · ${patient.blood_group}` : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={11} />
                      {patient.phone_primary}
                    </span>
                    {patient.city && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={11} />
                        {patient.city}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showRegister && (
        <RegisterPatientModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            loadPatients();
          }}
        />
      )}
    </div>
  );
}

function RegisterPatientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { activeCentreId } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    // Generate UHID
    const { data: uhid, error: seqError } = await supabase.rpc(
      'hmis_next_sequence',
      { p_centre_id: activeCentreId, p_type: 'uhid' }
    );

    if (seqError || !uhid) {
      setError('Failed to generate UHID: ' + (seqError?.message || 'Unknown error'));
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('hmis_patients').insert({
      uhid,
      registration_centre_id: activeCentreId,
      first_name: formData.get('first_name') as string,
      middle_name: (formData.get('middle_name') as string) || null,
      last_name: formData.get('last_name') as string,
      gender: formData.get('gender') as string,
      date_of_birth: (formData.get('date_of_birth') as string) || null,
      phone_primary: formData.get('phone_primary') as string,
      email: (formData.get('email') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || 'Gujarat',
      id_type: (formData.get('id_type') as string) || null,
      id_number: (formData.get('id_number') as string) || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-900">Register new patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name *</label>
              <input name="first_name" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Middle name</label>
              <input name="middle_name" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name *</label>
              <input name="last_name" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
              <select name="gender" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of birth</label>
              <input name="date_of_birth" type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
              <input name="phone_primary" required type="tel" placeholder="9876543210" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input name="email" type="email" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input name="city" defaultValue="Ahmedabad" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input name="state" defaultValue="Gujarat" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID type</label>
              <select name="id_type" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">None</option>
                <option value="aadhaar">Aadhaar</option>
                <option value="pan">PAN</option>
                <option value="passport">Passport</option>
                <option value="voter_id">Voter ID</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID number</label>
              <input name="id_number" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-health1-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Registering...' : 'Register patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
