import { describe, expect, it } from 'vitest';
import { clearDialogPresentation } from './clearDialogPresentation';

describe('clearDialogPresentation', () => {
  it('햄스터 수 문구와 파티 아이템 인덱스를 생성한다', () => {
    expect(clearDialogPresentation(4)).toEqual({
      title: '햄스터 4마리를 다 찾았다!',
      partyIndices: [0, 1, 2, 3, 4],
    });
  });
});
