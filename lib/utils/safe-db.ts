// lib/utils/safe-db.ts
// Wrapper for Supabase operations that provides:
// 1. try/catch on every DB call
// 2. Consistent error return format
// 3. Optional audit trail logging
// 4. Toast-friendly error messages

import { sb } from '@/lib/supabase/browser';

interface SafeResult<T> {
  data: T | null;
  error: string | null;
  ok: boolean;
}

// Wrap any async DB operation with error handling
export async function safeDb<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  context?: string
): Promise<SafeResult<T>> {
  try {
    const { data, error } = await operation();
    if (error) {
      console.error(`[safeDb] ${context || 'DB'}: ${error.message}`);
      return { data: null, error: friendlyError(error.message), ok: false };
    }
    return { data, error: null, ok: true };
  } catch (err: any) {
    console.error(`[safeDb] ${context || 'DB'} threw: ${err.message}`);
    return { data: null, error: friendlyError(err.message), ok: false };
  }
}

// Wrap a mutation (insert/update/delete) with error handling + audit trail
export async function safeMutation<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  audit?: { centreId: string; staffId: string; action: string; entityType: string; entityId: string; details?: string }
): Promise<SafeResult<T>> {
  const result = await safeDb(operation, audit?.action);

  // Log to audit trail if mutation succeeded and audit info provided
  if (result.ok && audit && sb()) {
    try {
      await sb()!.from('hmis_audit_trail').insert({
        centre_id: audit.centreId,
        staff_id: audit.staffId,
        action: audit.action,
        entity_type: audit.entityType,
        entity_id: audit.entityId,
        details: audit.details || null,
        ip_address: null, // Could be populated from request headers
        created_at: new Date().toISOString(),
      });
    } catch {} // Audit failure should never block the primary operation
  }

  return result;
}

// Convenience: wrap a query (no audit needed)
export async function safeQuery<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  context?: string
): Promise<SafeResult<T>> {
  return safeDb(operation, context);
}

// Convert Supabase/Postgres errors to user-friendly messages
function friendlyError(msg: string): string {
  if (msg.includes('duplicate key')) return 'This record already exists.';
  if (msg.includes('violates foreign key')) return 'Referenced record not found.';
  if (msg.includes('violates not-null')) return 'Required field is missing.';
  if (msg.includes('violates check')) return 'Invalid value for one or more fields.';
  if (msg.includes('permission denied') || msg.includes('row-level security')) return 'You do not have permission for this action.';
  if (msg.includes('PGRST116')) return 'Record not found.';
  if (msg.includes('JWT')) return 'Session expired. Please log in again.';
  if (msg.includes('connection') || msg.includes('timeout')) return 'Connection error. Please try again.';
  if (msg.includes('rate limit')) return 'Too many requests. Please wait a moment.';
  return msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
}

// Audit trail helpers for common actions
export function auditCreate(centreId: string, staffId: string, entityType: string, entityId: string, details?: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'create', entity_type: entityType, entity_id: entityId, details, created_at: new Date().toISOString() }).then(() => {});
}

export function auditUpdate(centreId: string, staffId: string, entityType: string, entityId: string, details?: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'update', entity_type: entityType, entity_id: entityId, details, created_at: new Date().toISOString() }).then(() => {});
}

export function auditDelete(centreId: string, staffId: string, entityType: string, entityId: string, details?: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'delete', entity_type: entityType, entity_id: entityId, details, created_at: new Date().toISOString() }).then(() => {});
}

export function auditView(centreId: string, staffId: string, entityType: string, entityId: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'view', entity_type: entityType, entity_id: entityId, created_at: new Date().toISOString() }).then(() => {});
}

export function auditPrint(centreId: string, staffId: string, entityType: string, entityId: string, details?: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'print', entity_type: entityType, entity_id: entityId, details, created_at: new Date().toISOString() }).then(() => {});
}

export function auditExport(centreId: string, staffId: string, entityType: string, entityId: string, details?: string) {
  if (!sb()) return;
  sb()!.from('hmis_audit_trail').insert({ centre_id: centreId, staff_id: staffId, action: 'export', entity_type: entityType, entity_id: entityId, details, created_at: new Date().toISOString() }).then(() => {});
}
