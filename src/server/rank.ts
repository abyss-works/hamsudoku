import type { DbPort } from './db';

export interface RankEntry {
  userId: string;
  score: number;
}

export interface RankSnapshot {
  at: string;
  entries: RankEntry[];
}

export interface RankStore {
  increment(season: string, userId: string, amount: number): Promise<void>;
  top(season: string, limit: number): Promise<RankSnapshot>;
  /** 관리자용 전체 게임 스코어 목록(내림차순) — UPSTASH ZREVRANGE 원본. */
  topAll(season: string, limit: number): Promise<RankSnapshot>;
  /** 관리자용 엔트리 삭제 — UPSTASH ZREM. 실제 삭제된 수를 돌려준다. */
  remove(season: string, userId: string): Promise<number>;
  rankOf(season: string, userId: string): Promise<{ rank: number | null; score: number }>;
  setScore(season: string, userId: string, score: number): Promise<void>;
}

const TOP_TTL_SEC = 60;
const SEASON_TTL_SEC = 14 * 24 * 60 * 60;

export function createRankStore(opts: { url: string; token: string; fetchImpl?: typeof fetch }): RankStore {
  const doFetch = opts.fetchImpl ?? fetch;

  async function cmd<T>(command: (string | number)[]): Promise<T> {
    const res = await doFetch(opts.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`rank store ${res.status}`);
    const data = (await res.json()) as { result: T };
    return data.result;
  }

  const key = (season: string) => `rank:${season}`;
  const topKey = (season: string) => `rank:${season}:top`;

  return {
    async increment(season, userId, amount) {
      await cmd(['zincrby', key(season), amount, userId]);
      await cmd(['expire', key(season), SEASON_TTL_SEC]);
    },
    async topAll(season, limit) {
      const flat = await cmd<(string | number)[]>(['zrevrange', key(season), 0, limit - 1, 'withscores']);
      const entries: RankEntry[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        entries.push({ userId: String(flat[i]), score: Number(flat[i + 1]) });
      }
      return { at: new Date().toISOString(), entries };
    },
    async remove(season, userId) {
      return cmd<number>(['zrem', key(season), userId]);
    },
    async top(season, limit) {
      const cached = await cmd<string | null>(['get', topKey(season)]);
      if (cached) return JSON.parse(cached) as RankSnapshot;
      const flat = await cmd<(string | number)[]>(['zrevrange', key(season), 0, limit - 1, 'withscores']);
      const entries: RankEntry[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        entries.push({ userId: String(flat[i]), score: Number(flat[i + 1]) });
      }
      const snapshot: RankSnapshot = { at: new Date().toISOString(), entries };
      await cmd(['set', topKey(season), JSON.stringify(snapshot), 'ex', TOP_TTL_SEC]);
      return snapshot;
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

export async function rebuildFromLedger(db: DbPort, store: RankStore, season: string): Promise<number> {
  const rows = await db.listSeasonEarnings(season);
  for (const row of rows) {
    await store.setScore(season, row.userId, row.amount);
  }
  return rows.length;
}

export function rankStoreFromEnv(env: Record<string, string | undefined> = process.env): RankStore | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return createRankStore({ url, token });
}
