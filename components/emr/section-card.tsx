// components/emr/section-card.tsx
// Collapsible card wrapper for EMR sections with completion indicator
'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

interface SectionCardProps {
  title: string;
  /** Short label shown in collapsed state (e.g., "2 items") */
  summary?: string;
  /** Whether this section has been filled */
  completed?: boolean;
  /** Badge count (e.g., Rx count, investigation count) */
  badge?: number;
  /** Icon component from Lucide */
  icon?: React.ReactNode;
  /** Start expanded (default true on desktop, false on mobile handled by parent) */
  defaultOpen?: boolean;
  /** Right-side header actions (voice button, etc.) */
  headerActions?: React.ReactNode;
  /** Card content */
  children: React.ReactNode;
  className?: string;
}

export default function SectionCard({
  title,
  summary,
  completed = false,
  badge,
  icon,
  defaultOpen = true,
  headerActions,
  children,
  className = '',
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-h1-card rounded-h1 border border-h1-border shadow-h1-card
      transition-all duration-h1-normal ${className}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5
          hover:bg-h1-navy/[0.02] transition-colors duration-h1-fast cursor-pointer
          rounded-t-h1"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Completion indicator */}
          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
            ${completed ? 'bg-h1-success/10' : 'bg-h1-navy/5'}`}>
            {completed
              ? <Check className="w-3 h-3 text-h1-success" />
              : icon || <div className="w-1.5 h-1.5 rounded-full bg-h1-navy/20" />
            }
          </div>

          <span className="text-h1-card-title text-h1-text truncate">{title}</span>

          {/* Badge */}
          {typeof badge === 'number' && badge > 0 && (
            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-full
              bg-h1-teal/10 text-h1-teal">
              {badge}
            </span>
          )}

          {/* Summary when collapsed */}
          {!open && summary && (
            <span className="text-h1-small text-h1-text-muted truncate ml-1">
              — {summary}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Header actions (shown in both states) */}
          {headerActions && (
            <div onClick={e => e.stopPropagation()}>
              {headerActions}
            </div>
          )}

          {open
            ? <ChevronUp className="w-4 h-4 text-h1-text-muted" />
            : <ChevronDown className="w-4 h-4 text-h1-text-muted" />
          }
        </div>
      </button>

      {/* Content — collapsible */}
      {open && (
        <div className="px-4 pb-4 pt-1 animate-h1-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
