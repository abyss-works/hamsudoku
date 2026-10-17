import { describe, expect, it } from 'vitest';
import { createRankStore, rankStoreFromEnv } from './rank';

type Call = { url: string; init: RequestInit };
type Command = unknown[];

/** 스냅샷 조회와 갱신 잠금 획득을 한 번에 수행하는 스크립트 호출인지 판별한다. */
function isReadOrLock(command: Command): boolean {
  return (
    command[0] === 'eval' &&
    command[2] === 2 &&
    String(command[3]).endsWith(':top') &&
    String(command[4]).endsWith(':top:lock')
  );
}

/** 조회·잠금 스크립트 호출의 동작 방식 인자(read 또는 lock)를 돌려준다. */
function readOrLockMode(command: Command): unknown {
  return command[7];
}

/** 원장 스냅샷 게시 스크립트 호출인지 판별한다. */
function isPublish(command: Command): boolean {
  return command[0] === 'eval' && command[2] === 3;
}

/** 소유자 토큰을 확인하는 잠금 해제 스크립트 호출인지 판별한다. */
function isRelease(command: Command): boolean {
  return command[0] === 'eval' && command[2] === 1 && String(command[3]).endsWith(':top:lock');
}

/** 순위 저장소가 보낸 명령을 조회·잠금, 게시, 해제 또는 Redis 명령 이름으로 분류한다. */
function describeCommand(command: Command): string {
  if (isReadOrLock(command)) return `read-or-lock:${String(readOrLockMode(command))}`;
  if (isPublish(command)) return 'publish';
  if (isRelease(command)) return 'release';
  return String(command[0]);
}

function makeStore(replies: unknown[], calls: Call[]) {
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = init?.body ? JSON.parse(String(init.body)) : [];
    if (isReadOrLock(body)) {
      // 조회 방식은 다음 응답을 캐시 값으로 쓰고, 캐시가 없거나 잠금 방식이면 잠금 획득을 응답한다.
      if (readOrLockMode(body) === 'lock') return Response.json({ result: 1 });
      const cached = replies.shift() ?? null;
      return Response.json({ result: cached === null ? 1 : cached });
    }
    if (body[0] === 'eval' && body.some((arg: unknown) => String(arg).includes(':lock'))) {
      return Response.json({ result: 1 });
    }
    return Response.json({ result: replies.shift() ?? null });
  }) as typeof fetch;
  return createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
}

