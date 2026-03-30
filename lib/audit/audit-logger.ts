// lib/audit/audit-logger.ts
// Central audit trail writer — call from every clinical/billing action
import { sb } from '@/lib/supabase/browser';

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'print' | 'sign' | 'cancel' | 'approve' | 'reject';

export interface AuditEntry {
  centreId: string;
  userId: string;
  action: AuditAction;
  entityType: string;    // 'patient', 'encounter', 'admission', 'bill', 'prescription', etc.
  entityId?: string;     // UUID of the record
  entityLabel?: string;  // Human-readable: "Bill IPD-260320-0001" or "Patient H1-00342"
  changes?: Record<string, any>; // { field: { old: x, new: y } }
}

/**
 * Write an audit trail entry. Fire-and-forget — does not throw.
 * Call after every significant clinical or billing action.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  if (!sb()) return;
  try {
    await sb().from('hmis_audit_trail').insert({
      centre_id: entry.centreId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      entity_label: entry.entityLabel || null,
      changes: entry.changes || null,
    });
  } catch {
    // Silent fail — audit should never block clinical workflow
  }
}

/**
 * Shorthand helpers
 */
export const auditCreate = (centreId: string, userId: string, entityType: string, entityId: string, label?: string) =>
  logAudit({ centreId, userId, action: 'create', entityType, entityId, entityLabel: label });

export const auditUpdate = (centreId: string, userId: string, entityType: string, entityId: string, changes: Record<string, any>, label?: string) =>
  logAudit({ centreId, userId, action: 'update', entityType, entityId, entityLabel: label, changes });

export const auditSign = (centreId: string, userId: string, entityType: string, entityId: string, label?: string) =>
  logAudit({ centreId, userId, action: 'sign', entityType, entityId, entityLabel: label });

export const auditCancel = (centreId: string, userId: string, entityType: string, entityId: string, label?: string) =>
  logAudit({ centreId, userId, action: 'cancel', entityType, entityId, entityLabel: label });

export const auditPrint = (centreId: string, userId: string, entityType: string, entityId: string, label?: string) =>
  logAudit({ centreId, userId, action: 'print', entityType, entityId, entityLabel: label });

export const auditApprove = (centreId: string, userId: string, entityType: string, entityId: string, label?: string) =>
  logAudit({ centreId, userId, action: 'approve', entityType, entityId, entityLabel: label });
