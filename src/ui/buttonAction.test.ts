import { describe, expect, it, vi } from 'vitest';
import { buttonAction } from './useButtonAction';

vi.mock('../platform/audio/sound', () => ({
  playButtonSound: vi.fn(),
}));

import { playButtonSound } from '../platform/audio/sound';

describe('buttonAction in ui/useButtonAction', () => {
  it('클릭 시 버튼 사운드를 재생하고 기존 onClick 핸들러를 호출한다', () => {
    const originalOnClick = vi.fn();
    const handler = buttonAction(originalOnClick);

    const dummyEvent = {} as React.MouseEvent<HTMLButtonElement>;
    handler(dummyEvent);

    expect(playButtonSound).toHaveBeenCalled();
    expect(originalOnClick).toHaveBeenCalledWith(dummyEvent);
  });
});
