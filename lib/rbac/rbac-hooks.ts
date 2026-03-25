// lib/rbac/rbac-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// MODULE + ACTION DEFINITIONS (source of truth for UI)
// ============================================================
export const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', actions: ['view', 'admin'] },
  { key: 'patients', label: 'Patients', icon: '👤', actions: ['view', 'create', 'edit', 'delete', 'print', 'export', 'admin'] },
  { key: 'opd', label: 'OPD', icon: '🏥', actions: ['view', 'create', 'edit', 'delete', 'print', 'export', 'admin'] },
  { key: 'appointments', label: 'Appointments', icon: '📅', actions: ['view', 'create', 'edit', 'delete', 'print', 'export'] },
  { key: 'ipd', label: 'IPD', icon: '🛏️', actions: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'] },
  { key: 'bed_management', label: 'Bed Management', icon: '🛌', actions: ['view', 'create', 'edit', 'admin'] },
  { key: 'nursing_station', label: 'Nursing Station', icon: '👩‍⚕️', actions: ['view', 'create', 'edit', 'print'] },
  { key: 'emr', label: 'EMR', icon: '📋', actions: ['view', 'create', 'edit', 'delete', 'print', 'export', 'admin'] },
  { key: 'billing', label: 'Billing & Revenue', icon: '💰', actions: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'] },
  { key: 'pharmacy', label: 'Pharmacy', icon: '💊', actions: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'] },
  { key: 'lab', label: 'Laboratory', icon: '🔬', actions: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'] },
  { key: 'blood_bank', label: 'Blood Bank', icon: '🩸', actions: ['view', 'create', 'edit', 'print', 'approve'] },
  { key: 'radiology', label: 'Radiology', icon: '🩻', actions: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'] },
  { key: 'ot', label: 'Operation Theatre', icon: '🔪', actions: ['view', 'create', 'edit', 'print', 'approve', 'admin'] },
  { key: 'vpms', label: 'VPMS (Procurement)', icon: '🏪', actions: ['view', 'create', 'edit', 'approve', 'admin'] },
  { key: 'homecare', label: 'Homecare', icon: '🏠', actions: ['view', 'create', 'edit', 'print'] },
  { key: 'reports', label: 'MIS & Reports', icon: '📈', actions: ['view', 'export', 'admin'] },
  { key: 'quality', label: 'Quality & NABH', icon: '✅', actions: ['view', 'create', 'edit', 'approve', 'export', 'admin'] },
  { key: 'settings', label: 'Settings', icon: '⚙️', actions: ['view', 'edit', 'admin'] },
  { key: 'command_centre', label: 'Command Centre', icon: '🎯', actions: ['view', 'admin'] },
];

export type Permissions = Record<string, string[]>;

// ============================================================
// ROLES HOOK
// ============================================================
export function useRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb()!.from('hmis_roles').select('*').order('name');
    setRoles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createRole = useCallback(async (name: string, description: string, permissions: Permissions): Promise<{ success: boolean; error?: string }> => {
    const { error } = await sb()!.from('hmis_roles').insert({ name, description, permissions, is_system: false });
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  const updatePermissions = useCallback(async (roleId: string, permissions: Permissions): Promise<{ success: boolean }> => {
    await sb()!.from('hmis_roles').update({ permissions }).eq('id', roleId);
    load();
    return { success: true };
  }, [load]);

  const cloneRole = useCallback(async (roleId: string, newName: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    await createRole(newName, `Cloned from ${role.name}`, role.permissions);
  }, [roles, createRole]);

  return { roles, loading, load, createRole, updatePermissions, cloneRole };
}

// ============================================================
// STAFF MANAGEMENT HOOK
// ============================================================
export function useStaffManagement(centreId: string | null) {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    const { data } = await sb()!.from('hmis_staff')
      .select(`*, centres:hmis_staff_centres(centre_id, role:hmis_roles(id, name, permissions), centre:hmis_centres(name, code))`)
      .eq('primary_centre_id', centreId).order('full_name');
    setStaffList(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Create single user — uses server API route for auth user creation
  const createUser = useCallback(async (data: {
    employeeCode: string; fullName: string; username: string; email?: string; password: string;
    phone: string; staffType: string; designation: string;
    roleName: string; departmentId?: string;
    specialisation?: string; medicalRegNo?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!centreId) return { success: false, error: 'Not ready' };
    try {
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username || data.employeeCode,
          password: data.password,
          fullName: data.fullName,
          employeeCode: data.employeeCode,
          phone: data.phone,
          staffType: data.staffType,
          designation: data.designation,
          centreId,
          roleName: data.roleName,
          departmentId: data.departmentId || null,
          specialisation: data.specialisation || null,
          medicalRegNo: data.medicalRegNo || null,
          email: data.email || null,
        }),
      });
      const result = await res.json();
      if (!result.success) return { success: false, error: result.error };
      load();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [centreId, load]);

  // Bulk create from array
  const bulkCreate = useCallback(async (users: any[]): Promise<{ success: number; failed: number; results: any[] }> => {
    if (!centreId || !sb()) return { success: 0, failed: 0, results: [] };
    const payload = users.map(u => ({ ...u, centre_id: centreId }));
    const { data: result, error } = await sb()!.rpc('create_staff_batch', { p_users: payload });
    if (error) return { success: 0, failed: users.length, results: [{ error: error.message }] };
    load();
    return { success: result?.success || 0, failed: result?.failed || 0, results: result?.results || [] };
  }, [centreId, load]);

  // Change role
  const changeRole = useCallback(async (staffId: string, roleId: string) => {
    if (!centreId || !sb()) return;
    await sb()!.from('hmis_staff_centres').update({ role_id: roleId }).eq('staff_id', staffId).eq('centre_id', centreId);
    load();
  }, [centreId, load]);

  // Toggle active
  const toggleActive = useCallback(async (staffId: string, isActive: boolean) => {
    await sb()!.from('hmis_staff').update({ is_active: isActive }).eq('id', staffId);
    load();
  }, [load]);

  // Reset password
  const resetPassword = useCallback(async (authUserId: string, newPassword: string) => {
    if (!sb()) return { success: false };
    const { error } = await sb()!.auth.admin.updateUserById(authUserId, { password: newPassword });
    return { success: !error, error: error?.message };
  }, []);

  const stats = useMemo(() => ({
    total: staffList.length,
    active: staffList.filter(s => s.is_active).length,
    inactive: staffList.filter(s => !s.is_active).length,
    byType: staffList.reduce((acc: Record<string, number>, s) => { acc[s.staff_type] = (acc[s.staff_type] || 0) + 1; return acc; }, {}),
  }), [staffList]);

  return { staffList, loading, stats, load, createUser, bulkCreate, changeRole, toggleActive, resetPassword };
}

// ============================================================
// PERMISSION CHECKER (for client-side UI)
// ============================================================
export function hasModuleAccess(permissions: Permissions | null | undefined, module: string, action: string = 'view'): boolean {
  if (!permissions) return false;
  const modulePerms = permissions[module];
  if (!modulePerms) return false;
  return modulePerms.includes(action) || modulePerms.includes('admin');
}

export function getAccessibleModules(permissions: Permissions | null | undefined): string[] {
  if (!permissions) return [];
  return Object.keys(permissions).filter(m => {
    const perms = permissions[m];
    return perms && perms.length > 0 && perms.includes('view');
  });
}
