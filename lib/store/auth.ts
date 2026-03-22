import { create } from 'zustand';
import type { Staff, StaffCentre } from '@/types/database';

interface AuthState {
  staff: Staff | null;
  centres: StaffCentre[];
  activeCentreId: string | null;
  enabledModules: Set<string>;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setCentres: (centres: StaffCentre[]) => void;
  setActiveCentre: (centreId: string) => void;
  setEnabledModules: (modules: Set<string>) => void;
  isModuleEnabled: (moduleKey: string) => boolean;
  hasPermission: (module: string, action: string) => boolean;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  staff: null,
  centres: [],
  activeCentreId: null,
  enabledModules: new Set<string>(),
  isLoading: true,

  setStaff: (staff) => set({ staff, isLoading: false }),

  setCentres: (centres) =>
    set({
      centres,
      activeCentreId: centres.length > 0 ? centres[0].centre_id : null,
    }),

  setActiveCentre: (centreId) => set({ activeCentreId: centreId }),

  setEnabledModules: (modules) => set({ enabledModules: modules }),

  isModuleEnabled: (moduleKey) => {
    const { enabledModules, staff } = get();
    if (staff?.staff_type === 'admin') return true;
    if (enabledModules.size === 0) return true;
    return enabledModules.has(moduleKey);
  },

  hasPermission: (module, action) => {
    const { centres, activeCentreId } = get();
    const activeCentre = centres.find((c) => c.centre_id === activeCentreId);
    if (!activeCentre) return false;
    // super_admin has all permissions
    if (activeCentre.role?.name === 'super_admin') return true;
    // Check role_permissions
    return (
      activeCentre.role?.permissions?.some(
        (p: { module: string; action: string }) =>
          p.module === module && p.action === action
      ) ?? false
    );
  },

  reset: () =>
    set({
      staff: null,
      centres: [],
      activeCentreId: null,
      enabledModules: new Set<string>(),
      isLoading: true,
    }),
}));
