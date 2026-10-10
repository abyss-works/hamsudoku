import { Trophy } from 'lucide-react';
import { useRankDialogService, type RankDialogOptions } from '../../features/ranking/useRankDialogService';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';

export interface RankDialogProps extends RankDialogOptions {
  onClose: () => void;
}

export function RankDialog({ rank, myRank, uid, signedIn, onClose }: RankDialogProps) {
  const { season, frozen, rows, empty, myRankSummary } = useRankDialogService({ rank, myRank, uid, signedIn });

  return (
    <Overlay label="랭킹">
      <div className="rank-card">
        <p className="rank-title">
          <span className="rank-medal" aria-hidden="true">
            <Trophy size={22} />
          </span>
          주간 랭킹
          {season && <span className="rank-season">{season}</span>}
        </p>
        {frozen && <p className="rank-frozen">집계가 마감됐어요. 새 시즌은 4시에 시작해요.</p>}
        <ol className="rank-list rank-scroll">
          {rows.map((row) => (
            <li key={row.userId} className={row.isMe ? 'rank-row me' : 'rank-row'}>
              <span className="rank-no" aria-hidden="true">
                {row.rankNo}
              </span>
              <span className="rank-name">{row.displayName}</span>
              <span className="rank-score">
                {row.score}
                <span className="rank-unit">개</span>
              </span>
            </li>
          ))}
          {empty && <li className="rank-row empty">아직 기록이 없어요</li>}
        </ol>
        {myRankSummary && <p className="rank-me">{myRankSummary}</p>}
        <div className="rank-actions">
          <Button variant="sticker" className="btn-primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