describe('createRankStore', () => {
  it('만료된 표시 캐시는 Redis 점수 누락과 관계없이 원장 전체 합계로 갱신한다', async () => {
    const commands: unknown[][] = [];
    let cached: string | null = null;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body));
      commands.push(command);
      if (isReadOrLock(command)) return Response.json({ result: cached ?? 1 });
      if (command[0] === 'eval' && command[2] === 3) {
        cached = command[9];
        return Response.json({ result: 1 });
      }
      return Response.json({ result: command[0] === 'zrevrange' ? [] : 1 });
    }) as typeof fetch;
    const store = createRankStore({ url: 'https://example.invalid', token: 'test', fetchImpl });
    let ledgerReads = 0;
    const loadScores = async () => {
      ledgerReads += 1;
      return [{ userId: 'u-a', score: 3 }, { userId: 'u-z', score: 3 }, { userId: 'u-b', score: 8 }];
    };
    const result = await store.top('2026-W41', 2, loadScores);
    expect(result.entries).toEqual([{ userId: 'u-b', score: 8 }, { userId: 'u-z', score: 3 }]);
    expect(commands.some((command) => command[0] === 'zrevrange')).toBe(false);
    const replacement = commands.find((command) => command[0] === 'eval' && command[2] === 3);
    expect(replacement?.slice(-6)).toEqual([8, 'u-b', 3, 'u-z', 3, 'u-a']);
    expect(await store.top('2026-W41', 2, loadScores)).toEqual(result);
    expect(ledgerReads).toBe(1);
  });

  it('원장 조회 중 잠금이 만료되면 이전 갱신자가 캐시를 게시하지 않는다', async () => {
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body));
      if (isReadOrLock(command)) return Response.json({ result: 1 });
      return Response.json({ result: command[0] === 'zrevrange' ? [] : 0 });
    }) as typeof fetch;
    const store = createRankStore({ url: 'https://example.invalid', token: 'test', fetchImpl });
    await expect(store.top('2026-W41', 50, async () => [{ userId: 'u1', score: 3 }]))
      .rejects.toThrow('Ranking refresh lock expired');
  });
  it('다른 갱신자의 잠금이 유지되면 원본 조회와 캐시 덮어쓰기를 하지 않는다', async () => {
    const commands: unknown[][] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body));
      commands.push(command);
      if (isReadOrLock(command)) return Response.json({ result: 0 });
      if (command[0] === 'zrevrange') return Response.json({ result: ['u1', 3] });
      return Response.json({ result: null });
    }) as typeof fetch;
    const store = createRankStore({ url: 'https://example.invalid', token: 'test', fetchImpl });
    await expect(store.top('2026-W41', 50)).rejects.toThrow('Ranking refresh is in progress');
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read', 'get', 'get', 'get', 'get', 'get']);
    expect(commands.some((command) => command[0] === 'zrevrange')).toBe(false);
    expect(commands.some((command) => command[0] === 'set' && command[1] === 'rank:2026-W41:top')).toBe(false);
    expect(commands.some(isRelease)).toBe(false);
  });
  it('increment는 ZINCRBY를 보낸다', async () => {
    const calls: Call[] = [];
    const store = makeStore([7], calls);
    await store.increment('2026-W41', 'u1', 3);
    expect(calls[0].url).toBe('https://example.upstash.io');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(calls[0].init.body))).toEqual(['zincrby', 'rank:2026-W41', 3, 'u1']);
  });

  it('increment는 시즌 키에 만료 TTL을 건다', async () => {
    const calls: Call[] = [];
    const store = makeStore([7, 1], calls);
    await store.increment('2026-W41', 'u1', 3);
    expect(JSON.parse(String(calls[1].init.body))).toEqual(['expire', 'rank:2026-W41', 1209600]);
  });

  it('top은 스냅샷이 없으면 만들고 저장한다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, ['u1', 9, 'u2', 4], 'OK'], calls);
    const snap = await store.top('2026-W41', 2);
    expect(snap.entries).toEqual([{ userId: 'u1', score: 9 }, { userId: 'u2', score: 4 }]);
    expect(calls.some((c) => JSON.parse(String(c.init.body))[0] === 'zrevrange')).toBe(true);
    expect(calls.some((c) => JSON.parse(String(c.init.body))[0] === 'set')).toBe(true);
  });

  it('top은 유효한 스냅샷이 있으면 그대로 쓴다', async () => {
    const calls: Call[] = [];
    const snap = { at: new Date().toISOString(), season: '2026-W41', entries: [{ userId: 'u1', score: 9 }] };
    const store = makeStore([JSON.stringify(snap)], calls);
    expect(await store.top('2026-W41', 50)).toEqual(snap);
    expect(calls).toHaveLength(1);
    expect(describeCommand(JSON.parse(String(calls[0].init.body)))).toBe('read-or-lock:read');
  });


  it('rankOf는 1-based 순위를 준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([4, '12'], calls);
    expect(await store.rankOf('2026-W41', 'u1')).toEqual({ rank: 5, score: 12 });
  });

  it('rankOf는 순위가 없으면 null이다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, null], calls);
    expect(await store.rankOf('2026-W41', 'u1')).toEqual({ rank: null, score: 0 });
  });

  it('top은 JSON 구문 오류 시 캐시 미스로 처리하고 ZSET에서 다시 읽는다', async () => {
    const calls: Call[] = [];
    const store = makeStore(['{invalid-json', ['u1', 10], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u1', score: 10 }]);
    expect(calls.some((c) => JSON.parse(String(c.init.body))[0] === 'zrevrange')).toBe(true);
  });

  it('top은 60초가 지난 캐시 스냅샷(TTL 누락 등)을 만료로 보고 갱신한다', async () => {
    const calls: Call[] = [];
    const staleSnap = {
      at: new Date(Date.now() - 70_000).toISOString(),
      season: '2026-W41',
      entries: [{ userId: 'u-old', score: 99 }],
    };
    const store = makeStore([JSON.stringify(staleSnap), ['u-fresh', 20], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-fresh', score: 20 }]);
    expect(calls.some((c) => JSON.parse(String(c.init.body))[0] === 'zrevrange')).toBe(true);
  });

  it('top은 시즌이 일치하지 않는 캐시를 무시하고 ZSET에서 새로 읽는다', async () => {
    const calls: Call[] = [];
    const wrongSeasonSnap = {
      at: new Date().toISOString(),
      season: '2026-W40',
      entries: [{ userId: 'u-w40', score: 50 }],
    };
    const store = makeStore([JSON.stringify(wrongSeasonSnap), ['u-w41', 30], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-w41', score: 30 }]);
    expect(calls.some((c) => JSON.parse(String(c.init.body))[0] === 'zrevrange')).toBe(true);
  });

  it('top은 ZSET에 동일 userId 중복이 있으면 최고 점수 1건으로 합친다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, ['u1', 20, 'u1', 10, 'u2', 5], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([
      { userId: 'u1', score: 20 },
      { userId: 'u2', score: 5 },
    ]);
  });

  it('오류 응답은 던진다', async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as typeof fetch;
    const store = createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
    await expect(store.increment('2026-W41', 'u1', 1)).rejects.toThrow();
  });
});


