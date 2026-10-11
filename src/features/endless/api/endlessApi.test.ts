import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptSolution } from '../../../server/crypto';
import { EndlessApiError, fetchMe, fetchMyRank, fetchRank, nextStage, parseSolution, reportFail, submitClear } from './endlessApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nextStage', () => {
  it('서버 암호문을 복호화해 정답을 얻는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const { clientPublicKey } = JSON.parse(String(init?.body)) as { clientPublicKey: string };
        const encrypted = await encryptSolution(clientPublicKey, '0,0;1,2');
        return Response.json({
          stage: { id: 'e-1', size: 7, regions: '0'.repeat(49) },
          solutionCipher: encrypted.solutionCipher,
          serverPublicKey: encrypted.serverPublicKey,
          iv: encrypted.iv,
          attemptKey: 'k1',
        });
      }),
    );
    const out = await nextStage();
    expect(out.stage.id).toBe('e-1');
    expect(out.solution).toEqual([[0, 0], [1, 2]]);
    expect(out.attemptKey).toBe('k1');
  });
});

describe('submitClear', () => {
  it('ok 응답을 파싱한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, earned: 2, balance: 5, streak: 1, suspicious: false })));
    expect(await submitClear({ attemptKey: 'k', stageId: 'e-1', solution: [[0, 0]], seedLeft: 2 })).toMatchObject({ ok: true, earned: 2 });
  });
  it('401은 EndlessApiError다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    await expect(submitClear({ attemptKey: 'k', stageId: 'e-1', solution: [[0, 0]], seedLeft: 2 })).rejects.toBeInstanceOf(EndlessApiError);
  });
});

describe('reportFail', () => {
  it('실패해도 던지지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));
    await expect(reportFail('k')).resolves.toBeUndefined();
  });
});

describe('fetchRank', () => {
  it('랭킹 응답을 파싱한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false }),
      ),
    );
    expect((await fetchRank()).season).toBe('2026-W41');
  });
});

describe('fetchMyRank', () => {
  it('내 순위 응답을 파싱한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ rank: 2, score: 52, nickname: '햄찌' })));
    expect(await fetchMyRank()).toEqual({ rank: 2, score: 52, nickname: '햄찌' });
  });
});

describe('fetchMe', () => {
  it('요약을 파싱한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ wallet: { balance: 3 }, clearedCount: 1, streak: { current: 1, best: 2 }, season: '2026-W41' }),
      ),
    );
    expect((await fetchMe()).wallet.balance).toBe(3);
  });
});

describe('parseSolution', () => {
  it('빈 조각을 무시한다', () => {
    expect(parseSolution('0,0;;1,2;')).toEqual([[0, 0], [1, 2]]);
  });
});
