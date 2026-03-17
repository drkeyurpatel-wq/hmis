'use client';
import React from 'react';
import { useAuthStore } from '@/lib/store/auth';
import VPMSDashboard from '@/components/vpms/vpms-dashboard';

export default function VPMSPage() {
  const { activeCentreId } = useAuthStore();
  // Map centre ID to VPMS centre code — adjust after checking VPMS centres table
  return (
    <div className="max-w-7xl mx-auto">
      <VPMSDashboard />
    </div>
  );
}
