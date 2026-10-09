const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// 집계 마감 창: 월요일 00:00~04:00 KST. 마감 중에는 플레이는 두되
// 랭킹 적립을 멈추고 끝난 시즌의 확정 표를 보여준다.
const FREEZE_WINDOW_MS = 4 * 60 * 60 * 1000;

export function seasonId(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function seasonStartUtc(id: string): Date {
  const [y, w] = id.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1Monday = jan4.getTime() - (day - 1) * DAY_MS;
  return new Date(week1Monday + (w - 1) * 7 * DAY_MS - KST_OFFSET_MS);
}

// 집계 마감 여부 — 월요일 00:00~04:00 KST.
export function rankingFrozen(now: Date): boolean {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.getUTCDay() === 1 && kst.getUTCHours() < 4;
}

// 집계 대상 시즌 — 마감 창에는 끝난 시즌을, 그 외에는 현재 시즌을 돌려준다.
export function rankedSeasonId(now: Date): string {
  if (!rankingFrozen(now)) return seasonId(now);
  return seasonId(new Date(now.getTime() - FREEZE_WINDOW_MS));
}
