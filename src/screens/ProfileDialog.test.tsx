// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProfileDialog } from './ProfileDialog';

afterEach(cleanup);

const base = {
  email: 'e@x.y' as string | null,
  nickname: null as string | null,
  onSaveNickname: async () => ({ ok: true }),
  onLogin: () => {},
  onLogout: () => {},
  onClose: () => {},
};

describe('ProfileDialog nickname', () => {
  it('저장된 닉네임을 보여준다', () => {
    render(<ProfileDialog {...base} nickname="햄찌" />);
    expect(screen.getByText('햄찌')).toBeTruthy();
  });

  it('미설정이면 안내를 보여준다', () => {
    render(<ProfileDialog {...base} />);
    expect(screen.getByText('아직 없어요')).toBeTruthy();
  });

  it('입력 후 저장을 누르면 콜백이 불린다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: true }));
    render(<ProfileDialog {...base} onSaveNickname={onSaveNickname} />);
    fireEvent.change(screen.getByLabelText('닉네임 입력'), { target: { value: '치즈볼' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('아직 없어요');
    expect(onSaveNickname).toHaveBeenCalledWith('치즈볼');
  });

  it('저장 실패면 메시지를 보여준다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' }));
    render(<ProfileDialog {...base} onSaveNickname={onSaveNickname} />);
    fireEvent.change(screen.getByLabelText('닉네임 입력'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('닉네임은 2~12자로 입력하세요.');
  });
});
