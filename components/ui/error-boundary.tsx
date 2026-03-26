'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

/**
 * ErrorBoundary — Catches React errors at page level.
 * 
 * Sidebar and header remain functional. Only the content area shows the error.
 * Wrap each page's content area (or use in dashboard layout.tsx to wrap all pages).
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <PageContent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console (future: send to error tracking service)
    console.error('[Health1 HMIS] Page error caught by ErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-h1-md text-center">
          <div className="rounded-full bg-h1-red-light p-4 mb-h1-md">
            <AlertTriangle className="w-12 h-12 text-h1-red" aria-hidden="true" />
          </div>

          <h3 className="text-lg font-semibold text-h1-text mb-h1-xs">
            Something went wrong
          </h3>

          <p className="text-h1-body text-h1-text-secondary max-w-md mb-h1-lg">
            An unexpected error occurred while loading this page.
            Your other navigation options still work — try going back or refreshing.
          </p>

          <div className="flex gap-3 mb-h1-md">
            <button
              onClick={this.handleRetry}
              className="
                inline-flex items-center gap-2 px-4 py-2 rounded-h1
                bg-h1-navy text-white font-medium text-h1-body
                hover:bg-h1-navy/90 transition-colors duration-h1-normal
                cursor-pointer
              "
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>

          {/* Collapsible error details for debugging */}
          {this.state.error && (
            <div className="w-full max-w-lg">
              <button
                onClick={this.toggleDetails}
                className="
                  inline-flex items-center gap-1 text-h1-small text-h1-text-muted
                  hover:text-h1-text-secondary transition-colors cursor-pointer
                "
              >
                {this.state.showDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                {this.state.showDetails ? 'Hide' : 'Show'} error details
              </button>

              {this.state.showDetails && (
                <pre className="mt-2 p-3 bg-gray-50 border border-h1-border rounded-h1-sm text-left text-h1-small text-h1-red overflow-x-auto">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {'\n\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
