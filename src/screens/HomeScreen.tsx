import { useState } from 'react';
import { PawPrint, Settings } from 'lucide-react';
import type { Stage } from '../api/stagesApi';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import { SettingsDialog } from './SettingsDialog';

interface HomeScreenProps {
  loading: boolean;
  lastStage: Stage | null;
  onResume: (stage: Stage) => void;
  onBrowse: () => void;
}

export function HomeScreen({ loading, lastStage, onResume, onBrowse }: HomeScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="home">
      <div className="home-top">
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
          disabled={!lastStage}
          onClick={() => lastStage && onResume(lastStage)}
        >
          이어하기
        </Button>
        <Button variant="sticker" onClick={onBrowse}>
          스테이지
        </Button>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
