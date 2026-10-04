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
  it('규칙 행은 가로 플렉스다', () => {
    withCss();
    const { container } = render(<RulesHelp />);
    const rows = container.querySelectorAll('.help-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const cs = getComputedStyle(row as HTMLElement);
      expect(cs.display).toBe('flex');
      expect(cs.flexDirection).toBe('row');
    }
  });
  it('조작 행은 가로 플렉스다', () => {
    withCss();
    const { container } = render(<ControlsHelp />);
    const rows = container.querySelectorAll('.help-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cs = getComputedStyle(row as HTMLElement);
      expect(cs.display).toBe('flex');
      expect(cs.flexDirection).toBe('row');
    }
  });
});
