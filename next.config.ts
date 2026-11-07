import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  // 컨테이너 이미지에 필요한 파일만 .next/standalone으로 추적해 모은다.
  output: 'standalone',
  env: {
    // 서버 응답의 Server-Timing과 Sentry 태그에 쓰는 앱 버전.
    APP_VERSION: packageJson.version,
    // 서버·브라우저 Sentry의 environment. 빌드 시점 값이 번들에 들어가며, 없으면 로컬 개발로 본다.
    ...(process.env.DEPLOY_ENV ? { DEPLOY_ENV: process.env.DEPLOY_ENV } : {}),
  },
};

// org·project·authToken은 SENTRY_ORG·SENTRY_PROJECT·SENTRY_AUTH_TOKEN 환경 변수에서 읽는다.
// 토큰이 없으면 소스맵 업로드만 건너뛴다.
export default withSentryConfig(nextConfig, {
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
