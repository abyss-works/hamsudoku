import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { HelpCard, HelpCol } from '../ui/HelpCard';
import { ControlsPage } from './ControlsHelp';
import { RulesPage } from './RulesHelp';

function ProbePage() {
  return (
    <>
      <HelpCol>
        <Plus size={20} aria-hidden="true" />
        <p>
          켜고 빈칸에 놓기,
          <br />
          다시 톡하면 회수
        </p>
      </HelpCol>
      <HelpCol>
        <span className="help-unknown" aria-hidden="true">
          ?
        </span>
        <p>
          십자·주변에 살포,
          <br />
          3개까지·끄고 확정
        </p>
      </HelpCol>
      <HelpCol>
        <RotateCcw size={20} aria-hidden="true" />
        <p>
          리셋은 정답마커
          <br />
          빼고 지우기
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
        { title: '임시 정답', page: <ProbePage />, cols: 3 as const },
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
