'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import {
  Stethoscope,
  Activity,
  TestTube,
  Scan,
  Receipt,
  Pill,
  BedDouble,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  User,
  Phone,
  Droplets,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

/* ---------- Types ---------- */

type EventType =
  | 'encounter'
  | 'vitals'
  | 'lab'
  | 'radiology'
  | 'bill'
  | 'pharmacy'
  | 'admission';

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  summary: string;
  details: Record<string, unknown>;
}

interface PatientInfo {
  first_name: string;
  last_name: string;
  uhid: string;
  age_years: number | null;
  gender: string | null;
  phone_primary: string | null;
  blood_group: string | null;
}

/* ---------- Constants ---------- */

const EVENT_CONFIG: Record<
  EventType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  encounter: {
    label: 'Encounter',
    icon: Stethoscope,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  vitals: {
    label: 'Vitals',
    icon: Activity,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  lab: {
    label: 'Lab',
    icon: TestTube,
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  radiology: {
    label: 'Radiology',
    icon: Scan,
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  bill: {
    label: 'Bill',
    icon: Receipt,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  pharmacy: {
    label: 'Pharmacy',
    icon: Pill,
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
  admission: {
    label: 'Admission',
    icon: BedDouble,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

const ALL_TYPES: EventType[] = [
  'encounter',
  'vitals',
  'lab',
  'radiology',
  'bill',
  'pharmacy',
  'admission',
];

/* ---------- Helpers ---------- */

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function buildSummary(type: EventType, row: Record<string, unknown>): string {
  switch (type) {
    case 'encounter':
      return `${(row.encounter_type as string) || 'Encounter'} — ${(row.chief_complaint as string) || 'No chief complaint recorded'}`;
    case 'vitals':
      return `BP ${row.systolic_bp ?? '--'}/${row.diastolic_bp ?? '--'}, HR ${row.heart_rate ?? '--'}, SpO2 ${row.spo2 ?? '--'}%, Temp ${row.temperature ?? '--'}`;
    case 'lab': {
      const testName = (row.test as { name?: string })?.name || (row.test_name as string) || 'Lab test';
      return `${testName} — ${(row.status as string) || 'ordered'}`;
    }
    case 'radiology': {
      const radTestName = (row.test as { name?: string })?.name || (row.test_name as string) || 'Radiology';
      return `${radTestName} — ${(row.status as string) || 'ordered'}`;
    }
    case 'bill':
      return `Bill #${(row.bill_number as string) || (row.id as string)?.slice(0, 8)} — INR ${row.total_amount ?? '0'} (${(row.status as string) || 'pending'})`;
    case 'pharmacy':
      return `Dispensed ${(row.drug_name as string) || 'medication'} — qty ${row.quantity ?? ''}`;
    case 'admission':
      return `Admitted to ${(row.ward_name as string) || (row.department as string) || 'ward'} — ${(row.status as string) || 'active'}`;
    default:
      return 'Clinical event';
  }
}

function getTimestamp(type: EventType, row: Record<string, unknown>): string {
  switch (type) {
    case 'vitals':
      return (row.recorded_at as string) || (row.created_at as string) || '';
    case 'admission':
      return (row.admission_date as string) || (row.created_at as string) || '';
    default:
      return (row.created_at as string) || '';
  }
}

/* ---------- Skeleton ---------- */

function TimelineSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading timeline">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            {i < 4 && <div className="w-0.5 flex-1 bg-gray-200 mt-2" />}
          </div>
          <div className="flex-1 pb-6">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-20 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading patient timeline</span>
    </div>
  );
}

/* ---------- Event Card ---------- */

function EventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      {/* Icon + vertical line */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bgColor} ${config.color} cursor-pointer transition-shadow duration-200 hover:ring-2 hover:ring-offset-1 hover:ring-current focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current`}
          aria-expanded={expanded}
          aria-label={`Toggle ${config.label} details`}
        >
          <Icon className="h-5 w-5" />
        </button>
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Badge + timestamp */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
                >
                  {config.label}
                </span>
                <time
                  dateTime={event.timestamp}
                  className="text-xs text-gray-500"
                  title={formatDate(event.timestamp)}
                >
                  {relativeTime(event.timestamp)}
                </time>
              </div>
              {/* Summary */}
              <p className="text-sm text-gray-800 mt-1">{event.summary}</p>
              {/* Absolute date */}
              <p className="text-xs text-gray-400 mt-1">{formatDate(event.timestamp)}</p>
            </div>
            <span className="shrink-0 text-gray-400 mt-1">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div
              className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(event.details)
                  .filter(
                    ([key, val]) =>
                      val !== null &&
                      val !== undefined &&
                      key !== 'test' &&
                      typeof val !== 'object'
                  )
                  .map(([key, val]) => (
                    <div key={key} className="flex gap-1">
                      <dt className="font-medium text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </dt>
                      <dd className="text-gray-700 truncate">{String(val)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function PatientTimelinePage() {
  const params = useParams();
  const id = params.id as string;
  const staff = useAuthStore((s) => s.staff);

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(ALL_TYPES));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch patient info + all event sources in parallel
      const [
        patientRes,
        encountersRes,
        vitalsRes,
        labRes,
        radioRes,
        billsRes,
        pharmacyRes,
        admissionsRes,
      ] = await Promise.all([
        sb()
          .from('hmis_patients')
          .select('first_name, last_name, uhid, age_years, gender, phone_primary, blood_group')
          .eq('id', id)
          .single(),
        sb()
          .from('hmis_emr_encounters')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false }),
        sb()
          .from('hmis_vitals')
          .select('*')
          .eq('patient_id', id)
          .order('recorded_at', { ascending: false }),
        sb()
          .from('hmis_lab_orders')
          .select('*, test:hmis_lab_test_master(name)')
          .eq('patient_id', id)
          .order('created_at', { ascending: false }),
        sb()
          .from('hmis_radiology_orders')
          .select('*, test:hmis_radiology_test_master(name)')
          .eq('patient_id', id)
          .order('created_at', { ascending: false }),
        sb()
          .from('hmis_bills')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false }),
        sb()
          .from('hmis_pharmacy_dispensing')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false }),
        sb()
          .from('hmis_admissions')
          .select('*')
          .eq('patient_id', id)
          .order('admission_date', { ascending: false }),
      ]);

      if (patientRes.error) {
        setError('Unable to load patient information. Please try again.');
        setLoading(false);
        return;
      }

      setPatient(patientRes.data as PatientInfo);

      // Build unified timeline
      const allEvents: TimelineEvent[] = [];

      const addEvents = (
        type: EventType,
        rows: Record<string, unknown>[] | null
      ) => {
        if (!rows) return;
        for (const row of rows) {
          const ts = getTimestamp(type, row);
          if (!ts) continue;
          allEvents.push({
            id: `${type}-${row.id as string}`,
            type,
            timestamp: ts,
            summary: buildSummary(type, row),
            details: row,
          });
        }
      };

      addEvents('encounter', encountersRes.data as Record<string, unknown>[] | null);
      addEvents('vitals', vitalsRes.data as Record<string, unknown>[] | null);
      addEvents('lab', labRes.data as Record<string, unknown>[] | null);
      addEvents('radiology', radioRes.data as Record<string, unknown>[] | null);
      addEvents('bill', billsRes.data as Record<string, unknown>[] | null);
      addEvents('pharmacy', pharmacyRes.data as Record<string, unknown>[] | null);
      addEvents('admission', admissionsRes.data as Record<string, unknown>[] | null);

      // Sort descending by timestamp
      allEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setEvents(allEvents);
    } catch {
      setError('An unexpected error occurred while loading the timeline.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      if (!activeTypes.has(evt.type)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(evt.timestamp) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(evt.timestamp) > to) return false;
      }
      return true;
    });
  }, [events, activeTypes, dateFrom, dateTo]);

  const toggleType = (type: EventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (activeTypes.size === ALL_TYPES.length) {
      setActiveTypes(new Set());
    } else {
      setActiveTypes(new Set(ALL_TYPES));
    }
  };

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-gray-500">Please sign in to view patient timeline.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors duration-200 mb-4 focus:outline-none focus:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patient
      </Link>

      {/* Patient header */}
      {patient ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900">
                {patient.first_name} {patient.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-0.5">
                <span>UHID: {patient.uhid}</span>
                {patient.age_years !== null && patient.gender && (
                  <span>
                    {patient.age_years}y / {patient.gender}
                  </span>
                )}
                {patient.blood_group && (
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5" />
                    {patient.blood_group}
                  </span>
                )}
                {patient.phone_primary && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {patient.phone_primary}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="mb-6 h-20 animate-pulse rounded-lg bg-gray-100" />
      ) : null}

      {/* Page title */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-gray-400" />
        <h2 className="text-base font-medium text-gray-700">Patient 360 Timeline</h2>
        {!loading && (
          <span className="text-xs text-gray-400">
            ({filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filters</span>
        </div>

        {/* Type toggles */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={toggleAll}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              activeTypes.size === ALL_TYPES.length
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {ALL_TYPES.map((type) => {
            const config = EVENT_CONFIG[type];
            const Icon = config.icon;
            const active = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  active
                    ? `${config.bgColor} ${config.color} border-current`
                    : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 transition-colors duration-200 focus:outline-none focus:underline"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          >
            Retry
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">No clinical events recorded yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {events.length > 0
              ? 'Try adjusting the filters above to see more events.'
              : 'Events from encounters, vitals, labs, radiology, billing, pharmacy, and admissions will appear here.'}
          </p>
        </div>
      ) : (
        <div role="list" aria-label="Patient timeline">
          {filteredEvents.map((event) => (
            <div key={event.id} role="listitem">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
