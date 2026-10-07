import { useState } from 'react';
import { PawPrint, Settings, Sprout, Trophy, User } from 'lucide-react';
import { Button } from '../ui/Button';
import type { EndlessSummaryState } from '../game/useEndlessSummary';
import { ProfileDialog } from './ProfileDialog';
import { RankDialog } from './RankDialog';
import { SettingsDialog } from './SettingsDialog';

interface HomeScreenProps {
  email: string | null;
  nickname: string | null;
  summary: EndlessSummaryState;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onBrowse: () => void;
  onEndless: () => void;
  endlessEnabled: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function HomeScreen({ email, nickname, summary, onSaveNickname, onBrowse, onEndless, endlessEnabled, onLogin, onLogout }: HomeScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);

  return (
    <div className="home">
      <div className="home-top">
        <Button variant="sticker" aria-label="프로필" onClick={() => setProfileOpen(true)}>
          <User size={22} aria-hidden="true" />
        </Button>
        <Button variant="sticker" aria-label="설정" onClick={() => setSettingsOpen(true)}>
          <Settings size={22} aria-hidden="true" />
        </Button>
      </div>
      {endlessEnabled && summary.me && (
        <div className="seed-box" role="status" aria-label={`씨앗 ${summary.me.wallet.balance}개`}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{summary.me.wallet.balance}</span>
        </div>
      )}
      <div className="home-mascot" aria-hidden="true">
        <img src="/hamster-mascot.svg" alt="" />
      </div>
      <h1 className="home-title">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub">숨은 햄스터를 찾아라</p>
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
              onClick={() => {
                setRankOpen(true);
                void summary.refresh();
              }}
            >
              <Trophy size={22} aria-hidden="true" />
            </Button>
          )}
        </div>
        {!endlessEnabled && <p className="home-note">무한모드는 온라인 연결이 필요해요</p>}
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {profileOpen && (
        <ProfileDialog
          email={email}
          nickname={nickname}
          onSaveNickname={onSaveNickname}
          onLogin={() => {
            setProfileOpen(false);
            onLogin();
          }}
          onLogout={onLogout}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {rankOpen && <RankDialog rank={summary.rank} onClose={() => setRankOpen(false)} />}
    </div>
  );
}
