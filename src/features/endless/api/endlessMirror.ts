import { ENDLESS_MIRROR_KEY, endlessMirrorSchema, type EndlessMirror } from '../../../shared/endless';

import { emptyMirror } from '../../../shared/endlessMirrorRules';
export { emptyMirror, markCleared, applyClear, applyClearResponse, applyFail } from '../../../shared/endlessMirrorRules';
// 소유 계정별 저장 키. 게스트(owner 없음)는 기존 전역 키를 그대로 쓴다.
function mirrorKey(owner?: string | null): string {
  return owner ? `${ENDLESS_MIRROR_KEY}:${owner}` : ENDLESS_MIRROR_KEY;
}

// 저장된 미러를 읽는다. 없거나 깨졌으면 null이다.
export function loadStoredMirror(season: string, store: Storage = localStorage, owner?: string | null): EndlessMirror | null {
  try {
    const raw = store.getItem(mirrorKey(owner));
    if (!raw) return null;
    const parsed = endlessMirrorSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { ...parsed.data, season };
  } catch {
    return null;
  }
}

export function loadMirror(season: string, store: Storage = localStorage, owner?: string | null): EndlessMirror {
  return loadStoredMirror(season, store, owner) ?? emptyMirror(season);
}

// 미러는 서버 응답으로 재구축되는 보조 저장이다. 쓰기 실패(quota·접근 제한)는
// 관측만 하고 호출자의 상태 전이와 서버 제출을 막지 않는다.
export function storeMirror(mirror: EndlessMirror, store: Storage = localStorage, owner?: string | null): void {
  try {
    store.setItem(mirrorKey(owner), JSON.stringify(mirror));
  } catch {
    console.warn('Endless mirror store failed');
  }
}
