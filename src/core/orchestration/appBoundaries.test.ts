import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('애플리케이션 아키텍처 경계 (appBoundaries)', () => {
  it('useAppService는 raw stages/sync 함수를 직접 import하지 않는다', () => {
    const file = path.resolve(__dirname, 'useAppService.ts');
    const content = fs.readFileSync(file, 'utf-8');
    const directSyncImport = /from\s+['"][^'"]*features\/stages\/sync['"]/.test(content);
    expect(directSyncImport).toBe(false);
  });
});
