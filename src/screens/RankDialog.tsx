import { Trophy } from 'lucide-react';
import type { RankResponse } from '../shared/endless';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface RankDialogProps {
  rank: RankResponse | null;
  onClose: () => void;
}

export function RankDialog({ rank, onClose }: RankDialogProps) {
  return (
    <Overlay label="랭킹">
      <div className="rank-card">
        <p className="rank-title">
          <span className="rank-medal" aria-hidden="true">
            <Trophy size={22} />
          </span>
          주간 랭킹
          {rank && <span className="rank-season">{rank.season}</span>}
        </p>
        <ol className="rank-list">
          {rank?.top.map((e, i) => (
            <li key={e.userId} className={rank.me.rank === i + 1 ? 'rank-row me' : 'rank-row'}>
              <span className="rank-no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="rank-name">{e.nickname ?? '게스트'}</span>
              <span className="rank-score">
                {e.score}
                <span className="rank-unit">개</span>
              </span>
            </li>
          ))}
          {rank && rank.top.length === 0 && <li className="rank-row empty">아직 기록이 없어요</li>}
        </ol>
        {rank && (
          <p className="rank-me">
            내 순위: {rank.me.rank === null ? '아직 없음' : `${rank.me.rank}위`} · {rank.me.score}개
          </p>
        )}
        <div className="rank-actions">
          <Button variant="sticker" className="btn-primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
