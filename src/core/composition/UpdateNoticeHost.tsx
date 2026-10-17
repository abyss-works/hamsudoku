import { useDeploymentUpdate } from '../orchestration/useDeploymentUpdate';
import { UpdateNotice } from '../../presentation/ui/UpdateNotice';

/** 서버 응답에서 새 배포를 감지하면 새로고침 안내를 표시한다. */
export function UpdateNoticeHost() {
  const { updateAvailable, reload } = useDeploymentUpdate();
  return updateAvailable ? <UpdateNotice onReload={reload} /> : null;
}
