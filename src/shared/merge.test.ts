import { describe, expect, it } from 'vitest';
import { mergeClear, mergeRecords } from './merge';

describe('mergeClear', () => {
  it('베스트는 min, attempts는 합, 최근시각은 max다', () => {
    expect(mergeClear(null, 90, 't1')).toMatchObject({ bestElapsedSec: 90, attempts: 1 });
    expect(mergeClear({ bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' }, 60, 't2'))
      .toMatchObject({ bestElapsedSec: 60, attempts: 2, lastClearedAt: 't2' });
  });
});

describe('mergeRecords', () => {
  it('집계 두 개를 합친다', () => {
    expect(mergeRecords({ bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' }, { bestElapsedSec: 90, attempts: 1, lastClearedAt: 't1' }))
      .toMatchObject({ bestElapsedSec: 50, attempts: 3, lastClearedAt: 't9' });
  });
});
