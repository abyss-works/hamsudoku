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
  it('하나의 컨테이너에 계정이 위·닉네임이 아래로 나뉜다', () => {
    render(<ProfileDialog {...base} />);
    expect(screen.getByRole('heading', { name: '프로필' }).tagName).toBe('H3');
    const account = screen.getByRole('heading', { name: '계정' });
    const nick = screen.getByRole('heading', { name: '닉네임' });
    expect(account.compareDocumentPosition(nick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('저장된 닉네임이 입력 칸에 들어가 있다', () => {
    render(<ProfileDialog {...base} nickname="햄찌" />);
    expect(screen.getByLabelText('닉네임').getAttribute('value')).toBe('햄찌');
  });

  it('미설정이면 플레이스홀더를 보여준다', () => {
    render(<ProfileDialog {...base} />);
    expect(screen.getByPlaceholderText('닉네임을 입력하세요')).toBeTruthy();
  });

  it('고쳐서 저장을 누르면 콜백이 불린다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: true, nickname: '치즈볼' }));
    render(<ProfileDialog {...base} nickname="햄찌" onSaveNickname={onSaveNickname} />);
    const input = screen.getByLabelText('닉네임');
    fireEvent.change(input, { target: { value: '치즈볼' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByPlaceholderText('닉네임을 입력하세요');
    expect(onSaveNickname).toHaveBeenCalledWith('치즈볼');
  });

  it('저장 실패면 메시지를 보여준다', async () => {
    const onSaveNickname = vi.fn(async () => ({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' }));
    render(<ProfileDialog {...base} onSaveNickname={onSaveNickname} />);
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('닉네임은 2~12자로 입력하세요.');
  });
});
