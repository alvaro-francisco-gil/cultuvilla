import React from 'react';
import { observability } from '@cultuvilla/shared';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ObservabilityErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }): void {
    observability.captureError(error, { route: info.componentStack ? 'boundary' : 'boundary' });
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
