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

  componentDidCatch(error: unknown): void {
    // `surface`, not `route`: the adapter fills in the real route, and
    // labelling this 'boundary' there would discard the screen that crashed.
    observability.captureError(error, { surface: 'boundary' });
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
