// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ControlsHelp } from '../src/game/ControlsHelp';
import { RulesHelp } from '../src/game/RulesHelp';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

afterEach(cleanup);

function withCss() {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

describe('도움말 레이아웃', () => {
  it('규칙은 한 장에 3열, 열힌 세로 배치다', () => {
    withCss();
    const { container } = render(<RulesHelp />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    const cols = container.querySelectorAll('.help-col');
    expect(cols).toHaveLength(3);
    for (const col of cols) {
      const cs = getComputedStyle(col as HTMLElement);
      expect(cs.display).toBe('flex');
      expect(cs.flexDirection).toBe('column');
    }
  });
  it('조작은 한 장에 3열, 열힌 세로 배치다', () => {
    withCss();
    const { container } = render(<ControlsHelp />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    const cols = container.querySelectorAll('.help-col');
    expect(cols).toHaveLength(3);
    for (const col of cols) {
      const cs = getComputedStyle(col as HTMLElement);
      expect(cs.display).toBe('flex');
      expect(cs.flexDirection).toBe('column');
    }
  });
});
