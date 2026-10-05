'use client';

import { MotionConfig } from 'framer-motion';
import App from "../App";
import { ErrorBoundary } from "../ui/ErrorBoundary";

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  );
}
