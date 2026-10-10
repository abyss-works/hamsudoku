'use client';

import App from "../application/App";
import { ErrorBoundary } from "../ui/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
