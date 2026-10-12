'use client';

import App from "../core/composition/App";
import { ErrorBoundary } from "../ui/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
