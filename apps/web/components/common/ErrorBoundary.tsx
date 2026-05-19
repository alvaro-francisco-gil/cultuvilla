'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReporter';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { source: 'error-boundary', componentStack: info.componentStack ?? undefined });
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Algo ha ido mal</h1>
      <p className="text-sm text-gray-600 mb-6">
        Se ha producido un error inesperado. Puedes reintentar o recargar la página.
      </p>
      <pre className="text-xs text-left bg-gray-100 rounded-lg p-3 mb-6 overflow-auto max-h-48">
        {error.message}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
      >
        Reintentar
      </button>
    </div>
  );
}
