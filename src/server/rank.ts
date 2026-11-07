export interface RankEntry {
  userId: string;
  score: number;
}

export interface RankSnapshot {
  at: string;
  season: string;
  entries: RankEntry[];
}

export interface RankCache {
  /** 시즌별 상위 목록. TTL 안이면 보관한 스냅샷을, 아니면 load로 새로 만든 스냅샷을 돌려준다. */
  top(season: string, limit: number, load: () => Promise<RankEntry[]>): Promise<RankSnapshot>;
  /** 한 시즌의 스냅샷과 진행 중인 적재를 버린다. */
  invalidate(season: string): void;
  clear(): void;
}

export const RANK_CACHE_TTL_MS = 60_000;

interface Slot {
  snapshot: RankSnapshot | null;
  expiresAt: number;
  loading: Promise<RankSnapshot> | null;
}

/**
 * 프로세스 안의 순위 표시 캐시. 정본은 Postgres 원장이고, 이 캐시는 상위 목록 조회를 TTL 동안 한 번의 적재로 합친다.
 * 같은 시즌·개수의 동시 요청은 진행 중인 적재를 공유하며 실패한 적재는 보관하지 않는다.
 * 프로세스마다 따로 보관하므로 복제본이 여럿이면 복제본별로 갱신 시각이 다르다.
 */
export function createRankCache(options: { ttlMs?: number; now?: () => number } = {}): RankCache {
  const ttlMs = options.ttlMs ?? RANK_CACHE_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const slots = new Map<string, Slot>();
  const keyOf = (season: string, limit: number) => `${season}:${limit}`;

  return {
    async top(season, limit, load) {
      const key = keyOf(season, limit);
      const current = slots.get(key);
      if (current?.snapshot && now() < current.expiresAt) return current.snapshot;
      if (current?.loading) return current.loading;

      const slot: Slot = current ?? { snapshot: null, expiresAt: 0, loading: null };
      slots.set(key, slot);
      const loading = (async () => {
        const rows = await load();
        const snapshot: RankSnapshot = { at: new Date(now()).toISOString(), season, entries: rows.slice(0, limit) };
        // 적재 중 invalidate되었거나 새 슬롯으로 바뀌었으면 결과를 보관하지 않고 호출자에게만 돌려준다.
        if (slots.get(key) === slot) {
          slot.snapshot = snapshot;
          slot.expiresAt = now() + ttlMs;
        }
        return snapshot;
      })();
      slot.loading = loading;
      try {
        return await loading;
      } finally {
        if (slot.loading === loading) slot.loading = null;
      }
    },
    invalidate(season) {
      for (const key of slots.keys()) {
        if (key.startsWith(`${season}:`)) slots.delete(key);
      }
    },
    clear() {
      slots.clear();
    },
  };
}

export const rankCache: RankCache = createRankCache();