describe('rankStoreFromEnv', () => {
  it('env가 없으면 null이다', () => {
    expect(rankStoreFromEnv({})).toBeNull();
  });
  it('env가 있으면 저장소를 만든다', () => {
    expect(rankStoreFromEnv({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' })).not.toBeNull();
  });
});

describe('createRankStore 관리자 기능', () => {
  it('topAll은 전체 목록을 내림차순으로 돌려준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([['u1', 12, 'u2', 3]], calls);
    const snap = await store.topAll('2026-W41', 100);
    expect(snap.entries).toEqual([
      { userId: 'u1', score: 12 },
      { userId: 'u2', score: 3 },
    ]);
    expect(calls[0].init.body).toContain('zrevrange');
  });

  it('remove는 zrem 명령을 보내고 삭제 수를 돌려준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([1], calls);
    expect(await store.remove('2026-W41', 'guest1')).toBe(1);
    expect(String(calls[0].init.body)).toContain('zrem');
  });
});

describe('Redis RankStore 결함 3 보강 (TDD RED)', () => {
  it('Redis HTTP 200 응답이라도 JSON 본문에 error 필드가 있으면 예외를 던진다', async () => {
    const fetchImpl = (async () => Response.json({ error: 'NOPERM this user has no permissions to run the zincrby command' })) as typeof fetch;
    const store = createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
    await expect(store.increment('2026-W41', 'u1', 1)).rejects.toThrow('NOPERM');
  });

  it('top은 미래 시각(future timestamp)의 캐시를 거부하고 ZSET에서 새로 읽는다', async () => {
    const calls: Call[] = [];
    const futureSnap = {
      at: new Date(Date.now() + 600_000).toISOString(),
      season: '2026-W41',
      entries: [{ userId: 'u-future', score: 100 }],
    };
    const store = makeStore([JSON.stringify(futureSnap), ['u-real', 50], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-real', score: 50 }]);
    // 캐시 get -> lock 획득 -> zrevrange -> set snapshot -> lock 해제
    expect(calls.some((c) => String(c.init.body).includes('zrevrange'))).toBe(true);
  });

  it('top은 유효하지 않은 점수(NaN, Infinity, 음수, 문자열)나 malformed entry 캐시를 거부한다', async () => {
    const calls: Call[] = [];
    const malformedSnap = {
      at: new Date().toISOString(),
      season: '2026-W41',
      entries: [
        { userId: 'u1', score: 'invalid-score' },
        { userId: 'u2', score: NaN },
      ],
    };
    const store = makeStore([JSON.stringify(malformedSnap), ['u-valid', 42], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-valid', score: 42 }]);
    expect(calls.some((c) => String(c.init.body).includes('zrevrange'))).toBe(true);
  });

  it('top은 캐시 미스 시 만료되는 NX 잠금을 획득하여 동시 요청(cold concurrent requests)의 중복 조회를 방지한다', async () => {
    const calls: Call[] = [];
    // 첫 번째 호출은 get null -> set lock nx OK -> zrevrange -> set top -> unlock
    // 두 번째 호출은 lock이 걸려있으므로 잠시 대기 후 생성된 top 캐시를 읽음
    let lockSet = false;
    let savedTop: string | null = null;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: 'https://example.upstash.io', init: init ?? {} });
      const body = JSON.parse(String(init?.body));
      const [cmd, ...args] = body;
      if (isReadOrLock(body)) {
        if (readOrLockMode(body) === 'read' && savedTop) return Response.json({ result: savedTop });
        if (!lockSet) {
          lockSet = true;
          return Response.json({ result: 1 });
        }
        return Response.json({ result: 0 }); // lock fail
      }
      if (cmd === 'get' && args[0] === 'rank:2026-W41:top') {
        return Response.json({ result: savedTop });
      }
      if (cmd === 'zrevrange') {
        return Response.json({ result: ['u1', 99] });
      }
      if (cmd === 'set' && args[0] === 'rank:2026-W41:top') {
        savedTop = args[1];
        return Response.json({ result: 'OK' });
      }
      if (isRelease(body)) {
        lockSet = false;
        return Response.json({ result: 1 });
      }
      return Response.json({ result: null });
    }) as typeof fetch;

    const store = createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
    const [res1, res2] = await Promise.all([store.top('2026-W41', 50), store.top('2026-W41', 50)]);

    expect(res1.entries).toEqual([{ userId: 'u1', score: 99 }]);
    expect(res2.entries).toEqual([{ userId: 'u1', score: 99 }]);
    // zrevrange는 1번만 실행되어야 한다
    const zrevrangeCalls = calls.filter((c) => String(c.init.body).includes('zrevrange'));
    expect(zrevrangeCalls).toHaveLength(1);
    // split SET/EXPIRE가 아닌 atomic SET with NX EX여야 한다
    const lockCalls = calls.map((c) => JSON.parse(String(c.init.body))).filter(isReadOrLock);
    expect(lockCalls.length).toBeGreaterThanOrEqual(1);
    expect(String(lockCalls[0][1])).toMatch(/'NX', 'EX'/);
    expect(String(lockCalls[0][1])).not.toMatch(/expire/i);
  });

  it('lock holder가 오류로 실패하더라도 NX 잠금에는 TTL이 걸려 있어 영구 교착되지 않는다', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: 'https://example.upstash.io', init: init ?? {} });
      const body = JSON.parse(String(init?.body));
      const [cmd] = body;
      if (isReadOrLock(body)) return Response.json({ result: 1 });
      if (cmd === 'zrevrange') {
        throw new Error('Redis network drop');
      }
      return Response.json({ result: null });
    }) as typeof fetch;

    const store = createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
    await expect(store.top('2026-W41', 50)).rejects.toThrow('Redis network drop');

    const setLockCalls = calls.map((c) => JSON.parse(String(c.init.body))).filter(isReadOrLock);
    expect(setLockCalls).toHaveLength(1);
    const lockCmd = setLockCalls[0];
    expect(String(lockCmd[1])).toMatch(/'NX', 'EX'/);
    expect(lockCmd[6]).toBe(5);

    // finally 블록에서 eval을 통한 안전한 해제가 시도되었음을 확인
    const unlockCalls = calls.map((c) => JSON.parse(String(c.init.body))).filter(isRelease);
    expect(unlockCalls).toHaveLength(1);
    expect(unlockCalls[0][4]).toBe(lockCmd[5]);
  });
});

