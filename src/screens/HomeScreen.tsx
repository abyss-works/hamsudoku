import { useState } from 'react';
import type { Chapter, Stage } from '../api/stagesApi';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import { SettingsDialog } from './SettingsDialog';

interface HomeScreenProps {
  chapters: Chapter[];
  loading: boolean;
  lastStage: Stage | null;
  onResume: (stage: Stage) => void;
  onOpenStages: (chapterId: string) => void;
}

export function HomeScreen({ chapters, loading, lastStage, onResume, onOpenStages }: HomeScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const entries = chapters.flatMap((c) => c.stages.map((s) => ({ chapterId: c.id, stage: s })));

  return (
    <div className="home">
      <div className="home-top">
        <Button variant="sticker" aria-label="설정" onClick={() => setSettingsOpen(true)}>
          ⚙
        </Button>
      </div>
      <div className="home-mascot" aria-hidden="true">
        <HamsterFace />
      </div>
      <h1 className="home-title">🐹 hamsudoku</h1>
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
        {entries.map(({ chapterId, stage: s }) => (
          <Button key={s.id} variant="sticker" onClick={() => onOpenStages(chapterId)}>
            {s.code}
          </Button>
        ))}
      </div>
      <p className="home-foot">빈칸을 눌러 햄스터를 놓아보세요</p>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
