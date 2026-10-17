import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  // 서버 응답의 Server-Timing과 Sentry 태그에 쓰는 앱 버전.
  env: { APP_VERSION: packageJson.version },
};

// org·project·authToken은 SENTRY_ORG·SENTRY_PROJECT·SENTRY_AUTH_TOKEN 환경 변수에서 읽는다.
// 토큰이 없으면 소스맵 업로드만 건너뛴다.
export default withSentryConfig(nextConfig, {
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
