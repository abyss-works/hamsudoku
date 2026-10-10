export interface AdminRankEntry {
  userId: string;
  nickname: string | null;
  score: number;
}

export async function fetchAdminRank(): Promise<{ season: string; entries: AdminRankEntry[] }> {
  const res = await fetch('/api/admin/rank');
  if (res.status === 403) throw new Error('권한이 없어요.');
  if (res.status === 503) throw new Error('랭킹 스토어 미설정.');
  if (!res.ok) throw new Error('불러오기 실패');
  return res.json();
}

export async function removeRankEntries(userIds: string[]): Promise<number> {
  const res = await fetch('/api/admin/rank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });
  if (!res.ok) throw new Error('삭제 실패');
  const data = await res.json() as { removed: number };
  return data.removed;
}
