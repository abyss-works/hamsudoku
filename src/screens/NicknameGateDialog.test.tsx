// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NicknameGateDialog } from './NicknameGateDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const base = {
  onSaveNickname: vi.fn(async () => ({ ok: true })),
  onEnter: () => {},
  onLater: () => {},
};

describe('NicknameGateDialog', () => {
  it('안내 문구와 입력, 두 버튼을 보여준다', () => {
    render(<NicknameGateDialog {...base} />);
    expect(screen.getByRole('dialog', { name: '닉네임 안내' })).toBeTruthy();
    expect(screen.getByText(/랭킹에 표시될 닉네임/)).toBeTruthy();
    expect(screen.getByLabelText('닉네임')).toBeTruthy();
    expect(screen.getByRole('button', { name: '정하고 계속하기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '나중에 하기' })).toBeTruthy();
  });

  it('저장 성공하면 진입한다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: true }));
    const onEnter = vi.fn();
    render(<NicknameGateDialog {...base} onSaveNickname={onSaveNickname} onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '햄찌' } });
    fireEvent.click(screen.getByRole('button', { name: '정하고 계속하기' }));
    await vi.waitFor(() => {
      expect(onSaveNickname).toHaveBeenCalledWith('햄찌');
      expect(onEnter).toHaveBeenCalledTimes(1);
    });
  });

  it('저장 실패하면 오류를 보여주고 진입하지 않는다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' }));
    const onEnter = vi.fn();
    render(<NicknameGateDialog {...base} onSaveNickname={onSaveNickname} onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: '정하고 계속하기' }));
    await vi.waitFor(() => {
      expect(screen.getByText('닉네임은 2~12자로 입력하세요.')).toBeTruthy();
    });
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('나중에 하기를 누르면 저장 없이 진입한다', () => {
    const onSaveNickname = vi.fn(async () => ({ ok: true }));
    const onLater = vi.fn();
    render(<NicknameGateDialog {...base} onSaveNickname={onSaveNickname} onLater={onLater} />);
    fireEvent.click(screen.getByRole('button', { name: '나중에 하기' }));
    expect(onSaveNickname).not.toHaveBeenCalled();
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
