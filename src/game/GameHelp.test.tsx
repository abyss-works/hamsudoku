// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GameHelp } from './GameHelp';

afterEach(cleanup);

describe('GameHelp', () => {
  it('도움말 한 장과 좌우 버튼을 보여준다', () => {
    const { container } = render(<GameHelp />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '이전 도움말' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 도움말' })).toBeTruthy();
    expect(screen.getByText('도움말 1/3')).toBeTruthy();
  });

  it('좌우 버튼으로 규칙·조작·마커 세 장을 돌려본다', () => {
    render(<GameHelp />);
    expect(screen.getByLabelText('기본 규칙')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('기본 조작')).toBeTruthy();
    expect(screen.getByText('도움말 2/3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('마커')).toBeTruthy();
    expect(screen.getByText('도움말 3/3')).toBeTruthy();
    // 마지막 장에서 다음을 누르면 첫 장으로 돌아온다
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByLabelText('기본 규칙')).toBeTruthy();
    // 첫 장에서 이전을 누르면 마지막 장으로 간다
    fireEvent.click(screen.getByRole('button', { name: '이전 도움말' }));
    expect(screen.getByLabelText('마커')).toBeTruthy();
  });

  it('마커 장에 의심·가설·펜 사용법을 담는다', () => {
    render(<GameHelp />);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(screen.getByText(/의심/)).toBeTruthy();
    expect(screen.getByText(/가설/)).toBeTruthy();
  });
});
