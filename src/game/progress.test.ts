// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastStageId, saveLastStageId } from './progress';

beforeEach(() => {
  localStorage.clear();
});

describe('progress', () => {
  it('저장한 스테이지 id를 읽는다', () => {
    saveLastStageId('lv2-s1');
    expect(loadLastStageId()).toBe('lv2-s1');
  });

  it('저장 없으면 null이다', () => {
    expect(loadLastStageId()).toBeNull();
  });
});
