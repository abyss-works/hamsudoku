'use client';

import { CheckSquare, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useAdminRankPanelService } from '../../features/ranking/useAdminRankPanelService';
import { Button } from '../../ui/Button';

// 관리자 전용 랭킹 패널 — 게스트(nickname 없음) 엔트리를 골라 랭킹 스토어에서 제거한다.
export function AdminRankPanel() {
  const { loading, error, season, summaryText, rows, empty, canRemove, removeLabel, toggle, remove, refresh } =
    useAdminRankPanelService();

  if (loading) return <main className="admin-card">불러오는 중…</main>;
  if (error) return <main className="admin-card">{error}</main>;

  return (
    <main className="admin-card">
      <h2 className="admin-title">주간 랭킹 관리 {season && <span className="admin-season">{season}</span>}</h2>
      <p className="admin-sub">{summaryText}</p>
      <ul className="admin-list">
        {rows.map((row) => (
          <li key={row.userId} className="admin-row">
            <Button
              variant="sticker"
              className="btn-icon"
              aria-label={row.toggleLabel}
              onClick={() => toggle(row.userId)}
            >
              {row.selected ? <CheckSquare size={18} /> : <Square size={18} />}
            </Button>
            <span className="admin-uid">{row.shortId}</span>
            <span className="admin-score">
              {row.score}
              <span className="admin-unit">개</span>
            </span>
          </li>
        ))}
        {empty && <li className="admin-empty">게스트 엔트리가 없어요.</li>}
      </ul>
      <div className="admin-actions">
        <Button variant="sticker" onClick={refresh} aria-label="새로고침">
          <RefreshCw size={18} aria-hidden="true" />
          새로고침
        </Button>
        <Button variant="sticker" className="btn-primary" onClick={remove} disabled={!canRemove}>
          <Trash2 size={18} aria-hidden="true" />
          {removeLabel}
        </Button>
      </div>
    </main>
  );
}
