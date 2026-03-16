// components/ui/error-boundary.tsx
'use client';

import React, { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; module?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.module || 'HMIS'}] Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.props.module ? `The ${this.props.module} module encountered an error.` : 'An unexpected error occurred.'}
            </p>
            <div className="bg-red-50 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-red-700 font-mono break-all">{this.state.error?.message}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Try again
              </button>
              <button
                onClick={() => { window.location.reload(); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
