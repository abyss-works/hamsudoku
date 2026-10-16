import type { DbPort } from './db/port';

// 표시용 닉네임 조회. 저장소 실패를 관측하고 전체 null로 대체하여 점수 목록 응답을 유지한다.
export async function displayNicknames(
  db: DbPort,
  userIds: string[],
): Promise<Record<string, string | null>> {
  try {
    return await db.lookupNicknames(userIds);
  } catch {
    console.warn('Nickname lookup failed');
    return Object.fromEntries(userIds.map((id) => [id, null]));
  }
}
