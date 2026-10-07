import { ENDLESS_MIRROR_KEY, endlessMirrorSchema, type EndlessMirror } from '../shared/endless';

export function emptyMirror(season: string): EndlessMirror {
  return { v: 1, wallet: { balance: 0 }, clearedIds: [], streak: { current: 0, best: 0 }, season };
}

export function loadMirror(season: string, store: Storage = localStorage): EndlessMirror {
  try {
    const raw = store.getItem(ENDLESS_MIRROR_KEY);
    if (!raw) return emptyMirror(season);
    const parsed = endlessMirrorSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyMirror(season);
    return { ...parsed.data, season };
  } catch {
    return emptyMirror(season);
  }
}

export function storeMirror(mirror: EndlessMirror, store: Storage = localStorage): void {
  store.setItem(ENDLESS_MIRROR_KEY, JSON.stringify(mirror));
}

export function markCleared(mirror: EndlessMirror, stageId: string): EndlessMirror {
  if (mirror.clearedIds.includes(stageId)) return mirror;
  return { ...mirror, clearedIds: [...mirror.clearedIds, stageId] };
}

export function applyClear(mirror: EndlessMirror, seedLeft: number): EndlessMirror {
  const current = seedLeft === 3 ? mirror.streak.current + 1 : 0;
  return {
    ...mirror,
    wallet: { balance: mirror.wallet.balance + seedLeft },
    streak: { current, best: Math.max(mirror.streak.best, current) },
  };
}

export function applyClearResponse(mirror: EndlessMirror, res: { balance: number; streak: number }): EndlessMirror {
  return {
    ...mirror,
    wallet: { balance: res.balance },
    streak: { current: res.streak, best: Math.max(mirror.streak.best, res.streak) },
  };
}

export function applyFail(mirror: EndlessMirror): EndlessMirror {
  return { ...mirror, streak: { current: 0, best: mirror.streak.best } };
}
