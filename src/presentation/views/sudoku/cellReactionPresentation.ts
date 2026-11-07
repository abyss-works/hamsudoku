export interface HeartBurst {
  id: number;
  x: number;
  delay: number;
}

const HEART_OFFSETS = [0, -14, 14];

/** 하트 수만큼 가로 위치와 시작 지연을 정한다. 첫 하트는 기존 자리, 나머지는 좌우로 퍼진다. */
export function heartBursts(count: number): HeartBurst[] {
  return HEART_OFFSETS.slice(0, count).map((x, i) => ({ id: i, x, delay: i * 0.08 }));
}

/** 반응 표정을 유지하는 시간(초). 놀람은 짧게, 정답 반응은 길게 보인 뒤 기본 표정으로 돌아간다. */
export function reactionDuration(expression: 'smile' | 'excited' | 'surprised' | 'base'): number {
  return expression === 'surprised' ? 0.6 : 1.2;
}
