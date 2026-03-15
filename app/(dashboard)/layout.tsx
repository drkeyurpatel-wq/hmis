'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setStaff, setCentres } = useAuthStore();

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Load staff profile
      const { data: staff } = await supabase
        .from('hmis_staff')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (staff) {
        setStaff(staff);

        // Load staff centres with role info
        const { data: centres } = await supabase
          .from('hmis_staff_centres')
          .select(`
            *,
            centre:hmis_centres(*),
            role:hmis_roles(*)
          `)
          .eq('staff_id', staff.id);

        if (centres) setCentres(centres);
      }
    }

    loadProfile();
  }, [setStaff, setCentres]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main
        className="transition-all duration-200"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
