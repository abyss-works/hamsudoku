// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GameHelp } from './GameHelp';

afterEach(cleanup);

describe('GameHelp', () => {
  it('도움말 한 장과 카드 안 좌우 버튼을 보여준다', () => {
    const { container } = render(<GameHelp />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    const card = container.querySelector('.help-card') as HTMLElement;
    expect(card.querySelector('[aria-label="이전 도움말"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="다음 도움말"]')).not.toBeNull();
    // 전환부는 카드 안에 들어간다
    expect(container.querySelector('.help-nav')).toBeNull();
    expect(screen.queryByText(/도움말 \d/)).toBeNull();
  });

  it('좌우 버튼으로 규칙·조작·마커 세 장을 돌려본다', () => {
    render(<GameHelp />);
    expect(screen.getByLabelText('기본 규칙')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('기본 조작')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('마커 펜')).toBeTruthy();
    // 마지막 장에서 다음을 누르면 첫 장으로 돌아온다
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('기본 규칙')).toBeTruthy();
    // 첫 장에서 이전을 누르면 마지막 장으로 간다
    fireEvent.click(screen.getByRole('button', { name: '이전 도움말' }));
    expect(screen.getByLabelText('마커 펜')).toBeTruthy();
  });

  it('장별 항목은 3-3-2 구성을 지킨다', () => {
    render(<GameHelp />);
    expect(screen.getByLabelText('기본 규칙').querySelectorAll('.help-col')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('기본 조작').querySelectorAll('.help-col')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('마커 펜').querySelectorAll('.help-col')).toHaveLength(2);
  });
});
