import { describe, expect, it } from 'vitest';
import { buttonClass, textInputClass } from './classNames';

describe('UI classNames pure helper', () => {
  it('버튼 및 텍스트 인풋 클래스를 공백 정리와 함께 정확히 조합한다', () => {
    expect(buttonClass('plain', '')).toBe('btn');
    expect(buttonClass('sticker', '')).toBe('btn btn-sticker');
    expect(buttonClass('sticker', 'btn-primary custom')).toBe('btn btn-sticker btn-primary custom');
    expect(buttonClass('plain', '  btn-icon  ')).toBe('btn btn-icon');

    expect(textInputClass('')).toBe('text-input');
    expect(textInputClass('  custom-input  ')).toBe('text-input custom-input');
  });
});
