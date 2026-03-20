'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToCSV } from '@/lib/utils/data-export';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { formatDate, calculateAge, getInitials, cn } from '@/lib/utils';
import {
  Search, Phone, MapPin, ChevronRight, User, UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/types/database';

const genderOptions = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

// Registration is at /patients/register — completely separate page

export default function PatientsPage() {
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
          <Link href="/patients/register" className="flex items-center gap-2 px-4 py-2.5 bg-health1-teal text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-all shadow-sm hover:shadow-md">
          <UserPlus size={16} /> New registration
        </Link>
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
            <Link href="/patients/register" className="mt-2 text-sm text-brand-600 hover:underline font-medium">Register first patient</Link>
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

