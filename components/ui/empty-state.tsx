'use client';

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState — Friendly placeholder when no data exists.
 * 
 * NEVER show an empty table with just column headers.
 * Always use this component instead.
 * 
 * Usage:
 *   <EmptyState
 *     icon={Users}
 *     title="No patients registered yet"
 *     description="Register your first patient to get started."
 *     action={{ label: "Register Patient", onClick: () => router.push('/patients/register') }}
 *   />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-h1-md text-center ${className}`}
      role="status"
    >
      <div className="rounded-full bg-gray-100 p-4 mb-h1-md">
        <Icon className="w-12 h-12 text-h1-text-muted" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-semibold text-h1-text mb-h1-xs">
        {title}
      </h3>

      {description && (
        <p className="text-h1-body text-h1-text-secondary max-w-sm mb-h1-lg">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-h1
            bg-h1-teal text-white font-medium text-h1-body
            hover:bg-h1-teal/90 transition-colors duration-h1-normal
            cursor-pointer focus-visible:ring-2 focus-visible:ring-h1-teal focus-visible:ring-offset-2
          "
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
