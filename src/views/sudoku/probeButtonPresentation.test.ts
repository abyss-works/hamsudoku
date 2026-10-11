import { describe, expect, it } from 'vitest';
import { probeButtonPresentation } from './probeButtonPresentation';

describe('probeButtonPresentation', () => {
  it('토글 aria-label과 슬롯 표시 문구를 생성한다', () => {
    expect(probeButtonPresentation(false, 3)).toEqual({
      active: false,
      toggleLabel: '임시 정답 켜기',
      slotText: '3/3',
    });
    expect(probeButtonPresentation(true, 1)).toEqual({
      active: true,
      toggleLabel: '임시 정답 끄기',
      slotText: '1/3',
    });
  });
});
