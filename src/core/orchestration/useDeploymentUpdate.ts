import { useEffect, useState } from 'react';
import { watchServerVersion } from '../../platform/deployment/serverVersion';

/** 클라이언트 빌드 버전을 알 때 서버 앱 버전이 다르면 다른 배포의 서버다. */
export function isOtherDeployment(clientVersion: string | undefined, serverVersion: string): boolean {
  if (!clientVersion || clientVersion === 'unknown') return false;
  return clientVersion !== serverVersion;
}

/**
 * 서버 응답의 앱 버전이 클라이언트 빌드와 다르면 새 배포가 있다고 판정한다. 서버는 이전 클라이언트의 요청을 그대로 처리하며,
 * 이 상태는 새로고침 안내에만 쓴다.
 */
export function useDeploymentUpdate(
  clientVersion: string | undefined = process.env.APP_VERSION,
  watch: (onVersion: (version: string) => void) => () => void = watchServerVersion,
): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(
    () =>
      watch((serverVersion) => {
        if (isOtherDeployment(clientVersion, serverVersion)) setUpdateAvailable(true);
      }),
    [clientVersion, watch],
  );
  return { updateAvailable, reload: () => window.location.reload() };
}
