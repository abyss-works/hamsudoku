import { sql, type SQL } from 'drizzle-orm';

/**
 * raw SQL에 넣는 시각 값. 드라이버는 Date를 프로세스 시간대의 시차와 함께 보내고 시간대 없는 타임스탬프 컬럼은
 * 시차를 버리므로, UTC ISO 문자열로 보내 실행 환경의 시간대와 무관하게 UTC 시각을 저장한다.
 */
export function utcTimestamp(date: Date): SQL {
  return sql`${date.toISOString()}::timestamp(3)`;
}

/** raw SQL의 text 배열 값. 쿼리 빌더의 sql 템플릿은 JS 배열을 매개변수 목록으로 펼치므로 배열 생성자로 묶는다. */
export function textArray(values: string[]): SQL {
  return values.length === 0 ? sql`array[]::text[]` : sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}
