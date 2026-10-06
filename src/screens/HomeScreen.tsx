import { useState } from 'react';
import { PawPrint, Settings, User } from 'lucide-react';
import type { Stage } from '../api/stagesApi';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import { ProfileDialog } from './ProfileDialog';
import { SettingsDialog } from './SettingsDialog';

interface HomeScreenProps {
  loading: boolean;
  lastStage: Stage | null;
  email: string | null;
  nickname: string | null;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onResume: (stage: Stage | null) => void;
  onBrowse: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export function HomeScreen({ loading, lastStage, email, nickname, onSaveNickname, onResume, onBrowse, onLogin, onLogout }: HomeScreenProps) {
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
        <Button
          variant="sticker"
          className="btn-primary"
          onClick={() => onResume(lastStage)}
        >
          이어하기
        </Button>
        <Button variant="sticker" onClick={onBrowse}>
          스테이지
        </Button>
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
