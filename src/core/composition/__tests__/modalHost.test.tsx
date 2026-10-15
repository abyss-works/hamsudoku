// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ModalHost } from '../ModalHost';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ModalHost', () => {
  it('모달로 열어 배경 입력을 차단하고, 닫힐 때 dialog를 닫는다', () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { value: close, configurable: true });
    const { unmount } = render(<ModalHost><button type="button">확인</button></ModalHost>);
    expect(showModal).toHaveBeenCalledTimes(1);
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('showModal이 없는 환경에서는 open 속성으로 표시한다', () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: undefined, configurable: true });
    const { container } = render(<ModalHost><span>내용</span></ModalHost>);
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  it('Escape의 cancel 이벤트는 기존 닫기 정책을 유지하기 위해 기본 동작을 막는다', () => {
    const { container } = render(<ModalHost><span>내용</span></ModalHost>);
    const dialog = container.querySelector('dialog')!;
    const event = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
