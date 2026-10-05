// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SetPasswordScreen } from './SetPasswordScreen';

describe('SetPasswordScreen', () => {
  it('새 비밀번호를 정하면 onDone이 불린다', async () => {
    const setPassword = vi.fn(async () => ({ ok: true as const }));
    const onDone = vi.fn();
    render(<SetPasswordScreen setPassword={setPassword} linkError={false} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }));
    expect(await screen.findByText('비밀번호를 바꿨어요!')).toBeTruthy();
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    cleanup();
  });

  it('확인이 다르면 서버에 묻지 않는다', async () => {
    const setPassword = vi.fn(async () => ({ ok: true as const }));
    render(<SetPasswordScreen setPassword={setPassword} linkError={false} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'ghijkl' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(setPassword).not.toHaveBeenCalled();
    cleanup();
  });
});
