'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-h1-navy text-white hover:bg-h1-navy/90 focus-visible:ring-h1-navy',
  secondary: 'border border-h1-teal text-h1-teal hover:bg-h1-teal-light focus-visible:ring-h1-teal',
  danger: 'bg-h1-red text-white hover:bg-h1-red/90 focus-visible:ring-h1-red',
  ghost: 'text-h1-text-secondary hover:bg-gray-100 focus-visible:ring-h1-teal',
  success: 'bg-h1-success text-white hover:bg-h1-success/90 focus-visible:ring-h1-success',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-h1-small gap-1.5',
  md: 'px-4 py-2 text-h1-body gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

const iconSizes: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

/**
 * ActionButton — Standard button with loading state, disabled-during-async.
 * 
 * NEVER allows double-click during async operations.
 * Shows Loader2 spinner when loading. Disabled + reduced opacity.
 * 
 * Usage:
 *   <ActionButton variant="primary" loading={isSaving} icon={Save} onClick={handleSave}>
 *     Save Patient
 *   </ActionButton>
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconRight: IconRight,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium rounded-h1
          transition-all duration-h1-normal
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${loading ? 'animate-none' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin flex-shrink-0" size={iconSize} aria-hidden="true" />
        ) : Icon ? (
          <Icon className="flex-shrink-0" size={iconSize} aria-hidden="true" />
        ) : null}

        {children && <span>{children}</span>}

        {!loading && IconRight && (
          <IconRight className="flex-shrink-0" size={iconSize} aria-hidden="true" />
        )}
      </button>
    );
  }
);

ActionButton.displayName = 'ActionButton';
