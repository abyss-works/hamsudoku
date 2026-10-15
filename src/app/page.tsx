'use client';

import App from '../App';
import { ErrorBoundary } from '../core/ErrorBoundary';
import { ErrorFallback } from '../presentation/ui/ErrorFallback';

export default function Page() {
  return (
    <ErrorBoundary renderFallback={({ retry, reload }) => (
      <ErrorFallback onRetry={retry} onReload={reload} />
    )}>
      <App />
    </ErrorBoundary>
  );
}
