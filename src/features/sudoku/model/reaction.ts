import type { CellState } from './puzzles';

export type Expression = 'base' | 'smile' | 'excited' | 'surprised';
/** 정답 반응의 크기. 하트 수와 같다. */
export type ReactionTier = 1 | 2 | 3;

/** 마지막 확정의 반응. seq는 반응마다 오르며 같은 칸의 반복 반응을 구분한다. */
export interface Reaction {
  kind: 'correct' | 'wrong';
  tier: ReactionTier;
  key: string;
  seq: number;
}

export interface CellReaction {
  expression: Expression;
  hearts: number;
  seq: number;
}

/** 연속 정답 1회는 1단계, 2~3회는 2단계, 4회 이상과 판을 끝내는 정답은 3단계다. */
export function reactionTier(correctRun: number, completed: boolean): ReactionTier {
  if (completed || correctRun >= 4) return 3;
  return correctRun >= 2 ? 2 : 1;
}

/** 정답 반응은 확정한 칸만, 오답 반응은 보드의 모든 햄스터가 받는다. */
export function cellReaction(reaction: Reaction | null, key: string, state: CellState): CellReaction | null {
  if (!reaction || state !== 'hamster') return null;
  if (reaction.kind === 'wrong') return { expression: 'surprised', hearts: 0, seq: reaction.seq };
  if (reaction.key !== key) return null;
  return { expression: reaction.tier === 3 ? 'excited' : 'smile', hearts: reaction.tier, seq: reaction.seq };
}
