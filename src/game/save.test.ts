// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { loadSave, nextStageId, recordClear, SAVE_KEY, type ClearEntry } from './save';

afterEach(() => {
  localStorage.clear();
});

describe('loadSave', () => {
  it('깨진 문자열은 백업하고 새 판으로 시작한다', () => {
    localStorage.setItem(SAVE_KEY, '{broken');
    const s = loadSave();
    expect(s.v).toBe(1);
    expect(s.clears).toEqual([]);
    expect(localStorage.getItem(SAVE_KEY)).not.toBe('{broken');
  });
});

describe('recordClear', () => {
  it('재클리어는 attempts만 오르고 베스트는 최소값을 유지한다', () => {
    const fresh = { v: 1 as const, clears: [], settings: { sound: true, vibration: true }, updatedAt: 't0' };
    const s = recordClear(recordClear(fresh, '1-1', 90, 't1'), '1-1', 60, 't2');
    expect(s.clears[0]).toMatchObject({ attempts: 2, elapsedSec: 60 });
  });
});

describe('nextStageId', () => {
  it('최대 클리어의 다음을 주고 전부 클리어면 null이다', () => {
    expect(nextStageId([], ['1-1', '1-2'])).toBe('1-1');
    expect(nextStageId([{ stageCode: '1-1', clearedAt: 't', elapsedSec: 1, attempts: 1 }], ['1-1'])).toBeNull();
  });
  it('동점이면 stageCode 순이다', () => {
    const at = (code: string): ClearEntry => ({ stageCode: code, clearedAt: 't', elapsedSec: 1, attempts: 1 });
    expect(nextStageId([at('1-2'), at('1-1')], ['1-1', '1-2', '1-3'])).toBe('1-3');
  });
});
