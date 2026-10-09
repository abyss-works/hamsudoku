import { Trophy } from 'lucide-react';
import { mergeRankEntries } from '../shared/rankMerge';
import type { RankResponse } from '../shared/endless';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface RankDialogProps {
  rank: RankResponse | null;
  uid: string | null;
  /** 로그인 사용자 여부. 게스트는 목록만 본다(내 순위·실시간 배지 없음). */
  signedIn: boolean;
  onClose: () => void;
}

function formatSnapshotAge(snapshotAt: string): string | null {
  const at = Date.parse(snapshotAt);
  if (Number.isNaN(at)) return null;
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  return sec < 60 ? `${sec}초 전` : `${Math.floor(sec / 60)}분 전`;
}

export function RankDialog({ rank, uid, signedIn, onClose }: RankDialogProps) {
  const merged = rank && uid && signedIn ? mergeRankEntries(rank, uid) : null;
  const entries = merged?.entries ?? rank?.top ?? [];

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
        {rank && (
          <p className="rank-snapshot">
            순위표 기준: {formatSnapshotAge(rank.snapshotAt) ?? '알 수 없음'}
            {signedIn && (rank.frozen ? ' · 확정 순위예요' : ' · 내 점수는 실시간이에요')}
          </p>
        )}
        <ol className="rank-list rank-scroll">
          {entries.map((e, i) => (
            <li key={e.userId} className={e.userId === uid ? 'rank-row me' : 'rank-row'}>
              <span className="rank-no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="rank-name">
                {e.nickname ?? '게스트'}
                {e.userId === uid && <span className="rank-live">{rank?.frozen ? '최종' : '실시간'}</span>}
              </span>
              <span className="rank-score">
                {e.score}
                <span className="rank-unit">개</span>
              </span>
            </li>
          ))}
          {rank && entries.length === 0 && <li className="rank-row empty">아직 기록이 없어요</li>}
        </ol>
        {rank && signedIn && (
          <p className="rank-me">
            내 순위: {rank.me.rank === null ? '아직 없음' : `${merged?.meRank ?? rank.me.rank}위`} · {rank.me.score}개
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
