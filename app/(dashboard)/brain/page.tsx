'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery } from '@/lib/hooks/use-supabase-query';
import { CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { Activity, Pill, Bug, Clock, Award, ArrowRight } from 'lucide-react';

interface EngineCard {
  title: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

const ENGINES: EngineCard[] = [
  { title: 'Readmission Risk', href: '/brain/readmission', icon: Activity, description: 'Predict 30-day readmission risk for discharged patients' },
  { title: 'Antibiotic Stewardship', href: '/brain/antibiotics', icon: Pill, description: 'Monitor antibiotic prescribing patterns and flag violations' },
  { title: 'Infection Control (HAI)', href: '/brain/infections', icon: Bug, description: 'Track hospital-acquired infection rates per ward and surgeon' },
  { title: 'LOS Optimization', href: '/brain/los', icon: Clock, description: 'Predicted vs actual length of stay with outlier detection' },
  { title: 'Quality Scorecard', href: '/brain/quality', icon: Award, description: 'NABH-aligned clinical quality indicators dashboard' },
];

function SummaryStatCard({ title, value, subtitle, color, icon: Icon, href }: {
  title: string; value: string | number; subtitle: string;
  color: string; icon: React.ElementType; href: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm font-medium text-gray-600">{title}</div>
        <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      </div>
    </Link>
  );
}

function BrainDashboardInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  // Use head: true + count for efficient counting (no row fetching)
  const { data: highRiskPatients, isLoading: loadingRisk } = useSupabaseQuery(
    (sb) => sb.from('brain_readmission_risk').select('id')
      .eq('centre_id', centreId).in('risk_category', ['high', 'very_high']),
    [centreId],
    { enabled: !!centreId }
  );

  const { data: activeAlerts, isLoading: loadingAlerts } = useSupabaseQuery(
    (sb) => sb.from('brain_antibiotic_alerts').select('id')
      .eq('centre_id', centreId).eq('status', 'active'),
    [centreId],
    { enabled: !!centreId }
  );

  const { data: recentInfections, isLoading: loadingInfections } = useSupabaseQuery(
    (sb) => sb.from('brain_infection_events').select('id, infection_type')
      .eq('centre_id', centreId)
      .gte('detection_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    [centreId],
    { enabled: !!centreId }
  );

  const { data: losOutliers, isLoading: loadingLOS } = useSupabaseQuery(
    (sb) => sb.from('brain_los_predictions').select('id')
      .eq('centre_id', centreId).eq('is_outlier', true),
    [centreId],
    { enabled: !!centreId }
  );

  const { data: qualityData, isLoading: loadingQuality } = useSupabaseQuery(
    (sb) => sb.from('brain_quality_indicators').select('overall_quality_score, overall_grade')
      .eq('centre_id', centreId).order('month', { ascending: false }).limit(1),
    [centreId],
    { enabled: !!centreId }
  );

  const isLoading = loadingRisk || loadingAlerts || loadingInfections || loadingLOS || loadingQuality;

  const highRiskCount = highRiskPatients?.length ?? 0;
  const alertCount = activeAlerts?.length ?? 0;
  const ssiCount = recentInfections?.filter((i: Record<string, unknown>) => i.infection_type === 'ssi').length ?? 0;
  const outlierCount = losOutliers?.length ?? 0;
  const latestQuality = qualityData?.[0] as Record<string, unknown> | undefined;
  const qualityGrade = (latestQuality?.overall_grade as string) ?? '--';
  const qualityScore = (latestQuality?.overall_quality_score as number) ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Brain - Clinical Intelligence</h1>
        <p className="text-sm text-gray-500 mt-1">
          Passive AI layer monitoring clinical data across five engines
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <SummaryStatCard
            title="High-Risk Patients"
            value={highRiskCount}
            subtitle={highRiskCount > 10 ? 'Above threshold' : 'This month'}
            color={highRiskCount > 10 ? 'bg-red-500' : 'bg-blue-500'}
            icon={Activity}
            href="/brain/readmission"
          />
          <SummaryStatCard
            title="Antibiotic Alerts"
            value={alertCount}
            subtitle={alertCount > 5 ? 'Action needed' : 'Active alerts'}
            color={alertCount > 5 ? 'bg-red-500' : 'bg-amber-500'}
            icon={Pill}
            href="/brain/antibiotics"
          />
          <SummaryStatCard
            title="SSI Events"
            value={ssiCount}
            subtitle="Last 30 days"
            color={ssiCount > 3 ? 'bg-red-500' : 'bg-green-500'}
            icon={Bug}
            href="/brain/infections"
          />
          <SummaryStatCard
            title="LOS Outliers"
            value={outlierCount}
            subtitle="Exceeding predicted stay"
            color={outlierCount > 5 ? 'bg-amber-500' : 'bg-blue-500'}
            icon={Clock}
            href="/brain/los"
          />
          <SummaryStatCard
            title="Quality Score"
            value={qualityGrade}
            subtitle={qualityScore > 0 ? `${qualityScore}/100` : 'No data yet'}
            color={qualityGrade === 'A' ? 'bg-green-500' : qualityGrade === 'B' ? 'bg-blue-500' : 'bg-amber-500'}
            icon={Award}
            href="/brain/quality"
          />
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Intelligence Engines</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ENGINES.map((engine) => (
          <Link key={engine.href} href={engine.href}>
            <div className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
              <div className="flex items-center gap-3 mb-3">
                <engine.icon className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">{engine.title}</h3>
              </div>
              <p className="text-xs text-gray-500">{engine.description}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-blue-600 font-medium">
                View Dashboard <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BrainDashboard() {
  return (
    <RoleGuard module="brain">
      <BrainDashboardInner />
    </RoleGuard>
  );
}
