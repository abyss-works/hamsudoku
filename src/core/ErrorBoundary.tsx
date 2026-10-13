import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

export interface ErrorBoundaryActions {
  retry(): void;
  reload(): void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  renderFallback: (actions: ErrorBoundaryActions) => ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    Sentry.captureException(error);
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.failed) {
      return this.props.renderFallback({ retry: this.retry, reload: this.reload });
    }
    return this.props.children;
  }
}
