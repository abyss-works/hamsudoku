import { Trophy } from 'lucide-react';
import { useRankDialogService, type RankDialogProps } from './useRankDialogService';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';

export function RankDialog({ rank, myRank, uid, signedIn, onClose }: RankDialogProps) {
  const { entries, myScore, myRankNo } = useRankDialogService({rank,myRank,uid,signedIn,onClose});

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
        {rank?.frozen && <p className="rank-frozen">집계가 마감됐어요. 새 시즌은 4시에 시작해요.</p>}
        <ol className="rank-list rank-scroll">
          {entries.map((e, i) => (
            <li key={e.userId} className={e.userId === uid ? 'rank-row me' : 'rank-row'}>
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
          {rank && entries.length === 0 && <li className="rank-row empty">아직 기록이 없어요</li>}
        </ol>
        {rank && signedIn && <p className="rank-me">내 순위: {myRankNo === null ? '아직 없음' : `${myRankNo}위`} · {myScore}개</p>}
        <div className="rank-actions">
          <Button variant="sticker" className="btn-primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
