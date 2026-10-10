// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthDialog } from './AuthDialog';

describe('AuthDialog 상호작용 및 수명 보존 (task-1 회귀 검증)', () => {
  it('chooseBase 상태에서도 입력 필드·오류가 form 안에 유지되고, reset 버튼은 form 밖에서 chooseBase일 때 숨겨진다', async () => {
    let signupResolve!: (val: { ok: boolean; code?: string }) => void;
    let signinResolve!: (val: { ok: boolean }) => void;
    const signup = vi.fn(() => new Promise<{ ok: boolean; code?: string }>((res) => { signupResolve = res; }));
    const signin = vi.fn(() => new Promise<{ ok: boolean }>((res) => { signinResolve = res; }));
    const reset = vi.fn(async () => ({ ok: true }));
    const fetchAccountSeeds = vi.fn(async () => 5);
    const onBase = vi.fn();
    const onBack = vi.fn();
    const onDone = vi.fn();

    const { container } = render(
      <AuthDialog
        signup={signup}
        signin={signin}
        reset={reset}
        guest={{ seeds: 3, clears: 1 }}
        fetchAccountSeeds={fetchAccountSeeds}
        onBase={onBase}
        onBack={onBack}
        onDone={onDone}
      />,
    );

    const form = container.querySelector('form.login-form') as HTMLFormElement;
    expect(form).not.toBeNull();

    // 1. 초기 상태: 이메일/비밀번호 필드가 form 안에 존재
    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement;
    expect(form.contains(emailInput)).toBe(true);
    expect(form.contains(passwordInput)).toBe(true);

    // 2. 비밀번호 찾기 버튼은 form 밖에 존재해야 한다 (원본 5e649e4 위치)
    const resetBtn = screen.getByRole('button', { name: '비밀번호를 잊었어요' });
    expect(form.contains(resetBtn)).toBe(false);

    // 3. 유효성 검사 실패 시 오류가 form 안에 표시된다
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } }); // 6자 미만
    const submitBtn = screen.getByRole('button', { name: '이메일로 계속하기' });
    fireEvent.click(submitBtn);

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert.textContent).toBe('이메일과 6자 이상 비밀번호를 입력하세요.');
    expect(form.contains(errorAlert)).toBe(true);

    // 4. 올바른 정보 입력 후 가입 시도 -> 이미 가입된 이메일 (email_exists)
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    // signup 응답: email_exists
    await act(async () => {
      signupResolve({ ok: false, code: 'email_exists' });
    });

    // 내부에서 signin 호출됨 -> signin 성공 응답
    await act(async () => {
      signinResolve({ ok: true });
    });

    // 5. chooseBase 진입 상태 검증:
    // HARD RULE: 이메일/비밀번호 필드가 form 안에서 언마운트되지 않고 계속 유지되어야 함
    expect(form.contains(emailInput)).toBe(true);
    expect(form.contains(passwordInput)).toBe(true);
    expect(screen.getByLabelText('이메일')).toBe(emailInput);
    expect(screen.getByLabelText('비밀번호')).toBe(passwordInput);

    // 6. 기준 선택 버튼들이 form 안에 렌더링됨
    const deviceBaseBtn = screen.getByRole('button', { name: /이 기기 기준 \(씨앗 3개\)/ });
    const accountBaseBtn = screen.getByRole('button', { name: /계정 기준 \(씨앗 5개\)/ });
    expect(form.contains(deviceBaseBtn)).toBe(true);
    expect(form.contains(accountBaseBtn)).toBe(true);

    // 7. chooseBase 상태에서는 reset 버튼이 숨겨진다
    expect(screen.queryByRole('button', { name: '비밀번호를 잊었어요' })).toBeNull();

    // 8. 추천 강조 클래스 검증 (account: 5 seeds > device: 3 seeds -> accountRecommended)
    expect(accountBaseBtn.className).toContain('btn-primary');
    expect(deviceBaseBtn.className).not.toContain('btn-primary');

    // 9. 낮은 잔액(이 기기 기준) 선택 시 확인 단계로 진입
    fireEvent.click(deviceBaseBtn);
    expect(screen.getByText('씨앗이 적은 쪽으로 연동하면 다른 쪽 기록은 되돌릴 수 없어요. 이 기준으로 연동할까요?')).not.toBeNull();
    const confirmBtn = screen.getByRole('button', { name: '연동하기' });
    const cancelBtn = screen.getByRole('button', { name: '다시 선택' });
    expect(form.contains(confirmBtn)).toBe(true);
    expect(form.contains(cancelBtn)).toBe(true);

    // 확인 단계에서도 입력 필드는 여전히 form 안에 살아있음
    expect(form.contains(emailInput)).toBe(true);
    expect(form.contains(passwordInput)).toBe(true);

    // 다시 선택 클릭 시 다시 선택 화면으로 복귀
    fireEvent.click(cancelBtn);
    expect(screen.getByRole('button', { name: /이 기기 기준 \(씨앗 3개\)/ })).not.toBeNull();
  });
});
