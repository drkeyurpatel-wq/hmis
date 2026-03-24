// app/px/[token]/page.tsx
// Patient home — the first screen after QR scan

'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useMyOrders, useMyNurseCalls } from '@/lib/px/patient-hooks';
import { FOOD_ORDER_STATUS_LABELS } from '@/lib/px/types';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-3 border-[#1B3A5C] border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Verifying your identity...</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Unable to verify</h2>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        If you need help, please call the nursing station or press the bedside call button.
      </p>
    </div>
  );
}

const ACTION_CARDS = [
  {
    key: 'food',
    path: '/food',
    title: 'Order Food',
    titleGu: 'ભોજન ઓર્ડર',
    description: 'Browse menu & place order',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.126-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z" />
      </svg>
    ),
    bgColor: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
  {
    key: 'nurse',
    path: '/nurse-call',
    title: 'Call Nurse',
    titleGu: 'નર્સ કૉલ',
    description: 'Request nursing assistance',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    bgColor: 'bg-red-50',
    iconColor: 'text-red-600',
    borderColor: 'border-red-200',
  },
  {
    key: 'complaint',
    path: '/complaint',
    title: 'Complaint',
    titleGu: 'ફરિયાદ',
    description: 'Report an issue',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-200',
  },
  {
    key: 'feedback',
    path: '/feedback',
    title: 'Feedback',
    titleGu: 'પ્રતિભાવ',
    description: 'Rate your experience',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200',
  },
];

export default function PxHomePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context, loading, error, token: pxToken } = usePxToken(token);
  const { activeOrders } = useMyOrders(token);
  const { activeCalls } = useMyNurseCalls(token);

  if (loading) return <LoadingScreen />;
  if (error || !context) return <ErrorScreen message={error || 'Unknown error'} />;

  const hasActiveItems = (activeOrders?.length || 0) + (activeCalls?.length || 0) > 0;

  return (
    <div className="px-4 pt-4">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <p className="text-sm text-gray-500">Welcome,</p>
        <h1 className="text-xl font-semibold text-gray-900">{context.patient_name}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {context.bed_label && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Bed {context.bed_label}
            </span>
          )}
          {context.ward_name && (
            <span className="text-gray-400">{context.ward_name}</span>
          )}
        </div>
      </div>

      {/* Active Requests Status */}
      {hasActiveItems && (
        <button
          onClick={() => router.push(`/px/${token}/status`)}
          className="w-full bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-800">
              {(activeOrders?.length || 0) + (activeCalls?.length || 0)} active request(s)
            </span>
          </div>
          <span className="text-xs text-blue-600">View status →</span>
        </button>
      )}

      {/* Action Cards — 2×2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map((card) => (
          <button
            key={card.key}
            onClick={() => router.push(`/px/${token}${card.path}`)}
            className={`${card.bgColor} ${card.borderColor} border rounded-xl p-4 text-left transition-transform active:scale-[0.97]`}
          >
            <div className={`${card.iconColor} mb-3`}>{card.icon}</div>
            <div className="text-sm font-semibold text-gray-900">{card.title}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{card.titleGu}</div>
            <div className="text-xs text-gray-400 mt-1">{card.description}</div>
          </button>
        ))}
      </div>

      {/* Help text */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          For emergencies, please use the bedside call button or dial the nursing station directly.
        </p>
      </div>
    </div>
  );
}
