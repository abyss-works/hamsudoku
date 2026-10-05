import { describe, expect, it } from 'vitest';
import { mergeClear, mergePulled, mergeRecords } from './merge';

describe('mergeClear', () => {
  it('베스트는 min, attempts는 합, 최근시각은 max다', () => {
    expect(mergeClear(null, 90, 't1')).toMatchObject({ bestElapsedSec: 90, attempts: 1 });
    expect(mergeClear({ bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' }, 60, 't2'))
      .toMatchObject({ bestElapsedSec: 60, attempts: 2, lastClearedAt: 't2' });
  });
  it('0 이하 기록은 베스트에서 제외한다', () => {
    expect(mergeClear({ bestElapsedSec: 50, attempts: 1, lastClearedAt: 't1' }, 0, 't2'))
      .toMatchObject({ bestElapsedSec: 50, attempts: 2 });
    expect(mergeClear(null, 0, 't1')).toMatchObject({ bestElapsedSec: null, attempts: 1 });
  });
});

describe('mergePulled', () => {
  it('베스트는 min, attempts는 max, 최근시각은 max다', () => {
    expect(
      mergePulled(
        { bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' },
        { bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' },
      ),
    ).toMatchObject({ bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' });
  });
  it('한쪽이 비면 있는 쪽을 쓴다', () => {
    expect(mergePulled(null, { bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' })).toMatchObject({ bestElapsedSec: 50 });
    expect(mergePulled({ bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' }, null)).toMatchObject({ bestElapsedSec: 90 });
    expect(mergePulled(null, null)).toBeNull();
  });
});

describe('mergeRecords', () => {
  it('집계 두 개를 합친다', () => {
    expect(mergeRecords({ bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' }, { bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' }))
      .toMatchObject({ bestElapsedSec: 50, attempts: 3, lastClearedAt: 't9' });
  });
});
