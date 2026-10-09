import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpCard } from '../ui/HelpCard';
import { ControlsPage } from './ControlsHelp';
import { MarkerPage } from './MarkerHelp';
import { RulesPage } from './RulesHelp';

const PAGES = [
  { title: '기본 규칙', page: <RulesPage />, cols: 3 as const },
  { title: '기본 조작', page: <ControlsPage />, cols: 3 as const },
  { title: '마커 펜', page: <MarkerPage />, cols: 2 as const },
];

// 규칙·조작·마커 세 장을 카드 안 좌우 버튼으로 돌려본다.
export function GameHelp() {
  const [page, setPage] = useState(0);
  const prev = () => setPage((p) => (p + PAGES.length - 1) % PAGES.length);
  const next = () => setPage((p) => (p + 1) % PAGES.length);
  return (
    <div className="help-carousel">
      <HelpCard label={PAGES[page].title} cols={PAGES[page].cols}>
        <button type="button" className="btn help-arrow help-prev" aria-label="이전 도움말" onClick={prev}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        {PAGES[page].page}
        <button type="button" className="btn help-arrow help-next" aria-label="다음 도움말" onClick={next}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </HelpCard>
    </div>
  );
}
