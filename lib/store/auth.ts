import { create } from 'zustand';
import type { Staff, StaffCentre, CentreType, ClinicCapabilities } from '@/types/database';

interface AuthState {
  staff: Staff | null;
  centres: StaffCentre[];
  activeCentreId: string | null;
  enabledModules: Set<string>;
  isLoading: boolean;

  // Derived clinic mode state
  isClinicMode: boolean;
  isHospitalMode: boolean;
  isFranchise: boolean;
  hubCentreId: string | null;
  clinicCapabilities: ClinicCapabilities;

  setStaff: (staff: Staff | null) => void;
  setCentres: (centres: StaffCentre[]) => void;
  setActiveCentre: (centreId: string) => void;
  setEnabledModules: (modules: Set<string>) => void;
  isModuleEnabled: (moduleKey: string) => boolean;
  hasPermission: (module: string, action: string) => boolean;
  reset: () => void;
}

const DEFAULT_CAPABILITIES: ClinicCapabilities = {
  hasPharmacy: true,
  hasLabCollection: true,
  hasTeleconsult: true,
  opdRooms: 2,
};

function deriveCentreMode(centres: StaffCentre[], activeCentreId: string | null) {
  const activeCentre = centres.find((c) => c.centre_id === activeCentreId);
  const centre = activeCentre?.centre;
  const centreType: CentreType = (centre as any)?.centre_type || 'hospital';
  const isClinic = centreType === 'clinic';

  return {
    isClinicMode: isClinic,
    isHospitalMode: !isClinic,
    isFranchise: (centre as any)?.ownership_type === 'franchise',
    hubCentreId: (centre as any)?.hub_centre_id || null,
    clinicCapabilities: isClinic
      ? {
          hasPharmacy: (centre as any)?.has_pharmacy ?? true,
          hasLabCollection: (centre as any)?.has_lab_collection ?? true,
          hasTeleconsult: (centre as any)?.has_teleconsult ?? true,
          opdRooms: (centre as any)?.opd_rooms ?? 2,
        }
      : DEFAULT_CAPABILITIES,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  staff: null,
  centres: [],
  activeCentreId: null,
  enabledModules: new Set<string>(),
  isLoading: true,

  // Defaults for clinic mode
  isClinicMode: false,
  isHospitalMode: true,
  isFranchise: false,
  hubCentreId: null,
  clinicCapabilities: DEFAULT_CAPABILITIES,

  setStaff: (staff) => set({ staff, isLoading: false }),

  setCentres: (centres) => {
    const activeCentreId = centres.length > 0 ? centres[0].centre_id : null;
    set({
      centres,
      activeCentreId,
      ...deriveCentreMode(centres, activeCentreId),
    });
  },

  setActiveCentre: (centreId) => {
    const { centres } = get();
    set({
      activeCentreId: centreId,
      ...deriveCentreMode(centres, centreId),
    });
  },

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
    // Check role_permissions — permissions may be {} or [] depending on DB state
    const perms = activeCentre.role?.permissions;
    if (!Array.isArray(perms)) return false;
    return perms.some(
      (p: { module: string; action: string }) =>
        p.module === module && p.action === action
    );
  },

  reset: () =>
    set({
      staff: null,
      centres: [],
      activeCentreId: null,
      enabledModules: new Set<string>(),
      isLoading: true,
      isClinicMode: false,
      isHospitalMode: true,
      isFranchise: false,
      hubCentreId: null,
      clinicCapabilities: DEFAULT_CAPABILITIES,
    }),
}));
