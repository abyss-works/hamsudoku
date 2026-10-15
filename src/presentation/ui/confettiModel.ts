export const CONFETTI_COLORS = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#8e4ec6', '#f76b15'];

export interface ConfettiPiece {
  id: number;
  x: string;
  color: string;
  duration: number;
}

export function confettiPiecesModel(count = 24): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: `${(i * 41) % 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    duration: 1.6 + ((i * 7) % 10) / 10,
  }));
}

// 반복 횟수 결정. 모션 감소 설정에서는 반복 애니메이션을 끄고 한 번만 떨어진다.
export function confettiRepeat(reduceMotion: boolean): number {
  return reduceMotion ? 0 : Infinity;
}
