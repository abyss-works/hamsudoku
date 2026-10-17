export interface RankEntry {
  userId: string;
  score: number;
}

export interface RankSnapshot {
  at: string;
  season?: string;
  entries: RankEntry[];
}

export interface RankStore {
  increment(season: string, userId: string, amount: number): Promise<void>;
  top(season: string, limit: number, loadScores?: () => Promise<RankEntry[]>): Promise<RankSnapshot>;
  /** 관리자용 전체 게임 스코어 목록(내림차순) — UPSTASH ZREVRANGE 원본. */
  topAll(season: string, limit: number): Promise<RankSnapshot>;
  /** 관리자용 엔트리 삭제 — UPSTASH ZREM. 실제 삭제된 수를 돌려준다. */
  remove(season: string, userId: string): Promise<number>;
  rankOf(season: string, userId: string): Promise<{ rank: number | null; score: number }>;
  setScore(season: string, userId: string, score: number): Promise<void>;
}

const TOP_TTL_SEC = 60;
const SEASON_TTL_SEC = 14 * 24 * 60 * 60;
const LOCK_TTL_SEC = 5;

/**
 * 표시 스냅샷 조회와 갱신 잠금 획득을 한 번의 왕복으로 수행한다.
 * KEYS[1]=스냅샷 키, KEYS[2]=잠금 키, ARGV[1]=소유자 토큰, ARGV[2]=잠금 TTL(초), ARGV[3]=동작 방식.
 * 동작 방식이 'read'이면 스냅샷 문자열이 있을 때 그대로 돌려주고, 없으면 잠금을 시도한다.
 * 동작 방식이 'lock'이면 조회 없이 잠금만 시도한다(호출자가 캐시 값을 무효로 판정한 경우).
 * 잠금을 얻으면 1, 다른 요청이 잠금을 쥐고 있으면 0을 돌려준다.
 */
const READ_SNAPSHOT_OR_ACQUIRE_LOCK = `
if ARGV[3] == 'read' then
  local cached = redis.call('get', KEYS[1])
  if cached then return cached end
end
if redis.call('set', KEYS[2], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end
return 0
`;

const PUBLISH_LEDGER_SNAPSHOT = `
if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('del', KEYS[2])
for i = 5, #ARGV, 2 do
  redis.call('zadd', KEYS[2], ARGV[i], ARGV[i + 1])
end
if #ARGV > 4 then redis.call('expire', KEYS[2], ARGV[2]) end
redis.call('set', KEYS[3], ARGV[4], 'EX', ARGV[3])
return 1
`;

function parseAndValidateSnapshot(cached: string | null, season: string): RankSnapshot | null {
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.season && parsed.season !== season) return null;
    if (typeof parsed.at !== 'string') return null;
    const atMs = Date.parse(parsed.at);
    if (Number.isNaN(atMs)) return null;
    const now = Date.now();
    if (atMs > now + 5000) return null;
    if (now - atMs >= TOP_TTL_SEC * 1000) return null;
    if (!Array.isArray(parsed.entries)) return null;
    for (const entry of parsed.entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      if (typeof entry.userId !== 'string' || entry.userId.length === 0) return null;
      if (typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score < 0) return null;
    }
    return parsed as RankSnapshot;
  } catch {
    return null;
  }
}

