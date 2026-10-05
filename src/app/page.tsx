'use client';

import { MotionConfig } from 'framer-motion';
import App from "../App";

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  );
}
