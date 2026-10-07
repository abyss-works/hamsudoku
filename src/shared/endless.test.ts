import { describe, expect, it } from 'vitest';
import {
  ENDLESS_MIRROR_KEY,
  clearRequestSchema,
  clearResponseSchema,
  endlessMirrorSchema,
  nextResponseSchema,
  rankResponseSchema,
} from './endless';

describe('계약 스키마', () => {
  it('next 응답을 파싱한다', () => {
    const parsed = nextResponseSchema.safeParse({
      stage: { id: 'e-000123', size: 7, regions: '0123456'.repeat(7) },
      solutionCipher: 'abc',
      serverPublicKey: 'def',
      iv: 'ghi',
      attemptKey: 'jkl',
    });
    expect(parsed.success).toBe(true);
  });

  it('clear 요청은 seedLeft 4를 거부한다', () => {
    const parsed = clearRequestSchema.safeParse({
      attemptKey: 'k',
      stageId: 'e-1',
      solution: [[0, 1]],
      seedLeft: 4,
    });
    expect(parsed.success).toBe(false);
  });

  it('clear 응답을 파싱한다', () => {
    const parsed = clearResponseSchema.safeParse({
      ok: true,
      earned: 2,
      balance: 5,
      streak: 3,
      suspicious: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('rank 응답의 me.rank null을 허용한다', () => {
    const parsed = rankResponseSchema.safeParse({
      season: '2026-W41',
      top: [],
      snapshotAt: '2026-10-07T00:00:00.000Z',
      me: { rank: null, score: 0 },
    });
    expect(parsed.success).toBe(true);
  });

  it('미러 스키마와 저장 키를 노출한다', () => {
    expect(ENDLESS_MIRROR_KEY).toBe('hamsudoku:endless:v1');
    const parsed = endlessMirrorSchema.safeParse({
      v: 1,
      wallet: { balance: 3 },
      clearedIds: ['e-1'],
      streak: { current: 1, best: 2 },
      season: '2026-W41',
    });
    expect(parsed.success).toBe(true);
  });
});
