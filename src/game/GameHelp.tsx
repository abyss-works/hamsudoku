import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { HelpCard, HelpCol } from '../ui/HelpCard';
import { ControlsPage } from './ControlsHelp';
import { RulesPage } from './RulesHelp';

function MarkerPage() {
  return (
    <>
      <HelpCol>
        <Check size={20} aria-hidden="true" />
        <p>
          검정 체크,
          <br />
          의심 표시
        </p>
      </HelpCol>
      <HelpCol>
        <span className="help-unknown" aria-hidden="true">
          ?
        </span>
        <p>
          검정 물음표,
          <br />
          가설 표시
        </p>
      </HelpCol>
      <HelpCol>
        <Pencil size={20} aria-hidden="true" />
        <p>
          펜을 골라 찍고,
          <br />
          다시 누르면 그 색만 지우기
        </p>
      </HelpCol>
    </>
  );
}

const PAGES = [
  { title: '기본 규칙', page: <RulesPage /> },
  { title: '기본 조작', page: <ControlsPage /> },
  { title: '마커', page: <MarkerPage /> },
];

// 기본 규칙·조작·마커 세 장을 좌우 버튼으로 돌려본다.
export function GameHelp() {
  const [page, setPage] = useState(0);
  const prev = () => setPage((p) => (p + PAGES.length - 1) % PAGES.length);
  const next = () => setPage((p) => (p + 1) % PAGES.length);
  return (
    <div className="help-carousel">
      <div className="help-nav">
        <button type="button" className="btn help-arrow" aria-label="이전 도움말" onClick={prev}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="help-count" aria-hidden="true">
          도움말 {page + 1}/{PAGES.length}
        </span>
        <button type="button" className="btn help-arrow" aria-label="다음 도움말" onClick={next}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <HelpCard label={PAGES[page].title}>{PAGES[page].page}</HelpCard>
    </div>
  );
}
