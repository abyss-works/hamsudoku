// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetPasswordScreen } from './SetPasswordScreen';

describe('SetPasswordScreen 회귀 검증', () => {
  it('linkError일 때 원본 정확한 안내 문구와 버튼을 표시한다', () => {
    const onDone = vi.fn();
    render(<SetPasswordScreen linkError={true} setPassword={vi.fn()} onDone={onDone} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('링크가 만료됐어요. 재설정 메일을 다시 요청하세요.');
    const button = screen.getByRole('button', { name: '홈으로' });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('비밀번호 변경 성공 시 form이 okMessage 문구로 대체된다', async () => {
    const setPassword = vi.fn(async () => ({ ok: true }));
    const onDone = vi.fn();
    const { container } = render(
      <SetPasswordScreen linkError={false} setPassword={setPassword} onDone={onDone} />,
    );

    expect(container.querySelector('form.login-form')).not.toBeNull();
    expect(screen.getByLabelText('새 비밀번호')).toBeDefined();
    expect(screen.getByLabelText('새 비밀번호 확인')).toBeDefined();

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }));

    await act(async () => {});

    expect(screen.getByText('비밀번호를 바꿨어요!')).toBeDefined();
    expect(container.querySelector('form.login-form')).toBeNull();
  });
});
