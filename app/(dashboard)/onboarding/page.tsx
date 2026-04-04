'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/ui/shared';
import CentreOnboarding from '@/components/onboarding/centre-onboarding';

function OnboardingInner() {
  const router = useRouter();
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">New Centre Setup</h1>
        <p className="text-sm text-gray-500 mt-1">Configure a new hospital centre in 5 steps — no code changes required.</p>
      </div>
      <CentreOnboarding onComplete={(centreId) => {
        // Refresh centres in auth store
        router.push('/settings');
      }} />
    </div>
  );
}

export default function OnboardingPage() { return <RoleGuard module="settings"><OnboardingInner /></RoleGuard>; }