export function createRankStore(opts: { url: string; token: string; fetchImpl?: typeof fetch }): RankStore {
  const doFetch = opts.fetchImpl ?? fetch;

  async function cmd<T>(command: (string | number)[]): Promise<T> {
    const res = await doFetch(opts.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`rank store ${res.status}`);
    const data = (await res.json()) as { result?: T; error?: string };
    if (data && typeof data === 'object' && data.error) {
      throw new Error(data.error);
    }
    return data.result as T;
  }

  const key = (season: string) => `rank:${season}`;
  const topKey = (season: string) => `rank:${season}:top`;
  const lockKey = (season: string) => `rank:${season}:top:lock`;

  return {
    async increment(season, userId, amount) {
      await cmd(['zincrby', key(season), amount, userId]);
      await cmd(['expire', key(season), SEASON_TTL_SEC]);
    },
    async topAll(season, limit) {
      const flat = await cmd<(string | number)[]>(['zrevrange', key(season), 0, limit - 1, 'withscores']);
      const seen = new Set<string>();
      const entries: RankEntry[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        const uid = String(flat[i]);
        const score = Number(flat[i + 1]);
        if (!seen.has(uid)) {
          seen.add(uid);
          entries.push({ userId: uid, score });
        }
      }
      return { at: new Date().toISOString(), season, entries };
    },
    async remove(season, userId) {
      return cmd<number>(['zrem', key(season), userId]);
    },
    async top(season, limit, loadScores) {
      // 캐시 조회와 NX 갱신 잠금 획득 시도를 단일 스크립트로 묶는다 (만료 TTL 5초, split SET/EXPIRE 금지)
      const lockToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const readOrLock = (mode: 'read' | 'lock') =>
        cmd<string | number | null>([
          'eval', READ_SNAPSHOT_OR_ACQUIRE_LOCK, 2, topKey(season), lockKey(season),
          lockToken, LOCK_TTL_SEC, mode,
        ]);
      let lockRes = await readOrLock('read');
      if (typeof lockRes === 'string') {
        const valid = parseAndValidateSnapshot(lockRes, season);
        if (valid) {
          return valid;
        }
        // 캐시 값이 무효이므로 조회 없이 잠금 획득만 다시 시도한다
        lockRes = await readOrLock('lock');
      }
      const isLockOwner = lockRes === 1;

      if (!isLockOwner) {
        // 다른 요청이 잠금을 쥐고 갱신 중이므로 대기 후 캐시 확인
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 60));
          const retryCached = await cmd<string | null>(['get', topKey(season)]);
          const retryValid = parseAndValidateSnapshot(retryCached, season);
          if (retryValid) {
            return retryValid;
          }
        }
        throw new Error('Ranking refresh is in progress');
      }

      try {
        if (loadScores) {
          const rows = await loadScores();
          rows.sort((a, b) => b.score - a.score || (a.userId < b.userId ? 1 : a.userId > b.userId ? -1 : 0));
          const snapshot: RankSnapshot = { at: new Date().toISOString(), season, entries: rows.slice(0, limit) };
          const published = await cmd<number>([
            'eval', PUBLISH_LEDGER_SNAPSHOT, 3, lockKey(season), key(season), topKey(season),
            lockToken, SEASON_TTL_SEC, TOP_TTL_SEC, JSON.stringify(snapshot),
            ...rows.flatMap((row) => [row.score, row.userId]),
          ]);
          if (published !== 1) throw new Error('Ranking refresh lock expired');
          return snapshot;
        }
        const rawFlat = await cmd<(string | number)[] | null>(['zrevrange', key(season), 0, limit - 1, 'withscores']);
        const flat = rawFlat ?? [];
        const seen = new Set<string>();
        const entries: RankEntry[] = [];
        for (let i = 0; i < flat.length; i += 2) {
          const uid = String(flat[i]);
          const score = Number(flat[i + 1]);
          if (!seen.has(uid)) {
            seen.add(uid);
            entries.push({ userId: uid, score });
          }
        }
        const snapshot: RankSnapshot = { at: new Date().toISOString(), season, entries };
        await cmd(['set', topKey(season), JSON.stringify(snapshot), 'ex', TOP_TTL_SEC]);
        return snapshot;
      } finally {
        if (isLockOwner) {
          // 안전한 해제: 소유자 토큰 일치 시에만 삭제
          await cmd([
            'eval',
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            lockKey(season),
            lockToken,
          ]).catch(() => {});
        }
      }
    },

    async rankOf(season, userId) {
      const rank = await cmd<number | null>(['zrevrank', key(season), userId]);
      const score = await cmd<string | null>(['zscore', key(season), userId]);
      return { rank: rank === null ? null : rank + 1, score: Number(score ?? 0) };
    },
    async setScore(season, userId, score) {
      await cmd(['zadd', key(season), score, userId]);
      await cmd(['expire', key(season), SEASON_TTL_SEC]);
    },
  };
}

export function rankStoreFromEnv(env: Record<string, string | undefined> = process.env): RankStore | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return createRankStore({ url, token });
}
