// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthDialog } from './AuthDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const base = {
  signup: vi.fn(async () => ({ ok: true })),
  signin: vi.fn(async () => ({ ok: true })),
  reset: vi.fn(async () => ({ ok: true })),
  guest: { seeds: 12, clears: 3 },
  busy: false,
  onBack: () => {},
  onDone: () => {},
};

describe('AuthDialog', () => {
  it('이메일·비밀번호 입력과 계속 버튼을 보여준다', () => {
    render(<AuthDialog {...base} />);
    expect(screen.getByRole('dialog', { name: '계정 연동' })).toBeTruthy();
    expect(screen.getByLabelText('이메일')).toBeTruthy();
    expect(screen.getByLabelText('비밀번호')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이메일로 계속하기' })).toBeTruthy();
  });

  it('제출하면 signup 흐름을 탄다', async () => {
    const signup = vi.fn(async () => ({ ok: true }));
    render(<AuthDialog {...base} signup={signup} />);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(signup).toHaveBeenCalledWith('a@b.c', 'abcdef');
    });
  });

  it('이미 가입된 이메일이면 기준 선택을 먼저 보여준다', async () => {
    const signup = vi.fn(async () => ({ ok: false, code: 'email_exists' }));
    const signin = vi.fn(async () => ({ ok: true }));
    render(<AuthDialog {...base} guest={{ seeds: 7, clears: 2 }} signup={signup} signin={signin} />);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(screen.getByText(/이미 가입된 이메일이에요/)).toBeTruthy();
    });
    // 기준 선택: 기기 씨앗 수를 포함한 라벨과 계정 기준 라벨
    expect(screen.getByText(/이 기기 기준/)).toBeTruthy();
    expect(screen.getByText('계정 기준')).toBeTruthy();
  });
});
