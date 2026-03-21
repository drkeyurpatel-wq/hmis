'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { GlobalHeader } from '@/components/layout/header';
import { ToastProvider } from '@/components/ui/shared';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import { useKeyboardShortcuts, ShortcutHelpModal } from '@/components/ui/keyboard-shortcuts';
import { registerServiceWorker } from '@/lib/offline/sync-manager';

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

  // Register service worker for offline support
  useEffect(() => { registerServiceWorker(); }, []);

  // Online/offline status
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        {!online && <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-center py-1.5 text-xs font-medium">⚡ Offline — changes will sync when connection returns</div>}
        <ShortcutHelpModal show={showHelp} onClose={() => setShowHelp(false)} />
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-20 md:hidden w-10 h-10 bg-white border rounded-lg flex items-center justify-center shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <main
          className="transition-all duration-200 min-h-screen md:ml-[240px]"
        >
          <GlobalHeader />
          <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-full overflow-x-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
