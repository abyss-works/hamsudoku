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

describe('AuthDialog 기준 표시와 배치', () => {
  it('기준 선택에서 기기 씨앗 수와 계정 씨앗 수를 함께 보여준다', async () => {
    const fetchAccountSeeds = vi.fn(async () => 70);
    const signup = vi.fn(async () => ({ ok: false, code: 'email_exists' }));
    render(<AuthDialog {...base} guest={{ seeds: 7, clears: 2 }} signup={signup} fetchAccountSeeds={fetchAccountSeeds} />);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(screen.getByText(/이 기기 기준/)).toBeTruthy();
    });
    expect(fetchAccountSeeds).toHaveBeenCalled();
    expect(screen.getByText(/계정 기준/)).toBeTruthy();
    expect(screen.getByText(/70/)).toBeTruthy();
  });

  it('기기 씨앗이 더 많으면 기기 기준을 추천한다', async () => {
    const signup = vi.fn(async () => ({ ok: false, code: 'email_exists' }));
    render(<AuthDialog {...base} guest={{ seeds: 70, clears: 2 }} signup={signup} fetchAccountSeeds={vi.fn(async () => 12)} />);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      const deviceBtn = screen.getByRole('button', { name: /이 기기 기준/ });
      const accountBtn = screen.getByRole('button', { name: /계정 기준/ });
      expect(deviceBtn.className).toContain('btn-primary');
      expect(accountBtn.className).not.toContain('btn-primary');
    });
  });
});

describe('AuthDialog 비추천 기준 확인', () => {
  const reachChoice = async (guestSeeds: number, accountSeeds: number) => {
    const signin = vi.fn(async () => ({ ok: true }));
    render(
      <AuthDialog
        {...base}
        guest={{ seeds: guestSeeds, clears: 2 }}
        signup={vi.fn(async () => ({ ok: false, code: 'email_exists' }))}
        signin={signin}
        fetchAccountSeeds={vi.fn(async () => accountSeeds)}
      />,
    );
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(screen.getByText(/이 기기 기준/)).toBeTruthy();
    });
    return signin;
  };

  it('씨앗이 적은 쪽을 누르면 바로 실행하지 않고 되돌릴 수 없음을 알린다', async () => {
    const signin = await reachChoice(70, 12);
    expect(signin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /계정 기준/ }));
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
    expect(signin).toHaveBeenCalledTimes(1);
  });

  it('안내에서 연동하기를 누르면 실행된다', async () => {
    const signin = await reachChoice(70, 12);
    fireEvent.click(screen.getByRole('button', { name: /계정 기준/ }));
    fireEvent.click(screen.getByRole('button', { name: '연동하기' }));
    await vi.waitFor(() => {
      expect(signin).toHaveBeenCalledTimes(2);
    });
  });

  it('안내에서 다시 선택을 누르면 선택으로 돌아간다', async () => {
    const signin = await reachChoice(70, 12);
    fireEvent.click(screen.getByRole('button', { name: /계정 기준/ }));
    fireEvent.click(screen.getByRole('button', { name: '다시 선택' }));
    expect(screen.queryByText(/되돌릴 수 없어요/)).toBeNull();
    expect(screen.getByRole('button', { name: /이 기기 기준/ })).toBeTruthy();
    expect(signin).toHaveBeenCalledTimes(1);
  });

  it('씨앗이 많은 쪽은 바로 실행된다', async () => {
    const signin = await reachChoice(7, 70);
    fireEvent.click(screen.getByRole('button', { name: /계정 기준/ }));
    expect(screen.queryByText(/되돌릴 수 없어요/)).toBeNull();
    await vi.waitFor(() => {
      expect(signin).toHaveBeenCalledTimes(2);
    });
  });
});

describe('AuthDialog 로그인 선행과 취소', () => {
  it('이미 가입된 이메일이면 기준 선택 전에 로그인을 선행한다', async () => {
    const signin = vi.fn(async () => ({ ok: true }));
    const fetchAccountSeeds = vi.fn(async () => 70);
    render(
      <AuthDialog {...base} guest={{ seeds: 12, clears: 1 }} signup={vi.fn(async () => ({ ok: false, code: 'email_exists' }))} signin={signin} fetchAccountSeeds={fetchAccountSeeds} />,
    );
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(signin).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/계정 기준/)).toBeTruthy();
    });
    expect(fetchAccountSeeds).toHaveBeenCalled();
  });

  it('기준 선택 중 닫으면 세션 취소 콜백을 실행한다', async () => {
    const onCancel = vi.fn();
    render(
      <AuthDialog
        {...base}
        guest={{ seeds: 12, clears: 1 }}
        signup={vi.fn(async () => ({ ok: false, code: 'email_exists' }))}
        onBack={onCancel}
      />,
    );
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abcdef' } });
    fireEvent.submit(screen.getByRole('button', { name: '이메일로 계속하기' }).closest('form')!);
    await vi.waitFor(() => {
      expect(screen.getByText(/계정 기준/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
