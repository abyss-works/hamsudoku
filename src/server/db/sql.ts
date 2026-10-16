import { sql, type SQL } from 'drizzle-orm';

/**
 * raw SQL에 넣는 시각 값. 드라이버는 Date를 프로세스 시간대의 시차와 함께 보내고 시간대 없는 타임스탬프 컬럼은
 * 시차를 버리므로, UTC ISO 문자열로 보내 실행 환경의 시간대와 무관하게 UTC 시각을 저장한다.
 */
export function utcTimestamp(date: Date): SQL {
  return sql`${date.toISOString()}::timestamp(3)`;
}
