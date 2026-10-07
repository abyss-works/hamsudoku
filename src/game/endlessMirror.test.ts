// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyClear,
  applyClearResponse,
  applyFail,
  emptyMirror,
  loadMirror,
  markCleared,
  storeMirror,
} from './endlessMirror';

afterEach(() => {
  localStorage.clear();
});

describe('endlessMirror', () => {
  it('저장·로드 왕복한다', () => {
    const m = applyClear(emptyMirror('2026-W41'), 2);
    storeMirror(m);
    expect(loadMirror('2026-W41')).toEqual(m);
  });
  it('무오답 클리어는 current를 올리고 best를 갱신한다', () => {
    const m = applyClear(emptyMirror('2026-W41'), 3);
    expect(m.wallet.balance).toBe(3);
    expect(m.streak).toEqual({ current: 1, best: 1 });
  });
  it('비무오답 클리어는 current만 리셋한다', () => {
    const first = applyClear(emptyMirror('2026-W41'), 3);
    const second = applyClear(first, 1);
    expect(second.wallet.balance).toBe(4);
    expect(second.streak).toEqual({ current: 0, best: 1 });
  });
  it('실패는 current만 리셋하고 best를 유지한다', () => {
    const first = applyClear(emptyMirror('2026-W41'), 3);
    expect(applyFail(first).streak).toEqual({ current: 0, best: 1 });
  });
  it('서버 응답으로 지갑과 스트릭을 보정한다', () => {
    const m = applyClearResponse(emptyMirror('2026-W41'), { balance: 5, streak: 2 });
    expect(m.wallet.balance).toBe(5);
    expect(m.streak).toEqual({ current: 2, best: 2 });
  });
  it('클리어 표시는 중복을 무시한다', () => {
    const once = markCleared(emptyMirror('2026-W41'), 'e-1');
    expect(markCleared(once, 'e-1').clearedIds).toEqual(['e-1']);
  });
  it('깨진 저장은 빈 미러로 대체한다', () => {
    localStorage.setItem('hamsudoku:endless:v1', '{broken');
    expect(loadMirror('2026-W41').wallet.balance).toBe(0);
  });
});
