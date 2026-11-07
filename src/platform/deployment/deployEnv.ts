const ENVIRONMENTS = ['production', 'staging'] as const;

/** 배포 환경 이름(DEPLOY_ENV)을 Sentry environment로 변환한다. 값이 없으면 로컬 개발이고, 허용하지 않는 값이면 오류를 던진다. */
export function sentryEnvironment(deployEnv: string | undefined): string {
  if (!deployEnv) return 'development';
  if ((ENVIRONMENTS as readonly string[]).includes(deployEnv)) return deployEnv;
  throw new Error(`DEPLOY_ENV must be one of ${ENVIRONMENTS.join(', ')}: ${deployEnv}`);
}
