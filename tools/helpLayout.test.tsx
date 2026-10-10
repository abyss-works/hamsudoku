// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GameHelp } from '../src/features/sudoku/ui/GameHelp';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

afterEach(cleanup);

function withCss() {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

describe('도움말 레이아웃', () => {
  it('한 번에 한 장씩, 장마다 3열 세로 배치다', () => {
    withCss();
    const { container } = render(<GameHelp />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    for (const label of ['기본 규칙', '기본 조작']) {
      if (label !== '기본 규칙') fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
      const card = screen.getByLabelText(label);
      const cols = card.querySelectorAll('.help-col');
      expect(cols).toHaveLength(3);
      for (const col of cols) {
        const cs = getComputedStyle(col as HTMLElement);
        expect(cs.display).toBe('flex');
        expect(cs.flexDirection).toBe('column');
      }
    }
  });
  it('항목 렌더링에 경고가 없다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GameHelp />);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
