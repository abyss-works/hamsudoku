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

export function storeMirror(mirror: EndlessMirror, store: Storage = localStorage): void {
  store.setItem(ENDLESS_MIRROR_KEY, JSON.stringify(mirror));
}
