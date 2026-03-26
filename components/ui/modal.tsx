'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

/* ============================================================
   MODAL — Centered overlay for forms and confirmations
   ============================================================ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  preventCloseOnDirty?: boolean;
}

const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  preventCloseOnDirty = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (preventCloseOnDirty) {
      if (!window.confirm('You have unsaved changes. Discard?')) return;
    }
    onClose();
  }, [onClose, preventCloseOnDirty]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-h1-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          relative w-full ${modalSizes[size]} bg-h1-card rounded-h1-lg shadow-h1-modal
          flex flex-col max-h-[90vh]
          sm:max-h-[85vh]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-h1-border">
          <div>
            <h2 id="modal-title" className="text-h1-card-title text-h1-navy">
              {title}
            </h2>
            {description && (
              <p className="text-h1-small text-h1-text-secondary mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-h1-sm text-h1-text-muted hover:text-h1-text hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-h1-border bg-gray-50 rounded-b-h1-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================================================
   SLIDE-OVER — Right-side drawer for detail views
   ============================================================ */

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
  preventCloseOnDirty?: boolean;
}

const slideOverWidths = {
  sm: 'max-w-sm',   // 384px
  md: 'max-w-md',   // 448px
  lg: 'max-w-xl',   // 576px
};

export function SlideOver({
  open,
  onClose,
  title,
  description,
  width = 'md',
  children,
  footer,
  preventCloseOnDirty = false,
}: SlideOverProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (preventCloseOnDirty) {
      if (!window.confirm('You have unsaved changes. Discard?')) return;
    }
    onClose();
  }, [onClose, preventCloseOnDirty]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end animate-h1-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="slideover-title"
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Panel — slides in from right */}
      <div
        className={`
          relative w-full ${slideOverWidths[width]} bg-h1-card shadow-h1-modal
          flex flex-col h-full animate-h1-slide-in
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-h1-border">
          <div>
            <h2 id="slideover-title" className="text-h1-card-title text-h1-navy">
              {title}
            </h2>
            {description && (
              <p className="text-h1-small text-h1-text-secondary mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-h1-sm text-h1-text-muted hover:text-h1-text hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-h1-border bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
