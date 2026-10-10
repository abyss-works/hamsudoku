'use client';

import { CheckSquare, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useAdminRankPanelService } from '../game/useAdminRankPanelService';
import { Button } from '../ui/Button';

// 관리자 전용 랭킹 패널 — 게스트(nickname 없음) 엔트리를 골라 랭킹 스토어에서 제거한다.
export function AdminRankPanel() {
  const { loading, error, season, entries, guestEntries, selected, toggle, remove, refresh } = useAdminRankPanelService();

  if (loading) return <main className="admin-card">불러오는 중…</main>;
  if (error) return <main className="admin-card">{error}</main>;

  return (
    <main className="admin-card">
      <h2 className="admin-title">주간 랭킹 관리 {season && <span className="admin-season">{season}</span>}</h2>
      <p className="admin-sub">
        전체 {entries.length}건 · 게스트 {guestEntries.length}건 — 게스트만 기본 목록이에요.
      </p>
      <ul className="admin-list">
        {guestEntries.map((e) => (
          <li key={e.userId} className="admin-row">
            <Button variant="sticker" className="btn-icon" aria-label={`${e.userId} 선택`} onClick={() => toggle(e.userId)}>
              {selected.includes(e.userId) ? <CheckSquare size={18} /> : <Square size={18} />}
            </Button>
            <span className="admin-uid">{e.userId.slice(0, 8)}…</span>
            <span className="admin-score">
              {e.score}
              <span className="admin-unit">개</span>
            </span>
          </li>
        ))}
        {guestEntries.length === 0 && <li className="admin-empty">게스트 엔트리가 없어요.</li>}
      </ul>
      <div className="admin-actions">
        <Button variant="sticker" onClick={refresh} aria-label="새로고침">
          <RefreshCw size={18} aria-hidden="true" />
          새로고침
        </Button>
        <Button variant="sticker" className="btn-primary" onClick={remove} disabled={selected.length === 0}>
          <Trash2 size={18} aria-hidden="true" />
          {selected.length === 0 ? '선택 후 삭제' : `${selected.length}건 제거`}
        </Button>
      </div>
    </main>
  );
}
