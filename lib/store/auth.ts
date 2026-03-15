import { create } from 'zustand';
import type { Staff, StaffCentre } from '@/types/database';

interface AuthState {
  staff: Staff | null;
  centres: StaffCentre[];
  activeCentreId: string | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setCentres: (centres: StaffCentre[]) => void;
  setActiveCentre: (centreId: string) => void;
  hasPermission: (module: string, action: string) => boolean;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  staff: null,
  centres: [],
  activeCentreId: null,
  isLoading: true,

  setStaff: (staff) => set({ staff, isLoading: false }),

  setCentres: (centres) =>
    set({
      centres,
      activeCentreId: centres.length > 0 ? centres[0].centre_id : null,
    }),

  setActiveCentre: (centreId) => set({ activeCentreId: centreId }),

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
      isLoading: true,
    }),
}));
