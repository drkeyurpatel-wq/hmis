'use client';

import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormField — Standardized wrapper for all form inputs.
 * 
 * Error messages appear BELOW the field, NEAR the problem (never as toasts).
 * Required fields show a red asterisk.
 * 
 * Usage:
 *   <FormField label="Patient Name" required error={errors.name}>
 *     <FormInput value={name} onChange={setName} placeholder="Full name" />
 *   </FormField>
 */
export function FormField({
  label,
  required = false,
  error,
  helpText,
  htmlFor,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-h1-small font-medium text-h1-text"
      >
        {label}
        {required && <span className="text-h1-red ml-0.5" aria-label="required">*</span>}
      </label>

      {children}

      {error && (
        <p className="flex items-center gap-1 text-h1-small text-h1-red" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!error && helpText && (
        <p className="text-h1-small text-h1-text-muted">
          {helpText}
        </p>
      )}
    </div>
  );
}

/* ============================================================
   INPUT VARIANTS — Compose with FormField
   ============================================================ */

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function FormInput({ hasError, className = '', ...props }: FormInputProps) {
  return (
    <input
      className={`
        w-full px-3 py-2 rounded-h1 border text-h1-body text-h1-text
        bg-white placeholder:text-h1-text-muted
        transition-colors duration-h1-fast
        ${hasError
          ? 'border-h1-red focus:ring-h1-red/30'
          : 'border-h1-border hover:border-h1-teal/50 focus:ring-h1-teal/30'
        }
        focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-gray-50 disabled:text-h1-text-muted disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    />
  );
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function FormSelect({ hasError, options, placeholder, className = '', ...props }: FormSelectProps) {
  return (
    <select
      className={`
        w-full px-3 py-2 rounded-h1 border text-h1-body text-h1-text
        bg-white cursor-pointer appearance-none
        transition-colors duration-h1-fast
        ${hasError
          ? 'border-h1-red focus:ring-h1-red/30'
          : 'border-h1-border hover:border-h1-teal/50 focus:ring-h1-teal/30'
        }
        focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-gray-50 disabled:text-h1-text-muted disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function FormTextarea({ hasError, className = '', ...props }: FormTextareaProps) {
  return (
    <textarea
      className={`
        w-full px-3 py-2 rounded-h1 border text-h1-body text-h1-text
        bg-white placeholder:text-h1-text-muted resize-y min-h-[80px]
        transition-colors duration-h1-fast
        ${hasError
          ? 'border-h1-red focus:ring-h1-red/30'
          : 'border-h1-border hover:border-h1-teal/50 focus:ring-h1-teal/30'
        }
        focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-gray-50 disabled:text-h1-text-muted disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    />
  );
}
