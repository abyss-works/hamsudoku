import { useState } from 'react';
import { PawPrint, Settings, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import { ProfileDialog } from './ProfileDialog';
import { SettingsDialog } from './SettingsDialog';

interface HomeScreenProps {
  loading: boolean;
  email: string | null;
  nickname: string | null;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onBrowse: () => void;
  onEndless: () => void;
  endlessEnabled: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function HomeScreen({ loading, email, nickname, onSaveNickname, onBrowse, onEndless, endlessEnabled, onLogin, onLogout }: HomeScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      <div className="home-mascot" aria-hidden="true">
        <HamsterFace />
      </div>
      <h1 className="home-title">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub">숨은 햄스터를 찾아라</p>
      <div className="home-actions">
        {loading && <p>불러오는 중…</p>}
        <Button variant="sticker" className="btn-primary" onClick={onBrowse}>
          스테이지
        </Button>
        <Button variant="sticker" className="btn-sun" disabled={!endlessEnabled} onClick={onEndless}>
          무한모드
        </Button>
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
    </div>
  );
}
