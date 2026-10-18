import { useApiTimingReport } from '../orchestration/apiTimingReport';

/** 앱이 떠 있는 동안 브라우저 기준 API 응답 시간을 보고한다. 화면에는 아무것도 그리지 않는다. */
export function ApiTimingReporter() {
  useApiTimingReport();
  return null;
}
