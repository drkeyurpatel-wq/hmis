// lib/types/supabase-joins.ts
// Common shapes returned by Supabase .select() with joins.
// Used to replace 'as any' casts on joined table fields.
// These are intentionally loose (Partial) since Supabase returns
// only the selected columns, not the full row.

export interface PatientRef {
  id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  uhid?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  age?: number;
}

export interface StaffRef {
  id?: string;
  full_name?: string;
  specialisation?: string;
  employee_code?: string;
  staff_type?: string;
  department_id?: string;
}

export interface BedRef {
  id?: string;
  bed_number?: string;
  bed_type?: string;
  room_id?: string;
  room?: RoomRef;
  room_category?: string;
  ward_type?: string;
  is_occupied?: boolean;
}

export interface RoomRef {
  id?: string;
  room_name?: string;
  room_number?: string;
  room_category?: string;
  ward_type?: string;
  ward?: WardRef;
  centre_id?: string;
}

export interface WardRef {
  id?: string;
  ward_name?: string;
  ward_type?: string;
  floor?: string;
}

export interface CentreRef {
  id?: string;
  centre_name?: string;
  centre_code?: string;
  centre_type?: string;
}

export interface OTRoomRef {
  id?: string;
  name?: string;
  room_number?: string;
  centre_id?: string;
}

export interface OTBookingRef {
  id?: string;
  ot_room_id?: string;
  ot_room?: OTRoomRef;
  scheduled_start?: string;
  scheduled_end?: string;
}

// Helper: extract nested joined field safely
// Usage: joined(row.patient)?.full_name
export function joined<T>(ref: unknown): T | undefined {
  if (ref === null || ref === undefined) return undefined;
  if (Array.isArray(ref)) return ref[0] as T;
  return ref as T;
}
