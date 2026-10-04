import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/levels.generated';

const css = fs.readFileSync(path.join(process.cwd(), 'src/game/hamster.css'), 'utf8');

describe('섬 색상', () => {
  it('등장하는 모든 섬 id에 색상 규칙이 있다', () => {
    const ids = new Set(LEVELS.flatMap((lv) => lv.puzzle.islands.flat()));
    expect(ids.size).toBeGreaterThan(5);
    for (const id of ids) {
      expect(css).toContain(`data-island='${id}'`);
    }
  });
  it('10개 색상을 정의한다', () => {
    for (let id = 0; id < 10; id += 1) {
      expect(css).toContain(`data-island='${id}'`);
    }
  });
});
