import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !/\.(test|stories)\./.test(path)
        ? [path]
        : [];
  });
}

describe('데이터베이스 포트와 저장 어댑터 경계', () => {
  it('계약과 메모리·Prisma 어댑터가 책임별 모듈로 나뉘며 호환 파일이 없다', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const paths = new Set(sourceFiles(sourceRoot).map((path) => relative(process.cwd(), path).replaceAll('\\', '/')));

    expect(paths.has('src/server/db/port.ts')).toBe(true);
    expect(paths.has('src/server/db/memory.ts')).toBe(true);
    expect(paths.has('src/server/db/prisma.ts')).toBe(true);
    expect(paths.has('src/server/db/numeric.ts')).toBe(true);
    expect(existsSync(join(sourceRoot, 'server/db.ts'))).toBe(false);
  });
});
