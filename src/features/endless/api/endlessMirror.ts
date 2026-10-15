import { ENDLESS_MIRROR_KEY, endlessMirrorSchema, type EndlessMirror } from '../../../shared/endless';

import { emptyMirror } from '../../../shared/endlessMirrorRules';
export { emptyMirror, markCleared, applyClear, applyClearResponse, applyFail } from '../../../shared/endlessMirrorRules';
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

// 미러는 서버 응답으로 재구축되는 보조 저장이다. 쓰기 실패(quota·접근 제한)는
// 관측만 하고 호출자의 상태 전이와 서버 제출을 막지 않는다.
export function storeMirror(mirror: EndlessMirror, store: Storage = localStorage): void {
  try {
    store.setItem(ENDLESS_MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    console.warn('Endless mirror store failed');
  }
}
