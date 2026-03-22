// components/ui/external-link.tsx
// Standardized external link component — enforces rel, target, and disabled states.
//
// Usage:
//   <ExternalLink href="https://example.com">Open</ExternalLink>
//   <ExternalLink href={url} disabled={!url} disabledText="Not available">Open</ExternalLink>

import React from 'react';

interface ExternalLinkProps {
  href: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  disabledText?: string;
  icon?: boolean;
}

export function ExternalLink({
  href,
  children,
  className = '',
  disabled,
  disabledText,
  icon = false,
}: ExternalLinkProps) {
  const isDisabled = disabled || !href;

  if (isDisabled) {
    if (!disabledText) return null;
    return (
      <span className={`opacity-50 cursor-not-allowed ${className}`} title={disabledText}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href!}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {icon && (
        <svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      )}
      {children}
    </a>
  );
}