describe('top 스냅샷 조회와 갱신 잠금의 단일 왕복', () => {
  const season = '2026-W41';
  const freshSnapshot = () => ({ at: new Date().toISOString(), season, entries: [{ userId: 'u-cached', score: 7 }] });
  const staleSnapshot = () => ({ ...freshSnapshot(), at: new Date(Date.now() - 70_000).toISOString() });

  /** 조회·잠금 스크립트 응답을 지정하고 게시·해제 스크립트는 성공으로 응답하는 가짜 Redis를 만든다. */
  function scriptedStore(readOrLock: (mode: unknown) => unknown, getReplies: unknown[] = []) {
    const commands: Command[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as Command;
      commands.push(command);
      if (isReadOrLock(command)) return Response.json({ result: readOrLock(readOrLockMode(command)) });
      if (isPublish(command) || isRelease(command)) return Response.json({ result: 1 });
      if (command[0] === 'get') return Response.json({ result: getReplies.shift() ?? null });
      return Response.json({ result: null });
    }) as typeof fetch;
    const store = createRankStore({ url: 'https://example.invalid', token: 'test', fetchImpl });
    return { store, commands };
  }

  it('유효한 캐시 적중은 조회·잠금 스크립트 1회 왕복으로 끝난다', async () => {
    const snap = freshSnapshot();
    const { store, commands } = scriptedStore(() => JSON.stringify(snap));
    let ledgerReads = 0;
    const loadScores = async () => {
      ledgerReads += 1;
      return [];
    };
    expect(await store.top(season, 50, loadScores)).toEqual(snap);
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read']);
    expect(commands[0].slice(3, 5)).toEqual(['rank:2026-W41:top', 'rank:2026-W41:top:lock']);
    expect(ledgerReads).toBe(0);
  });

  it('캐시가 없고 잠금을 얻으면 스크립트·게시·해제만 보내고 GET·SET을 따로 보내지 않는다', async () => {
    const { store, commands } = scriptedStore(() => 1);
    const result = await store.top(season, 50, async () => [{ userId: 'u1', score: 3 }]);
    expect(result.entries).toEqual([{ userId: 'u1', score: 3 }]);
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read', 'publish', 'release']);
    const token = commands[0][5];
    expect(typeof token).toBe('string');
    expect(commands[1][6]).toBe(token);
    expect(commands[2][4]).toBe(token);
  });

  it('캐시가 유효하지 않으면 잠금 방식으로 스크립트를 다시 호출하여 잠금을 얻고 갱신한다', async () => {
    const stale = staleSnapshot();
    const { store, commands } = scriptedStore((mode) => (mode === 'lock' ? 1 : JSON.stringify(stale)));
    let ledgerReads = 0;
    const result = await store.top(season, 50, async () => {
      ledgerReads += 1;
      return [{ userId: 'u-fresh', score: 11 }];
    });
    expect(result.entries).toEqual([{ userId: 'u-fresh', score: 11 }]);
    expect(ledgerReads).toBe(1);
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read', 'read-or-lock:lock', 'publish', 'release']);
    expect(commands[1][5]).toBe(commands[0][5]);
    expect(commands[2][6]).toBe(commands[0][5]);
  });

  it('캐시가 유효하지 않고 다른 요청이 잠금을 쥐면 대기 후 게시된 캐시를 돌려준다', async () => {
    const stale = staleSnapshot();
    const published = freshSnapshot();
    const { store, commands } = scriptedStore(
      (mode) => (mode === 'lock' ? 0 : JSON.stringify(stale)),
      [null, JSON.stringify(published)],
    );
    expect(await store.top(season, 50, async () => [])).toEqual(published);
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read', 'read-or-lock:lock', 'get', 'get']);
  });

  it('캐시가 없고 다른 요청이 잠금을 쥐면 원장 조회 없이 GET 재시도로 게시된 캐시를 돌려준다', async () => {
    const published = freshSnapshot();
    const { store, commands } = scriptedStore(() => 0, [null, JSON.stringify(published)]);
    let ledgerReads = 0;
    const loadScores = async () => {
      ledgerReads += 1;
      return [];
    };
    expect(await store.top(season, 50, loadScores)).toEqual(published);
    expect(ledgerReads).toBe(0);
    expect(commands.map(describeCommand)).toEqual(['read-or-lock:read', 'get', 'get']);
  });

  it('조회·잠금 스크립트는 캐시 조회 후 단일 SET NX EX로만 잠금을 건다', async () => {
    const { store, commands } = scriptedStore(() => 1);
    await store.top(season, 50, async () => []);
    const script = String(commands[0][1]);
    expect(script).toMatch(/redis\.call\('get', KEYS\[1\]\)/);
    expect(script).toMatch(/redis\.call\('set', KEYS\[2\], ARGV\[1\], 'NX', 'EX', ARGV\[2\]\)/);
    expect(script).not.toMatch(/expire/i);
    expect(commands[0][6]).toBe(5);
    expect(commands[0][7]).toBe('read');
  });
});

