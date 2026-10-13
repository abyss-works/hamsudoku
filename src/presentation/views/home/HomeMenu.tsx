import { Trophy } from 'lucide-react';
import { Button } from '../../ui/Button';

export interface HomeMenuProps {
  endlessEnabled: boolean;
  onBrowse: () => void;
  onEndless: () => void;
  onRank: () => void;
}

export function HomeMenu({
  endlessEnabled,
  onBrowse,
  onEndless,
  onRank,
}: HomeMenuProps) {
  return (
    <div className="home-actions">
      <Button variant="sticker" className="btn-primary" onClick={onBrowse}>
        스테이지
      </Button>
      <div className="home-endless-row">
        <Button
          variant="sticker"
          className="btn-sun home-endless-main"
          disabled={!endlessEnabled}
          onClick={onEndless}
        >
          무한모드
        </Button>
        {endlessEnabled && (
          <Button
            variant="sticker"
            className="btn-icon home-trophy"
            aria-label="랭킹"
            onClick={onRank}
          >
            <Trophy size={22} aria-hidden="true" />
          </Button>
        )}
      </div>
      {!endlessEnabled && <p className="home-note">무한모드는 온라인 연결이 필요해요</p>}
    </div>
  );
}
