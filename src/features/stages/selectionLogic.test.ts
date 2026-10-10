import { describe, expect, it } from 'vitest';
import { selectionModel, stageHudModel } from './selectionLogic';
import type { Chapter } from './catalog';
import type { ClearEntry } from '../../shared/saveTypes';

describe('stages selectionLogic view models', () => {
  it('0초, 60초, 미기록 시간 포맷 및 스테이지 레이블과 챕터 탭 상태를 올바르게 계산한다', () => {
    const chapters: Chapter[] = [
      {
        id: 'c1',
        title: '챕터 1',
        stages: [
          { id: 's1', code: '1-1', title: '1-1', locked: false, puzzle: { size: 4, name: '초급' } as any },
          { id: 's2', code: '1-2', title: '1-2', locked: true, puzzle: { size: 4, name: '중급' } as any },
          { id: 's3', code: '1-3', title: '1-3', locked: true, puzzle: { size: 4, name: '고급' } as any },
        ],
      },
      {
        id: 'c2',
        title: '챕터 2',
        stages: [],
      },
    ];

    const clears = new Map<string, ClearEntry>([
      ['1-1', { stageCode: '1-1', elapsedSec: 0, clearedAt: '2026-10-10', attempts: 1 }],
      ['1-2', { stageCode: '1-2', elapsedSec: 60, clearedAt: '2026-10-10', attempts: 1 }],
    ]);

    const res = selectionModel(chapters, 'c1', clears);
    expect(res.active?.id).toBe('c1');
    expect(res.chapterTabs).toEqual([
      { id: 'c1', title: '챕터 1', active: true },
      { id: 'c2', title: '챕터 2', active: false },
    ]);
    expect(res.stages).toEqual([
      {
        stage: chapters[0].stages[0],
        number: 1,
        best: '0:00',
        label: '1, 베스트 0:00',
        locked: false,
        cleared: true,
      },
      {
        stage: chapters[0].stages[1],
        number: 2,
        best: '1:00',
        label: '2, 베스트 1:00',
        locked: true,
        cleared: true,
      },
      {
        stage: chapters[0].stages[2],
        number: 3,
        best: '-',
        label: '3',
        locked: true,
        cleared: false,
      },
    ]);
  });

  it('stageHudModel이 HUD 텍스트와 햄스터 상태 점 목록을 생성한다', () => {
    const hud = stageHudModel('1-1', '0:35', 2, 4);
    expect(hud.hudText).toBe('1-1 · 0:35');
    expect(hud.hamsterDotsLabel).toBe('햄스터 2/4');
    expect(hud.dots).toEqual([
      { id: 0, on: true },
      { id: 1, on: true },
      { id: 2, on: false },
      { id: 3, on: false },
    ]);
  });
});
