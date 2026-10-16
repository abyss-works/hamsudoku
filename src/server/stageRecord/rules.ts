/**
 * 검증 기록에 쓰는 클리어 시간. 입장 키 발급부터 제출까지의 경과를 초 단위로 내림하고,
 * 시각이 어긋나 경과를 계산할 수 없으면 클라이언트가 보고한 시간을 쓴다.
 */
export function verifiedElapsedSec(input: { nowMs: number; issuedAtMs: number; reportedSec: number }): number {
  const elapsed = input.nowMs - input.issuedAtMs;
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / 1000) : input.reportedSec;
}
