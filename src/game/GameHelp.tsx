import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { HelpCard, HelpCol } from '../ui/HelpCard';
import { ControlsPage } from './ControlsHelp';
import { RulesPage } from './RulesHelp';

function ProbePage() {
  return (
    <>
      <HelpCol>
        <Plus size={20} aria-hidden="true" />
        <p>
          임시 정답 켜고,
          <br />
          빈칸에 놓기
        </p>
      </HelpCol>
      <HelpCol>
        <span className="help-unknown" aria-hidden="true">
          ?
        </span>
        <p>
          십자·주변에
          <br />
          물음표가 돋는다
        </p>
      </HelpCol>
    </>
  );
}

// 규칙·조작(무한모드는 임시 정답 장 추가)을 카드 안 좌우 버튼으로 돌려본다.
export function GameHelp({ probe = false }: { probe?: boolean }) {
  const pages = probe
    ? [
        { title: '기본 규칙', page: <RulesPage />, cols: 3 as const },
        { title: '기본 조작', page: <ControlsPage />, cols: 3 as const },
        { title: '임시 정답', page: <ProbePage />, cols: 2 as const },
      ]
    : [
        { title: '기본 규칙', page: <RulesPage />, cols: 3 as const },
        { title: '기본 조작', page: <ControlsPage />, cols: 3 as const },
      ];
  const [page, setPage] = useState(0);
  const prev = () => setPage((p) => (p + pages.length - 1) % pages.length);
  const next = () => setPage((p) => (p + 1) % pages.length);
  return (
    <div className="help-carousel">
      <HelpCard label={pages[page].title} cols={pages[page].cols}>
        <button type="button" className="btn help-arrow help-prev" aria-label="이전 도움말" onClick={prev}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        {pages[page].page}
        <button type="button" className="btn help-arrow help-next" aria-label="다음 도움말" onClick={next}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </HelpCard>
    </div>
  );
}
