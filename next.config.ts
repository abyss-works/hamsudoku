import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// org·project·authToken은 SENTRY_ORG·SENTRY_PROJECT·SENTRY_AUTH_TOKEN 환경 변수에서 읽는다.
// 토큰이 없으면 소스맵 업로드만 건너뛴다.
export default withSentryConfig(nextConfig, {
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
