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
      <p className="clear-title">
        <Trophy size={26} aria-hidden="true" /> 주간 랭킹{rank ? ` · ${rank.season}` : ''}
      </p>
      <ol className="rank-list">
        {rank?.top.map((e, i) => (
          <li key={e.userId} className={rank.me.rank === i + 1 ? 'rank-row me' : 'rank-row'}>
            <span className="rank-no">{i + 1}위</span>
            <span className="rank-name">{e.nickname ?? '게스트'}</span>
            <span className="rank-score">{e.score}</span>
          </li>
        ))}
        {rank && rank.top.length === 0 && <li className="rank-row empty">아직 기록이 없어요</li>}
      </ol>
      {rank && (
        <p className="home-note">
          내 순위: {rank.me.rank === null ? '아직 없음' : `${rank.me.rank}위`} · {rank.me.score}개
        </p>
      )}
      <div className="clear-actions">
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
