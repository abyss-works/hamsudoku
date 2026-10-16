export const MIN_CLEAR_MS = 3_000;
export const MIN_SUBMIT_GAP_MS = 1_000;
export const PERFECT_WINDOW = 20;
export const PERFECT_SUSPICIOUS_AT = 16;

function normalizeSolution(pairs: [number, number][] | string): string {
  if (typeof pairs === 'string') {
    return pairs
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .sort()
      .join(';');
  }
  return pairs.map(([r, c]) => `${r},${c}`).sort().join(';');
}

/** 제출 좌표가 저장된 정답과 같은지 판정한다. 좌표 순서는 무시한다. */
export function solutionMatches(submitted: [number, number][], stored: string): boolean {
  return normalizeSolution(submitted) === normalizeSolution(stored);
}

/** 보상하지 않을 제출의 이벤트 사유와 응답 문구. 정답, 최소 시간, 잔여 씨앗 순서로 판정한다. */
export function clearRejection(input: {
  solutionOk: boolean;
  elapsedMs: number;
  seedLeft: number;
}): { event: string; message: string } | null {
  if (!input.solutionOk) return { event: '정답 불일치', message: '정답이 맞지 않아요.' };
  if (input.elapsedMs < MIN_CLEAR_MS) return { event: '하한 미달', message: '제출이 너무 빨라요.' };
  if (input.seedLeft < 1) return { event: '잔여 씨앗 없음', message: '잔여 씨앗이 없어요.' };
  return null;
}

/**
 * 최근 이벤트(기록 시각 역순)로 제출 간격과 의심 패턴을 판정한다. 간격은 가장 최근의 검증 클리어로부터 계산하고,
 * 의심 패턴은 최근 이벤트 중 씨앗 3개 검증 클리어 수로 판정한다.
 */
export function assessSubmission(
  recent: { verified: boolean; seedLeft: number; createdAt: Date }[],
  now: Date,
): { tooSoon: boolean; suspicious: boolean } {
  const lastVerified = recent.find((event) => event.verified);
  const tooSoon = lastVerified !== undefined && now.getTime() - lastVerified.createdAt.getTime() < MIN_SUBMIT_GAP_MS;
  const perfectCount = recent.filter((event) => event.verified && event.seedLeft === 3).length;
  return { tooSoon, suspicious: perfectCount >= PERFECT_SUSPICIOUS_AT };
}
